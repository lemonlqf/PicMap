package handler

import (
	"archive/zip"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"picmap-go/internal/config"
	"picmap-go/internal/model"
	"picmap-go/internal/util"
)

// ---- Backup ----

func (h *Handler) CreateBackup(name string) model.Result {
	backupDir := h.cfg.BackupDir()
	util.EnsureDir(backupDir)

	timestamp := time.Now().Format("20060102_150405")
	var fileName string
	if name != "" {
		sanitized := sanitizeFilename(name)
		fileName = "PicMap_Backup_" + sanitized + ".zip"
	} else {
		fileName = "PicMap_Backup_" + timestamp + ".zip"
	}

	outputPath := filepath.Join(backupDir, fileName)
	if util.FileExists(outputPath) {
		return model.NewFailResult("已存在同名备份")
	}

	// Calculate total size
	totalSize := h.calcDataSize()
	sizeWarning := totalSize > 500*1024*1024

	if err := h.createZip(outputPath); err != nil {
		return model.NewFailResult("创建备份失败: " + err.Error())
	}

	return model.NewSuccessResult(map[string]interface{}{
		"filePath":    outputPath,
		"fileName":    fileName,
		"size":        totalSize,
		"sizeWarning": sizeWarning,
	})
}

func (h *Handler) GetBackupSize() model.Result {
	size := h.calcDataSize()
	return model.NewSuccessResult(map[string]interface{}{
		"size":        size,
		"sizeWarning": size > 500*1024*1024,
	})
}

func (h *Handler) GetBackupList() model.Result {
	backupDir := h.cfg.BackupDir()
	if !util.FileExists(backupDir) {
		return model.NewSuccessResult([]map[string]interface{}{})
	}

	entries, _ := os.ReadDir(backupDir)
	type BackupInfo struct {
		FileName   string `json:"fileName"`
		FilePath   string `json:"filePath"`
		Size       int64  `json:"size"`
		CreateTime string `json:"createTime"`
	}
	var list []BackupInfo

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".zip") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, BackupInfo{
			FileName:   e.Name(),
			FilePath:   filepath.Join(backupDir, e.Name()),
			Size:       info.Size(),
			CreateTime: info.ModTime().Format("2006-01-02 15:04:05"),
		})
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreateTime > list[j].CreateTime
	})

	return model.NewSuccessResult(list)
}

func (h *Handler) ImportBackup(filePath, mode string) model.Result {
	if !util.FileExists(filePath) {
		return model.NewFailResult("备份文件不存在")
	}

	if mode == "cover" {
		return h.importCover(filePath)
	} else if mode == "merge" {
		return h.importMerge(filePath)
	}
	return model.NewFailResult("不支持的导入模式: " + mode)
}

func (h *Handler) DeleteBackup(filePath string) model.Result {
	if !util.FileExists(filePath) {
		return model.NewFailResult("备份文件不存在")
	}
	if err := os.Remove(filePath); err != nil {
		return model.NewFailResult("删除失败: " + err.Error())
	}
	return model.NewSuccessResult("删除成功")
}

// ---- Backup helpers ----

func (h *Handler) calcDataSize() int64 {
	var totalSize int64
	entries, err := os.ReadDir(h.cfg.ArchiveDir())
	if err != nil {
		return 0
	}
	for _, e := range entries {
		if e.IsDir() {
			filepath.WalkDir(filepath.Join(h.cfg.ArchiveDir(), e.Name()), func(path string, d os.DirEntry, err error) error {
				if err != nil {
					return nil
				}
				if !d.IsDir() {
					info, _ := d.Info()
					totalSize += info.Size()
				}
				return nil
			})
		}
	}
	// Add appSchema size
	if info, err := os.Stat(h.cfg.AppSchemaPath()); err == nil {
		totalSize += info.Size()
	}
	return totalSize
}

func (h *Handler) createZip(outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	w := zip.NewWriter(file)
	defer w.Close()

	// Add appSchema.json
	if err := addFileToZip(w, h.cfg.AppSchemaPath(), config.AppSchemaFileName); err != nil {
		return err
	}

	// Add user directories
	entries, _ := os.ReadDir(h.cfg.ArchiveDir())
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		userDir := filepath.Join(h.cfg.ArchiveDir(), e.Name())
		prefix := e.Name() + "/"
		filepath.WalkDir(userDir, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			relPath, _ := filepath.Rel(userDir, path)
			// zip 条目统一正斜杠（与 Node 版 archiver 输出一致）
			relPath = strings.ReplaceAll(relPath, "\\", "/")
			return addFileToZip(w, path, prefix+relPath)
		})
	}

	return nil
}

func addFileToZip(w *zip.Writer, filePath, zipName string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	fw, err := w.Create(zipName)
	if err != nil {
		return err
	}
	_, err = fw.Write(data)
	return err
}

