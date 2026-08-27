package handler

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"picmap-go/internal/model"
	"picmap-go/internal/service"
	"picmap-go/internal/util"
)

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
		// 内嵌 GPS 单点（WGS84 → GCJ02，与图片一致）
		if pinfo.HasGPS {
			item.HasGpsData = true
			gcLat, gcLon := util.WGS84toGCJ02(pinfo.GPSLatitude, pinfo.GPSLongitude)
			item.GPSLatitude = gcLat
			item.GPSLongitude = gcLon
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
			gcLat, gcLon := util.WGS84toGCJ02(p.GPSLatitude, p.GPSLongitude)
			vi.GPSLatitude = gcLat
			vi.GPSLongitude = gcLon
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

// getVideoFilePath 根据 videoId 定位用户视频目录下的视频文件（匹配 PM{id}.{ext}）
func (h *Handler) getVideoFilePath(userId, videoId string) (string, error) {
	videoDir := h.cfg.VideoDirPath(userId)
	baseName := util.BaseWithoutExt(videoId)
	pattern := filepath.Join(videoDir, "PM"+baseName+".*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return "", fmt.Errorf("视频不存在")
	}
	return matches[0], nil
}

// GetVideoThumbnail 返回视频第一帧封面（base64 JPEG）。提取失败返回 500。
func (h *Handler) GetVideoThumbnail(userId, videoId string) model.Result {
	filePath, err := h.getVideoFilePath(userId, videoId)
	if err != nil {
		return model.NewFailResult(err.Error())
	}
	frame, err := service.ExtractVideoFrame(filePath, 0, 0)
	if err != nil {
		return model.NewFailResult("封面提取失败: " + err.Error())
	}
	return model.NewSuccessResult(map[string]interface{}{
		"file": base64.StdEncoding.EncodeToString(frame),
	})
}

// GetVideoThumbnails 批量返回视频第一帧封面（base64 JPEG），按 videoId 映射返回。
func (h *Handler) GetVideoThumbnails(userId string, videoIds []string) model.Result {
	res := make(map[string]string, len(videoIds))
	for _, id := range videoIds {
		filePath, err := h.getVideoFilePath(userId, id)
		if err != nil {
			continue
		}
		frame, err := service.ExtractVideoFrame(filePath, 0, 0)
		if err != nil {
			continue
		}
		res[id] = base64.StdEncoding.EncodeToString(frame)
	}
	return model.NewSuccessResult(map[string]interface{}{
		"files": res,
	})
}

// GetVideoFramePreview 从任意路径提取视频第一帧封面（base64 JPEG）。
// 用于待上传视频（尚未复制到用户目录）的封面预览。提取失败返回 500。
func (h *Handler) GetVideoFramePreview(path string) model.Result {
	if path == "" {
		return model.NewFailResult("视频路径为空")
	}
	if _, err := os.Stat(path); err != nil {
		return model.NewFailResult("视频源文件不存在")
	}
	frame, err := service.ExtractVideoFrame(path, 0, 0)
	if err != nil {
		return model.NewFailResult("封面提取失败: " + err.Error())
	}
	return model.NewSuccessResult(map[string]interface{}{
		"file": base64.StdEncoding.EncodeToString(frame),
	})
}
