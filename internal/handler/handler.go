package handler

import (
	"archive/zip"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"picmap-go/internal/config"
	"picmap-go/internal/model"
	"picmap-go/internal/service"
	"picmap-go/internal/util"
)

type Handler struct {
	cfg *config.Config
	ctx context.Context
	mu  sync.Mutex
}

func New(cfg *config.Config, ctx context.Context) *Handler {
	return &Handler{cfg: cfg, ctx: ctx}
}

// ---- User ----

func (h *Handler) CreateUser(userId string) model.Result {
	appData, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err != nil {
		return model.NewFailResult("读取 appSchema 失败")
	}
	var app model.AppSchema
	if err := json.Unmarshal(appData, &app); err != nil {
		return model.NewFailResult("解析 appSchema 失败")
	}
	for _, u := range app.UserInfos {
		if u.UserID == userId {
			return model.NewSuccessResult("用户已存在")
		}
	}
	app.UserInfos = append(app.UserInfos, model.UserInfo{
		UserID:   userId,
		UserName: userId,
	})
	userDir := filepath.Join(h.cfg.ArchiveDir(), userId)
	os.MkdirAll(userDir, 0755)

	schemaDir := h.cfg.SchemaDirPath(userId)
	os.MkdirAll(schemaDir, 0755)
	imageDir := h.cfg.ImageDirPath(userId)
	os.MkdirAll(imageDir, 0755)
	trackDir := h.cfg.TrackDirPath(userId)
	os.MkdirAll(trackDir, 0755)

	defaultSchema := h.cfg.DefaultSchema()
	schemaData, _ := json.MarshalIndent(defaultSchema, "", "  ")
	schemaPath := h.cfg.SchemaPath(userId)
	os.WriteFile(schemaPath, schemaData, 0644)

	newData, _ := json.MarshalIndent(app, "", "  ")
	os.WriteFile(h.cfg.AppSchemaPath(), newData, 0644)

	return model.NewSuccessResult("创建成功")
}

func (h *Handler) DeleteUser(userId string) model.Result {
	userDir := filepath.Join(h.cfg.ArchiveDir(), userId)
	if !util.FileExists(userDir) {
		return model.NewFailResult("用户不存在")
	}
	if err := os.RemoveAll(userDir); err != nil {
		return model.NewFailResult("删除用户目录失败: " + err.Error())
	}
	return model.NewSuccessResult("删除成功")
}

// ---- AppSchema ----

func (h *Handler) GetAppSchema() model.Result {
	data, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err != nil {
		return model.NewFailResult("读取 appSchema 失败")
	}
	var app model.AppSchema
	if err := json.Unmarshal(data, &app); err != nil {
		return model.NewFailResult("解析 appSchema 失败")
	}
	return model.NewSuccessResult(app)
}

func (h *Handler) SetAppSchema(schemaJSON string) model.Result {
	if err := h.atomicWrite(h.cfg.AppSchemaPath(), []byte(schemaJSON)); err != nil {
		return model.NewFailResult("保存 appSchema 失败: " + err.Error())
	}
	return model.NewSuccessResult("appSchema数据更新成功！")
}

func (h *Handler) GetUserInfos() model.Result {
	data, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err != nil {
		return model.NewFailResult("读取 appSchema 失败")
	}
	var app model.AppSchema
	if err := json.Unmarshal(data, &app); err != nil {
		return model.NewFailResult("解析 appSchema 失败")
	}
	return model.NewSuccessResult(app.UserInfos)
}

// ---- Schema ----

func (h *Handler) GetSchema(userId string) model.Result {
	schemaPath := h.cfg.SchemaPath(userId)
	if !util.FileExists(schemaPath) {
		h.ensureDefaultSchema(userId)
	}
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		return model.NewFailResult("读取 schema 失败")
	}
	return model.NewSuccessResult(string(data))
}

func (h *Handler) SetSchema(userId, schemaJSON string) model.Result {
	h.ensureUserDir(userId)
	schemaPath := h.cfg.SchemaPath(userId)
	if err := h.atomicWrite(schemaPath, []byte(schemaJSON)); err != nil {
		return model.NewFailResult("保存 schema 失败: " + err.Error())
	}
	return model.NewSuccessResult("schema数据更新成功！")
}

// ---- Image ----

