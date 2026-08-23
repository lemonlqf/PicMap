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
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"picmap-go/internal/config"
	"picmap-go/internal/model"
	"picmap-go/internal/service"
	"picmap-go/internal/util"
)

type Handler struct {
	cfg        *config.Config
	ctx        context.Context
	mu         sync.Mutex
	parsing    atomic.Bool
	thumbCache sync.Map // marker 缩略图 base64 缓存，key: userId+"/"+imageId
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

func (h *Handler) GetThumbnail(userId, imageId string) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	baseName := util.BaseWithoutExt(imageId)
	// First try thumbnail（Node 版命名：_THUMBNAIL_PM<baseName>.jpg）
	pattern := filepath.Join(imageDir, "_THUMBNAIL_PM"+baseName+"*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) > 0 {
		data, err := os.ReadFile(matches[0])
		if err != nil {
			return model.NewFailResult("读取缩略图失败")
		}
		return model.NewSuccessResult(map[string]string{"file": base64.StdEncoding.EncodeToString(data)})
	}
	// Fallback to original image（Node 版命名：PM<baseName>.<ext>）
	pattern = filepath.Join(imageDir, "PM"+baseName+".*")
	matches, _ = filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewSuccessResult(map[string]string{"file": ""})
	}
	// 标准格式原图 resize 到 1000px，避免返回全尺寸 base64（HEIC/RAW 原图无法解码时回退原字节）
	data, err := service.ResizeToJPEGBytes(matches[0], service.ThumbnailWidth)
	if err != nil {
		data, err = os.ReadFile(matches[0])
		if err != nil {
			return model.NewFailResult("读取图片失败")
		}
	}
	return model.NewSuccessResult(map[string]string{"file": base64.StdEncoding.EncodeToString(data)})
}

// markerThumbnailWidth marker 专用缩略图宽度（40px 图标 × 3 DPR 留余量）
const markerThumbnailWidth = 120

// GetMarkerThumbnail 返回 marker 专用小尺寸缩略图（120px），避免缩放加载时解码 1000px 大图导致卡顿
func (h *Handler) GetMarkerThumbnail(userId, imageId string) model.Result {
	cacheKey := userId + "/" + imageId
	if v, ok := h.thumbCache.Load(cacheKey); ok {
		return model.NewSuccessResult(map[string]string{"file": v.(string)})
	}

	imageDir := h.cfg.ImageDirPath(userId)
	baseName := util.BaseWithoutExt(imageId)

	// 优先缩略图文件（JPEG，可直接解码），否则原图
	filePath := ""
	if matches, _ := filepath.Glob(filepath.Join(imageDir, "_THUMBNAIL_PM"+baseName+"*")); len(matches) > 0 {
		filePath = matches[0]
	} else if matches, _ := filepath.Glob(filepath.Join(imageDir, "PM"+baseName+".*")); len(matches) > 0 {
		filePath = matches[0]
	}
	if filePath == "" {
		return model.NewSuccessResult(map[string]string{"file": ""})
	}

	data, err := service.ResizeToJPEGBytes(filePath, markerThumbnailWidth)
	if err != nil {
		return model.NewSuccessResult(map[string]string{"file": ""})
	}
	b64 := base64.StdEncoding.EncodeToString(data)
	h.thumbCache.Store(cacheKey, b64)
	return model.NewSuccessResult(map[string]string{"file": b64})
}

func (h *Handler) GetThumbnails(userId string, imageIds []string) model.Result {
	files := make([]string, len(imageIds))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	for i, id := range imageIds {
		wg.Add(1)
		go func(index int, imageId string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			r := h.GetThumbnail(userId, imageId)
			if r.Code == 200 {
				if m, ok := r.Data.(map[string]string); ok {
					files[index] = m["file"]
				}
			}
		}(i, id)
	}
	wg.Wait()
	return model.NewSuccessResult(map[string][]string{"files": files})
}

