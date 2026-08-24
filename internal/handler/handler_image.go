package handler

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"picmap-go/internal/model"
	"picmap-go/internal/service"
	"picmap-go/internal/util"
)

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