func (h *Handler) UploadImages(userId string, images []model.UploadImage) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	util.EnsureDir(imageDir)

	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]model.UploadResult, 0, len(images))
	errors := make([]string, 0)

	for _, img := range images {
		wg.Add(1)
		go func(img model.UploadImage) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := model.UploadResult{ID: img.ID}

			// Decode base64 and write original image
			if img.URL != "" {
				ext := filepath.Ext(img.Name)
				if ext == "" {
					ext = ".jpg"
				}

				// Strip data URL prefix (e.g. "data:image/jpeg;base64,")
				b64 := img.URL
				if idx := strings.Index(b64, ";base64,"); idx != -1 {
					b64 = b64[idx+8:]
				}

				data, err := base64.StdEncoding.DecodeString(b64)
				if err != nil {
					mu.Lock()
					errors = append(errors, fmt.Sprintf("解码图片 %s 失败: %v", img.Name, err))
					mu.Unlock()
					return
				}
				filePath := filepath.Join(imageDir, img.ID+ext)
				if err := os.WriteFile(filePath, data, 0644); err != nil {
					mu.Lock()
					errors = append(errors, fmt.Sprintf("写入图片 %s 失败: %v", img.Name, err))
					mu.Unlock()
					return
				}
			}

			mu.Lock()
			results = append(results, result)
			mu.Unlock()
		}(img)
	}
	wg.Wait()

	if len(errors) > 0 {
		return model.Result{
			Code: 200,
			Msg:  "部分图片上传失败",
			Data: map[string]interface{}{
				"images": results,
				"errors": errors,
			},
			Time: time.Now().UnixMilli(),
		}
	}
	return model.NewSuccessResult(map[string]interface{}{"images": results})
}

func (h *Handler) GetThumbnail(userId, imageId string) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	// First try thumbnail
	pattern := filepath.Join(imageDir, "_THUMBNAIL_*"+imageId+"*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) > 0 {
		data, err := os.ReadFile(matches[0])
		if err != nil {
			return model.NewFailResult("读取缩略图失败")
		}
		return model.NewSuccessResult(map[string]string{"file": base64.StdEncoding.EncodeToString(data)})
	}
	// Fallback to original image
	pattern = filepath.Join(imageDir, imageId+".*")
	matches, _ = filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewSuccessResult(map[string]string{"file": ""})
	}
	data, err := os.ReadFile(matches[0])
	if err != nil {
		return model.NewFailResult("读取图片失败")
	}
	return model.NewSuccessResult(map[string]string{"file": base64.StdEncoding.EncodeToString(data)})
}

func (h *Handler) GetThumbnails(userId string, imageIds []string) model.Result {
	files := make([]string, 0, len(imageIds))
	for _, id := range imageIds {
		r := h.GetThumbnail(userId, id)
		if r.Code == 200 {
			if m, ok := r.Data.(map[string]string); ok {
				files = append(files, m["file"])
			}
		} else {
			files = append(files, "")
		}
	}
	return model.NewSuccessResult(map[string][]string{"files": files})
}

func (h *Handler) GetFullImage(userId, imageId string) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	pattern := filepath.Join(imageDir, imageId+".*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewFailResult("图片不存在")
	}
	data, err := os.ReadFile(matches[0])
	if err != nil {
		return model.NewFailResult("读取图片失败")
	}
	return model.NewSuccessResult(map[string]string{"file": base64.StdEncoding.EncodeToString(data)})
}

func (h *Handler) DeleteImages(userId string, imageIds []string) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	var wg sync.WaitGroup
	successCount := 0

	for _, id := range imageIds {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			// Delete original
			pattern := filepath.Join(imageDir, id+".*")
			matches, _ := filepath.Glob(pattern)
			for _, m := range matches {
				os.Remove(m)
			}
			// Delete thumbnails
			thumbPattern := filepath.Join(imageDir, "_THUMBNAIL_*"+id+"*")
			thumbMatches, _ := filepath.Glob(thumbPattern)
			for _, m := range thumbMatches {
				os.Remove(m)
			}
		}(id)
	}
	wg.Wait()

	_ = successCount
	return model.NewSuccessResult("图片删除成功！")
}

func (h *Handler) DownloadImage(userId, imageId string) model.Result {
	return h.GetFullImage(userId, imageId)
}

// ---- Track ----

func (h *Handler) UploadTrack(userId, fileData, fileName string) model.Result {
	// Decode base64
	data, err := base64.StdEncoding.DecodeString(fileData)
	if err != nil {
		return model.NewFailResult("解码文件数据失败")
	}

	// 50MB limit
	if len(data) > 50*1024*1024 {
		return model.NewFailResult("文件大小超过50MB限制")
	}

	// .gpx extension only
	if !strings.HasSuffix(strings.ToLower(fileName), ".gpx") {
		return model.NewFailResult("仅支持GPX格式文件")
	}

	trackDir := h.cfg.TrackDirPath(userId)
	util.EnsureDir(trackDir)

	// Generate track ID prefix like Node.js version
	trackID := generateID()
	outputName := "_TRACK_PM_" + trackID + "_" + fileName
	outputPath := filepath.Join(trackDir, outputName)

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return model.NewFailResult("保存轨迹文件失败: " + err.Error())
	}

	return model.NewSuccessResult(map[string]string{
		"filePath": outputPath,
		"fileName": outputName,
	})
}