func (h *Handler) GetFullImage(userId, imageId string) model.Result {
	imageDir := h.cfg.ImageDirPath(userId)
	baseName := util.BaseWithoutExt(imageId)
	pattern := filepath.Join(imageDir, "PM"+baseName+".*")
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
	sem := make(chan struct{}, 4)

	for _, id := range imageIds {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			baseName := util.BaseWithoutExt(id)
			// Delete original（PM<baseName>.*）
			pattern := filepath.Join(imageDir, "PM"+baseName+".*")
			matches, _ := filepath.Glob(pattern)
			for _, m := range matches {
				os.Remove(m)
			}
			// Delete thumbnails（_THUMBNAIL_PM<baseName>*）
			thumbPattern := filepath.Join(imageDir, "_THUMBNAIL_PM"+baseName+"*")
			thumbMatches, _ := filepath.Glob(thumbPattern)
			for _, m := range thumbMatches {
				os.Remove(m)
			}
		}(id)
	}
	wg.Wait()

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

// ---- 路径方案：选择图片与导入 ----

// 图片解析事件名
const (
	EventImagesParsed   = "images-parsed"   // 一批图片解析完成
	EventImagesProgress = "images-progress" // 解析进度
	EventImagesDone     = "images-done"     // 全部解析完成
)

var imageDialogFilters = []runtime.FileFilter{
	{DisplayName: "图片文件 (*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.webp;*.heic;*.heif;*.raw;*.dng;*.arw;*.cr2;*.cr3;*.nef;*.orf;*.rw2;*.raf;*.erf)", Pattern: "*.jpg;*.jpeg;*.png;*.gif;*.bmp;*.webp;*.heic;*.heif;*.raw;*.dng;*.arw;*.cr2;*.cr3;*.nef;*.orf;*.rw2;*.raf;*.erf"},
	{DisplayName: "所有文件 (*.*)", Pattern: "*.*"},
}

// SelectImages 打开原生文件选择框，立即返回文件路径列表，后台分批解析并推送事件
func (h *Handler) SelectImages() model.Result {
	if h.ctx == nil {
		return model.NewFailResult("应用上下文未初始化")
	}
	// 防重入：解析中拒绝二次进入
	if h.parsing.Load() {
		return model.NewFailResult("正在解析图片，请稍候")
	}
	selection, err := runtime.OpenMultipleFilesDialog(h.ctx, runtime.OpenDialogOptions{
		Title:   "选择图片",
		Filters: imageDialogFilters,
	})
	if err != nil {
		return model.NewFailResult("打开文件选择框失败: " + err.Error())
	}
	if len(selection) == 0 {
		return model.NewSuccessResult(map[string]interface{}{
			"filePaths": []string{},
			"total":     0,
		})
	}

	h.parsing.Store(true)
	// 立即异步解析（不阻塞返回）
	go h.parseImagesInBatches(selection)

	// 立即返回文件路径列表
	return model.NewSuccessResult(map[string]interface{}{
		"filePaths": selection,
		"total":     len(selection),
	})
}