func (h *Handler) importCover(filePath string) model.Result {
	// Remove existing data
	entries, _ := os.ReadDir(h.cfg.ArchiveDir())
	for _, e := range entries {
		if e.IsDir() {
			os.RemoveAll(filepath.Join(h.cfg.ArchiveDir(), e.Name()))
		} else if e.Name() == config.AppSchemaFileName {
			os.Remove(filepath.Join(h.cfg.ArchiveDir(), e.Name()))
		}
	}

	// Extract ZIP
	reader, err := zip.OpenReader(filePath)
	if err != nil {
		return model.NewFailResult("读取备份文件失败: " + err.Error())
	}
	defer reader.Close()

	os.MkdirAll(h.cfg.ArchiveDir(), 0755)
	for _, f := range reader.File {
		// zip 条目可能含正斜杠，filepath.Join 在 Windows 会归一化处理
		relName := strings.ReplaceAll(f.Name, "\\", "/")
		targetPath := filepath.Join(h.cfg.ArchiveDir(), filepath.FromSlash(relName))
		if f.FileInfo().IsDir() {
			os.MkdirAll(targetPath, 0755)
			continue
		}
		os.MkdirAll(filepath.Dir(targetPath), 0755)
		rc, _ := f.Open()
		outFile, _ := os.Create(targetPath)
		io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
	}

	// Re-initialize
	h.cfg.Init()
	return model.NewSuccessResult("导入成功")
}

func (h *Handler) importMerge(filePath string) model.Result {
	reader, err := zip.OpenReader(filePath)
	if err != nil {
		return model.NewFailResult("读取备份文件失败: " + err.Error())
	}
	defer reader.Close()

	// Copy new image/track files
	for _, f := range reader.File {
		if f.FileInfo().IsDir() || f.Name == config.AppSchemaFileName {
			continue
		}
		relName := strings.ReplaceAll(f.Name, "\\", "/")
		targetPath := filepath.Join(h.cfg.ArchiveDir(), filepath.FromSlash(relName))
		if util.FileExists(targetPath) {
			continue
		}
		os.MkdirAll(filepath.Dir(targetPath), 0755)
		rc, _ := f.Open()
		outFile, _ := os.Create(targetPath)
		io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
	}

	// Merge schema.json for each user
	for _, f := range reader.File {
		normalizedName := strings.ReplaceAll(f.Name, "\\", "/")
		if !strings.HasSuffix(normalizedName, "/"+config.SchemaFileName) {
			continue
		}
		parts := strings.Split(normalizedName, "/")
		if len(parts) < 3 {
			continue
		}
		userId := parts[0]
		targetSchemaPath := h.cfg.SchemaPath(userId)

		rc, _ := f.Open()
		backupData, _ := io.ReadAll(rc)
		rc.Close()

		var backupSchema model.Schema
		json.Unmarshal(backupData, &backupSchema)

		var targetSchema model.Schema
		if util.FileExists(targetSchemaPath) {
			targetData, _ := os.ReadFile(targetSchemaPath)
			json.Unmarshal(targetData, &targetSchema)
		} else {
			targetSchema = h.cfg.DefaultSchema()
			targetSchema.ImageInfo = []model.ImageInfo{}
			targetSchema.GroupInfo = []model.GroupInfo{}
			targetSchema.TrackInfo = []model.TrackInfo{}
		}

		// Merge images (dedup by ID)
		existingImageIDs := make(map[string]bool)
		for _, img := range targetSchema.ImageInfo {
			existingImageIDs[img.ID] = true
		}
		for _, img := range backupSchema.ImageInfo {
			if !existingImageIDs[img.ID] {
				targetSchema.ImageInfo = append(targetSchema.ImageInfo, img)
			}
		}

		// Merge groups (dedup by ID)
		existingGroupIDs := make(map[string]bool)
		for _, g := range targetSchema.GroupInfo {
			existingGroupIDs[g.ID] = true
		}
		for _, g := range backupSchema.GroupInfo {
			if !existingGroupIDs[g.ID] {
				targetSchema.GroupInfo = append(targetSchema.GroupInfo, g)
			}
		}

		// Merge tracks (dedup by ID)
		existingTrackIDs := make(map[string]bool)
		for _, t := range targetSchema.TrackInfo {
			existingTrackIDs[t.ID] = true
		}
		for _, t := range backupSchema.TrackInfo {
			if !existingTrackIDs[t.ID] {
				targetSchema.TrackInfo = append(targetSchema.TrackInfo, t)
			}
		}

		data, _ := json.MarshalIndent(targetSchema, "", "  ")
		h.atomicWrite(targetSchemaPath, data)
	}

	// Restore appSchema if target doesn't exist
	appSchemaPath := h.cfg.AppSchemaPath()
	if !util.FileExists(appSchemaPath) {
		for _, f := range reader.File {
			if f.Name == config.AppSchemaFileName {
				rc, _ := f.Open()
				data, _ := io.ReadAll(rc)
				rc.Close()
				os.WriteFile(appSchemaPath, data, 0644)
				break
			}
		}
	}

	return model.NewSuccessResult("导入成功")
}