func (h *Handler) DeleteTrack(userId, fileName string) model.Result {
	trackDir := h.cfg.TrackDirPath(userId)
	pattern := filepath.Join(trackDir, "*"+fileName+"*")
	matches, _ := filepath.Glob(pattern)
	for _, m := range matches {
		os.Remove(m)
	}
	return model.NewSuccessResult(map[string]string{"message": "删除成功"})
}

func (h *Handler) GetTrack(userId, fileName string) model.Result {
	trackDir := h.cfg.TrackDirPath(userId)
	pattern := filepath.Join(trackDir, "*"+fileName+"*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewFailResult("文件不存在")
	}
	data, err := os.ReadFile(matches[0])
	if err != nil {
		return model.NewFailResult("读取文件失败")
	}
	return model.NewSuccessResult(map[string]string{"fileContent": string(data)})
}

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

// ---- Helper methods ----

func (h *Handler) ensureDefaultSchema(userId string) {
	h.ensureUserDir(userId)
	schemaPath := h.cfg.SchemaPath(userId)
	defaultSchema := h.cfg.DefaultSchema()
	data, _ := json.MarshalIndent(defaultSchema, "", "  ")
	os.WriteFile(schemaPath, data, 0644)
}

func (h *Handler) ensureUserDir(userId string) {
	schemaDir := h.cfg.SchemaDirPath(userId)
	util.EnsureDir(schemaDir)
}