// parseImagesInBatches 分批解析图片，每批完成后通过事件推送给前端
func (h *Handler) parseImagesInBatches(filePaths []string) {
	defer h.parsing.Store(false)     // 解析结束，释放锁
	defer func() { _ = recover() }() // 防崩溃

	const batchSize = 4
	total := len(filePaths)
	processed := 0

	// 首批微延迟，给前端事件通道就绪留时间窗口（时序兜底）
	time.Sleep(50 * time.Millisecond)

	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}
		batch := filePaths[i:end]

		// 解析当前批次（保持 4 并发）
		results := make([]model.SelectedImage, len(batch))
		errors := make([]string, 0)
		var wg sync.WaitGroup
		sem := make(chan struct{}, 4)
		var mu sync.Mutex

		for idx, fp := range batch {
			wg.Add(1)
			go func(index int, path string) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				item, err := h.processSelectedImage(path)
				if err != nil {
					mu.Lock()
					errors = append(errors, fmt.Sprintf("解析 %s 失败: %v", filepath.Base(path), err))
					mu.Unlock()
					return
				}
				results[index] = item
			}(idx, fp)
		}
		wg.Wait()

		// 推送前判断 ctx 是否有效（应用关闭时避免崩溃）
		if h.ctx.Err() != nil {
			return
		}

		// 过滤解析失败产生的零值项，避免空 id 条目推送到前端
		validResults := make([]model.SelectedImage, 0, len(results))
		for _, r := range results {
			if r.ID != "" {
				validResults = append(validResults, r)
			}
		}

		// 推送本批结果
		runtime.EventsEmit(h.ctx, EventImagesParsed, map[string]interface{}{
			"images": validResults,
			"errors": errors,
		})

		// 更新进度
		processed += len(batch)
		runtime.EventsEmit(h.ctx, EventImagesProgress, map[string]interface{}{
			"processed": processed,
			"total":     total,
		})
	}

	// 全部完成
	runtime.EventsEmit(h.ctx, EventImagesDone, map[string]interface{}{
		"total": total,
	})
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
	item.IsPanorama, item.PanoramaType = service.DetectPanorama(filePath)

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

			// 复制原图到用户目录（PM 前缀 + 无扩展名 id + 扩展名，与 Node 版一致）
			targetPath := filepath.Join(imageDir, "PM"+util.BaseWithoutExt(file.ID)+ext)
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

// ---- 视频（轨迹视频） ----

// 视频解析事件名
const (
	EventVideosParsed   = "videos-parsed"   // 一批视频解析完成
	EventVideosProgress = "videos-progress" // 解析进度
	EventVideosDone     = "videos-done"     // 全部解析完成
)

var videoDialogFilters = []runtime.FileFilter{
	{DisplayName: "视频文件 (*.mp4;*.mov;*.m4v;*.mkv;*.avi)", Pattern: "*.mp4;*.mov;*.m4v;*.mkv;*.avi"},
	{DisplayName: "所有文件 (*.*)", Pattern: "*.*"},
}

// SelectVideos 打开原生文件选择框，立即返回文件路径列表，后台分批解析并推送事件
func (h *Handler) SelectVideos() model.Result {
	if h.ctx == nil {
		return model.NewFailResult("应用上下文未初始化")
	}
	if h.parsing.Load() {
		return model.NewFailResult("正在解析视频，请稍候")
	}
	selection, err := runtime.OpenMultipleFilesDialog(h.ctx, runtime.OpenDialogOptions{
		Title:   "选择轨迹视频",
		Filters: videoDialogFilters,
	})
	if err != nil {
		return model.NewFailResult("打开文件选择框失败: " + err.Error())
	}
	if len(selection) == 0 {
		return model.NewSuccessResult(map[string]interface{}{
			"filePaths": []string{},
			"total":     0,
		})
	}

	h.parsing.Store(true)
	go h.parseVideosInBatches(selection)

	return model.NewSuccessResult(map[string]interface{}{
		"filePaths": selection,
		"total":     len(selection),
	})
}

// parseVideosInBatches 分批解析视频，每批完成后通过事件推送给前端
func (h *Handler) parseVideosInBatches(filePaths []string) {
	defer h.parsing.Store(false)
	defer func() { _ = recover() }()

	const batchSize = 2 // 视频解析较重，降并发
	total := len(filePaths)
	processed := 0

	time.Sleep(50 * time.Millisecond)

	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}
		batch := filePaths[i:end]

		results := make([]model.SelectedVideo, len(batch))
		errors := make([]string, 0)
		var wg sync.WaitGroup
		sem := make(chan struct{}, 2)
		var mu sync.Mutex

		for idx, fp := range batch {
			wg.Add(1)
			go func(index int, path string) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				item, err := h.processSelectedVideo(path)
				if err != nil {
					mu.Lock()
					errors = append(errors, fmt.Sprintf("解析 %s 失败: %v", filepath.Base(path), err))
					mu.Unlock()
					return
				}
				results[index] = item
			}(idx, fp)
		}
		wg.Wait()

		if h.ctx.Err() != nil {
			return
		}

		validResults := make([]model.SelectedVideo, 0, len(results))
		for _, r := range results {
			if r.ID != "" {
				validResults = append(validResults, r)
			}
		}

		runtime.EventsEmit(h.ctx, EventVideosParsed, map[string]interface{}{
			"videos": validResults,
			"errors": errors,
		})

		processed += len(batch)
		runtime.EventsEmit(h.ctx, EventVideosProgress, map[string]interface{}{
			"processed": processed,
			"total":     total,
		})
	}

	runtime.EventsEmit(h.ctx, EventVideosDone, map[string]interface{}{
		"total": total,
	})
}

