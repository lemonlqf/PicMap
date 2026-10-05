package handler

import (
	"fmt"
	"image"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"picmap-go/internal/model"
	"picmap-go/internal/service"
	"picmap-go/internal/util"
)

// startMediaStreamServer 启动本地 HTTP 媒体流服务（仅监听 127.0.0.1 随机端口）。
// 支持 HTTP Range，前端可直接把地址交给原生 <video>/<img> 边下边播/加载，避免 base64/桥接开销。
func (h *Handler) startMediaStreamServer() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/video", h.serveVideoRange)
	mux.HandleFunc("/image", h.serveImage)
	srv := &http.Server{Handler: mux}
	h.streamServer = srv
	h.streamBase = fmt.Sprintf("http://127.0.0.1:%d", ln.Addr().(*net.TCPAddr).Port)
	go func() { _ = srv.Serve(ln) }()
}

// StopMediaStreamServer 关闭本地媒体流服务
func (h *Handler) StopMediaStreamServer() {
	if h.streamServer != nil {
		_ = h.streamServer.Close()
		h.streamServer = nil
	}
}

// VideoStreamURL 返回某视频的本地流地址（供前端 <video> 直接播放）
func (h *Handler) VideoStreamURL(userId, videoId string) model.Result {
	if h.streamBase == "" {
		return model.NewFailResult("媒体流服务未启动")
	}
	u := h.streamBase + "/video?userId=" + url.QueryEscape(userId) + "&videoId=" + url.QueryEscape(videoId)
	return model.NewSuccessResult(map[string]string{"url": u})
}

// ImageStreamURL 返回某图片的本地流地址（供前端 <img> 直接加载）。
// kind 取值：thumb（1000px 缩略图，默认）| marker（120px 小图）| full（原图）
func (h *Handler) ImageStreamURL(userId, imageId, kind string) model.Result {
	if h.streamBase == "" {
		return model.NewFailResult("媒体流服务未启动")
	}
	if kind == "" {
		kind = "thumb"
	}
	u := h.streamBase + "/image?userId=" + url.QueryEscape(userId) +
		"&imageId=" + url.QueryEscape(imageId) + "&kind=" + url.QueryEscape(kind)
	return model.NewSuccessResult(map[string]string{"url": u})
}