func (h *Handler) atomicWrite(path string, data []byte) error {
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

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
		targetPath := filepath.Join(h.cfg.ArchiveDir(), f.Name)
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
		targetPath := filepath.Join(h.cfg.ArchiveDir(), f.Name)
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
		if !strings.HasSuffix(f.Name, "/"+config.SchemaFileName) {
			continue
		}
		parts := strings.Split(f.Name, "/")
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

// ---- 路径方案：选择图片与导入 ----

var imageDialogFilters = []runtime.FileFilter{
	{DisplayName: "图片文件 (*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.webp;*.heic;*.heif;*.raw;*.dng;*.arw;*.cr2;*.cr3;*.nef;*.orf;*.rw2;*.raf;*.erf)", Pattern: "*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.webp;*.heic;*.heif;*.raw;*.dng;*.arw;*.cr2;*.cr3;*.nef;*.orf;*.rw2;*.raf;*.erf"},
	{DisplayName: "所有文件 (*.*)", Pattern: "*.*"},
}

// SelectImages 打开原生文件选择框，解析每个文件的 EXIF 并生成预览图
func (h *Handler) SelectImages() model.Result {
	if h.ctx == nil {
		return model.NewFailResult("应用上下文未初始化")
	}
	selection, err := runtime.OpenMultipleFilesDialog(h.ctx, runtime.OpenDialogOptions{
		Title:   "选择图片",
		Filters: imageDialogFilters,
	})
	if err != nil {
		return model.NewFailResult("打开文件选择框失败: " + err.Error())
	}
	if len(selection) == 0 {
		return model.NewSuccessResult([]model.SelectedImage{})
	}

	results := make([]model.SelectedImage, len(selection))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	var mu sync.Mutex
	errors := make([]string, 0)

	for i, filePath := range selection {
		wg.Add(1)
		go func(index int, fp string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			item, err := h.processSelectedImage(fp)
			if err != nil {
				mu.Lock()
				errors = append(errors, fmt.Sprintf("解析 %s 失败: %v", filepath.Base(fp), err))
				mu.Unlock()
				return
			}
			results[index] = item
		}(i, filePath)
	}
	wg.Wait()

	if len(errors) > 0 {
		return model.Result{
			Code: 200,
			Msg:  "部分图片解析失败",
			Data: map[string]interface{}{
				"images": results,
				"errors": errors,
			},
			Time: time.Now().UnixMilli(),
		}
	}
	return model.NewSuccessResult(map[string]interface{}{"images": results})
}

func (h *Handler) processSelectedImage(filePath string) (model.SelectedImage, error) {
	name := filepath.Base(filePath)
	info, err := os.Stat(filePath)
	if err != nil {
		return model.SelectedImage{}, err
	}

	item := model.SelectedImage{
		ID:           name,
		Name:         name,
		Path:         filePath,
		Size:         service.CalcMBSize(info.Size()),
		Type:         service.GetImageTypeByName(name),
		LastModified: info.ModTime().UnixMilli(),
	}

	// 解析 EXIF
	exifData, err := service.ExtractExif(filePath)
	if err == nil {
		gcLat, gcLon := util.WGS84toGCJ02(exifData.GPSInfo.Latitude, exifData.GPSInfo.Longitude)
		hasGPS := exifData.GPSInfo.Latitude != 0 || exifData.GPSInfo.Longitude != 0
		gpsInfo := model.GPSInfo{}
		if hasGPS {
			gpsInfo = model.GPSInfo{
				GPSLatitude:  gcLat,
				GPSLongitude: gcLon,
				GPSAltitude:  exifData.GPSInfo.Altitude,
			}
		}
		item.GPSInfo = gpsInfo

		// 分辨率
		resolution := ""
		if exifData.PixelXDimension > 0 || exifData.PixelYDimension > 0 {
			resolution = fmt.Sprintf("%d x %d", exifData.PixelYDimension, exifData.PixelXDimension)
		}
		item.ImageInfo = map[string]interface{}{
			"Resolution":      resolution,
			"BrightnessValue": exifData.BrightnessValue,
			"size":            item.Size,
		}
		item.CameraInfo = map[string]interface{}{
			"Make":               exifData.Make,
			"Model":              exifData.Model,
			"FNumber":            exifData.FNumber,
			"ExposureTime":       exifData.ExposureTime,
			"ISOSpeedRatings":    exifData.ISOSpeedRatings,
			"ExposureBiasValue":  exifData.ExposureBiasValue,
			"FocalLength":        exifData.FocalLength,
			"MaxApertureValue":   exifData.MaxApertureValue,
		}
		item.AuthorInfo = map[string]interface{}{
			"DateTime": exifData.DateTime,
			"Artis":    exifData.Artis,
			"SoftWare": exifData.SoftWare,
		}
	} else {
		item.GPSInfo = model.GPSInfo{}
		item.ImageInfo = map[string]interface{}{
			"Resolution":      "",
			"BrightnessValue": nil,
			"size":            item.Size,
		}
		item.CameraInfo = map[string]interface{}{}
		item.AuthorInfo = map[string]interface{}{}
	}

	// 生成预览图
	if preview, err := service.GeneratePreviewBase64(filePath); err == nil {
		item.Preview = preview
	}

	return item, nil
}

// ImportImages 将选中的图片文件复制到用户图片目录
func (h *Handler) ImportImages(userId string, files []model.ImportFile) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	util.EnsureDir(imageDir)

	results := make([]model.UploadResult, len(files))
	errors := make([]string, 0)
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	var mu sync.Mutex

	for i, f := range files {
		wg.Add(1)
		go func(index int, file model.ImportFile) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := model.UploadResult{ID: file.ID}

			if file.Path == "" {
				mu.Lock()
				errors = append(errors, fmt.Sprintf("图片 %s 路径为空", file.Name))
				mu.Unlock()
				results[index] = result
				return
			}
			if _, err := os.Stat(file.Path); err != nil {
				mu.Lock()
				errors = append(errors, fmt.Sprintf("图片 %s 源文件不存在", file.Name))
				mu.Unlock()
				results[index] = result
				return
			}

			ext := filepath.Ext(file.Path)
			if ext == "" {
				ext = filepath.Ext(file.Name)
			}
			if ext == "" {
				ext = ".jpg"
			}

			// 复制原图到用户目录
			targetPath := filepath.Join(imageDir, file.ID+ext)
			if err := copyFile(file.Path, targetPath); err != nil {
				mu.Lock()
				errors = append(errors, fmt.Sprintf("复制图片 %s 失败: %v", file.Name, err))
				mu.Unlock()
				results[index] = result
				return
			}

			// HEIC/RAW 生成缩略图文件
			if service.NeedsThumbnail(file.Name) {
				if _, err := service.GenerateThumbnailFile(targetPath, imageDir); err != nil {
					mu.Lock()
					errors = append(errors, fmt.Sprintf("生成缩略图 %s 失败: %v", file.Name, err))
					mu.Unlock()
				}
			}

			results[index] = result
		}(i, f)
	}
	wg.Wait()

	if len(errors) > 0 {
		return model.Result{
			Code: 200,
			Msg:  "部分图片导入失败",
			Data: map[string]interface{}{
				"images": results,
				"errors": errors,
			},
			Time: time.Now().UnixMilli(),
		}
	}
	return model.NewSuccessResult(map[string]interface{}{"images": results})
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func sanitizeFilename(name string) string {
	reg := regexp.MustCompile(`[<>:"/\\|?*]`)
	return reg.ReplaceAllString(name, "_")
}