// processSelectedVideo 解析单个视频：时长、文件名起点时间、是否有内嵌 GPS
func (h *Handler) processSelectedVideo(filePath string) (model.SelectedVideo, error) {
	name := filepath.Base(filePath)
	info, err := os.Stat(filePath)
	if err != nil {
		return model.SelectedVideo{}, err
	}

	item := model.SelectedVideo{
		ID:           name,
		Name:         name,
		Path:         filePath,
		Size:         info.Size(),
		LastModified: info.ModTime().UnixMilli(),
	}

	// 文件名起点时间（作为兜底，后面 ffprobe 的 creation_time 更优先）
	startMs := service.ParseStartTimeFromName(name)
	if startMs != 0 {
		item.StartTimeMS = startMs
		item.ParsedTimeText = time.UnixMilli(startMs).Format("2006-01-02 15:04:05")
	}

	// 时长、绝对开始时间、内嵌 GPS（ffprobe 就绪时才有；失败不阻断）
	if pinfo, err := service.ProbeVideo(filePath); err == nil {
		item.DurationMS = pinfo.DurationMS
		// creation_time 优先于文件名时间
		if pinfo.CreationTime != 0 {
			item.StartTimeMS = pinfo.CreationTime
			item.ParsedTimeText = time.UnixMilli(pinfo.CreationTime).Format("2006-01-02 15:04:05")
		}
		// 内嵌 GPS 单点
		if pinfo.HasGPS {
			item.HasGpsData = true
			item.GPSLatitude = pinfo.GPSLatitude
			item.GPSLongitude = pinfo.GPSLongitude
		}
	}

	return item, nil
}

// ImportVideo 将选中的视频复制到用户视频目录，生成 VideoInfo 并返回
func (h *Handler) ImportVideo(userId string, file model.ImportVideoFile) model.Result {
	if file.Path == "" {
		return model.NewFailResult("视频路径为空")
	}
	if _, err := os.Stat(file.Path); err != nil {
		return model.NewFailResult("视频源文件不存在")
	}

	videoDir := h.cfg.VideoDirPath(userId)
	util.EnsureDir(videoDir)

	ext := filepath.Ext(file.Path)
	if ext == "" {
		ext = ".mp4"
	}
	targetPath := filepath.Join(videoDir, "PM"+util.BaseWithoutExt(file.ID)+ext)
	if err := copyFile(file.Path, targetPath); err != nil {
		return model.NewFailResult("复制视频失败: " + err.Error())
	}

	info, _ := os.Stat(targetPath)
	vi := model.VideoInfo{
		ID:           file.ID,
		Name:         file.Name,
		Path:         filepath.Base(targetPath),
		Size:         info.Size(),
		LastModified: info.ModTime().UnixMilli(),
	}
	// 时长、绝对开始时间、内嵌 GPS
	if p, err := service.ProbeVideo(targetPath); err == nil {
		vi.DurationMS = p.DurationMS
		if p.CreationTime != 0 {
			vi.StartTimeMS = p.CreationTime
		}
		if p.HasGPS {
			// 地图标记使用 GCJ02 坐标（与图片一致），内嵌 GPS 为 WGS84，需转换
			gLat, gLon := util.WGS84toGCJ02(p.GPSLatitude, p.GPSLongitude)
			vi.GPSLatitude = gLat
			vi.GPSLongitude = gLon
		}
	}
	// 文件名起点时间兜底（若 creation_time 缺失）
	if vi.StartTimeMS == 0 {
		if start := service.ParseStartTimeFromName(file.Name); start != 0 {
			vi.StartTimeMS = start
		}
	}

	return model.NewSuccessResult(vi)
}