// serveVideoRange 提供视频字节流（http.ServeContent 自动处理 Range / 断点续传）
func (h *Handler) serveVideoRange(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	videoId := r.URL.Query().Get("videoId")
	if !isSafePathSegment(userId) || !isSafePathSegment(videoId) {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	filePath, err := h.getVideoFilePath(userId, videoId)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	serveFileWithRange(w, r, filePath, contentTypeByExt(filePath))
}

// serveImage 提供图片字节流（按 kind 返回缩略图/小图/原图，http.ServeContent 处理 Range）
func (h *Handler) serveImage(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	imageId := r.URL.Query().Get("imageId")
	kind := r.URL.Query().Get("kind")
	if kind == "" {
		kind = "thumb"
	}
	if !isSafePathSegment(userId) || !isSafePathSegment(imageId) {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if kind != "thumb" && kind != "marker" && kind != "full" && kind != "pano" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	imageDir := h.cfg.ImageDirPath(userId)
	baseName := util.BaseWithoutExt(imageId)

	// 查找缩略图文件与原图路径
	var thumbPath, origPath string
	if matches, _ := filepath.Glob(filepath.Join(imageDir, "_THUMBNAIL_PM"+baseName+"*")); len(matches) > 0 {
		thumbPath = matches[0]
	}
	if matches, _ := filepath.Glob(filepath.Join(imageDir, "PM"+baseName+".*")); len(matches) > 0 {
		origPath = matches[0]
	}

	// full：直接返回原图文件
	if kind == "full" {
		if origPath == "" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		serveFileWithRange(w, r, origPath, contentTypeByExt(origPath))
		return
	}

	// pano：全景预览专用。全景原图（equirectangular）常有上亿像素，
	// 直接把原图交给客户端 WebGL 会因超出纹理尺寸/内存而卡死，
	// 这里按需降采样到 PanoWidth 宽并落盘缓存，客户端拿到即可直接建纹理。
	if kind == "pano" {
		if origPath == "" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		panoPath := filepath.Join(imageDir, panoFileName(baseName))
		if !util.FileExists(panoPath) {
			if err := generatePanoFile(origPath, panoPath); err != nil {
				// 降采样失败时退回原图，至少保证可返回
				serveFileWithRange(w, r, origPath, contentTypeByExt(origPath))
				return
			}
		}
		w.Header().Set("Cache-Control", "private, max-age=86400")
		serveFileWithRange(w, r, panoPath, "image/jpeg")
		return
	}

	// thumb/marker：优先使用已有的缩略图文件（通常为 JPEG，可直接解码）
	srcPath := thumbPath
	if srcPath == "" {
		srcPath = origPath
	}
	if srcPath == "" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	width := service.ThumbnailWidth
	if kind == "marker" {
		width = markerThumbnailWidth
	}

	// 标准格式：直接 resize 后以 JPEG 返回
	if service.IsSupportedImageFormat(srcPath) {
		if data, err := service.ResizeToJPEGBytes(srcPath, width); err == nil {
			serveBytes(w, r, data, "image/jpeg")
			return
		}
		// 解码失败时退回原文件字节
		serveFileWithRange(w, r, srcPath, contentTypeByExt(srcPath))
		return
	}

	// HEIC/RAW 等特殊格式：先转临时 JPEG 再缩略
	if jpegPath, err := service.ConvertToTempJPEG(srcPath); err == nil {
		defer os.Remove(jpegPath)
		if data, err := service.ResizeToJPEGBytes(jpegPath, width); err == nil {
			serveBytes(w, r, data, "image/jpeg")
			return
		}
		serveFileWithRange(w, r, jpegPath, "image/jpeg")
		return
	}

	// 最终兜底：直接返回源文件（浏览器可能不支持该格式）
	serveFileWithRange(w, r, srcPath, contentTypeByExt(srcPath))
}

// PanoWidth 全景预览降采样目标宽度（px）。需明显小于常见 GPU 的 MAX_TEXTURE_SIZE
// （通常 16384），避免客户端为超大全景图分配巨幅 canvas 导致卡死/渲染失败。
const PanoWidth = 8192

func panoFileName(baseName string) string {
	return "_PANO_PM" + baseName + ".jpg"
}

// generatePanoFile 将原图降采样为 JPEG 写入 outPath（先写临时文件再改名，避免并发读到半成品）。
// 小于 PanoWidth 的图不放大。
func generatePanoFile(inputPath, outPath string) error {
	src := inputPath
	// HEIC/RAW 等浏览器无法解码的格式先转 JPEG
	if !service.IsSupportedImageFormat(inputPath) {
		converted, err := service.ConvertToTempJPEG(inputPath)
		if err != nil {
			return err
		}
		defer os.Remove(converted)
		src = converted
	}

	// 仅降采样，避免把小图放大
	targetWidth := PanoWidth
	if f, err := os.Open(src); err == nil {
		if cfg, _, err := image.DecodeConfig(f); err == nil && cfg.Width > 0 && cfg.Width < targetWidth {
			targetWidth = cfg.Width
		}
		f.Close()
	}

	data, err := service.ResizeToJPEGBytes(src, targetWidth)
	if err != nil {
		return err
	}
	tmp := outPath + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, outPath)
}

// serveFileWithRange 使用 http.ServeContent 提供文件服务（自动处理 Range / Last-Modified）
func serveFileWithRange(w http.ResponseWriter, r *http.Request, filePath, contentType string) {
	f, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "open failed", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		http.Error(w, "stat failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", contentType)
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}

// serveBytes 以内存中的字节响应请求（支持 Range，便于 <img> 缓存）
func serveBytes(w http.ResponseWriter, r *http.Request, data []byte, contentType string) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, "", time.Time{}, strings.NewReader(string(data)))
}

// contentTypeByExt 根据扩展名推断 MIME 类型，未知时回退 video/mp4 或 application/octet-stream
func contentTypeByExt(path string) string {
	ct := mime.TypeByExtension(filepath.Ext(path))
	if ct != "" {
		return ct
	}
	return "application/octet-stream"
}

// isSafePathSegment 校验路径片段，防止路径穿越（用户/文件标识不允许分隔符与 ..）
func isSafePathSegment(s string) bool {
	if s == "" || s == "." || s == ".." {
		return false
	}
	if strings.ContainsAny(s, "/\\") || strings.Contains(s, "..") {
		return false
	}
	return true
}