// videoCoverWidth 视频封面宽度（地图标记用），控制 base64 体积
const videoCoverWidth = 320

// GetVideoThumbnail 返回视频第一帧封面（base64 JPEG），带缓存，地图视频标记用
func (h *Handler) GetVideoThumbnail(userId, videoId string) model.Result {
	cacheKey := "video/" + userId + "/" + videoId
	if v, ok := h.thumbCache.Load(cacheKey); ok {
		return model.NewSuccessResult(map[string]string{"file": v.(string)})
	}

	videoDir := h.cfg.VideoDirPath(userId)
	baseName := util.BaseWithoutExt(videoId)
	pattern := filepath.Join(videoDir, "PM"+baseName+".*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewSuccessResult(map[string]string{"file": ""})
	}

	data, err := service.ExtractVideoFrame(matches[0], 0, videoCoverWidth)
	if err != nil {
		return model.NewSuccessResult(map[string]string{"file": ""})
	}
	b64 := base64.StdEncoding.EncodeToString(data)
	h.thumbCache.Store(cacheKey, b64)
	return model.NewSuccessResult(map[string]string{"file": b64})
}

// GetVideoThumbnails 批量获取视频封面（地图初始化时用），并发受限
func (h *Handler) GetVideoThumbnails(userId string, videoIds []string) model.Result {
	files := make([]string, len(videoIds))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	for i, id := range videoIds {
		wg.Add(1)
		go func(index int, videoId string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			r := h.GetVideoThumbnail(userId, videoId)
			if r.Code == 200 {
				if m, ok := r.Data.(map[string]string); ok {
					files[index] = m["file"]
				}
			}
		}(i, id)
	}
	wg.Wait()
	return model.NewSuccessResult(map[string][]string{"files": files})
}

// GetVideoRange 按字节范围流式返回视频片段（base64），供前端 MediaSource 播放
func (h *Handler) GetVideoRange(userId, videoId string, start, end int64) model.Result {
	videoDir := h.cfg.VideoDirPath(userId)
	baseName := util.BaseWithoutExt(videoId)
	pattern := filepath.Join(videoDir, "PM"+baseName+".*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewFailResult("视频不存在")
	}
	filePath := matches[0]

	info, err := os.Stat(filePath)
	if err != nil {
		return model.NewFailResult("读取视频信息失败")
	}
	if start < 0 || end <= start || end > info.Size() {
		return model.NewFailResult("范围参数不合法")
	}

	f, err := os.Open(filePath)
	if err != nil {
		return model.NewFailResult("打开视频失败")
	}
	defer f.Close()

	// 限制单次最大读取，避免内存过大
	if end-start > 4*1024*1024 {
		end = start + 4*1024*1024
	}

	_, err = f.Seek(start, io.SeekStart)
	if err != nil {
		return model.NewFailResult("定位失败")
	}
	data := make([]byte, end-start)
	if _, err := io.ReadFull(f, data); err != nil {
		return model.NewFailResult("读取失败")
	}

	return model.NewSuccessResult(map[string]interface{}{
		"data":   base64.StdEncoding.EncodeToString(data),
		"start":  start,
		"end":    end,
		"length": info.Size(),
	})
}

// DeleteVideos 删除视频文件
func (h *Handler) DeleteVideos(userId string, videoIds []string) model.Result {
	videoDir := h.cfg.VideoDirPath(userId)
	for _, id := range videoIds {
		baseName := util.BaseWithoutExt(id)
		pattern := filepath.Join(videoDir, "PM"+baseName+".*")
		matches, _ := filepath.Glob(pattern)
		for _, m := range matches {
			os.Remove(m)
		}
	}
	return model.NewSuccessResult("视频删除成功！")
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
