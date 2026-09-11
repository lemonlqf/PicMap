package handler

import (
	"fmt"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"picmap-go/internal/model"
	"picmap-go/internal/util"
)

// startVideoStreamServer 启动本地 HTTP 视频流服务（仅监听 127.0.0.1 随机端口）。
// 支持 HTTP Range，前端可直接把地址交给原生 <video> 边下边播，避免 base64/桥接开销。
func (h *Handler) startVideoStreamServer() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/video", h.serveVideoRange)
	srv := &http.Server{Handler: mux}
	h.streamServer = srv
	h.streamBase = fmt.Sprintf("http://127.0.0.1:%d", ln.Addr().(*net.TCPAddr).Port)
	go func() { _ = srv.Serve(ln) }()
}

// StopVideoStreamServer 关闭本地视频流服务
func (h *Handler) StopVideoStreamServer() {
	if h.streamServer != nil {
		_ = h.streamServer.Close()
		h.streamServer = nil
	}
}

// VideoStreamURL 返回某视频的本地流地址（供前端 <video> 直接播放）
func (h *Handler) VideoStreamURL(userId, videoId string) model.Result {
	if h.streamBase == "" {
		return model.NewFailResult("视频流服务未启动")
	}
	u := h.streamBase + "/video?userId=" + url.QueryEscape(userId) + "&videoId=" + url.QueryEscape(videoId)
	return model.NewSuccessResult(map[string]string{"url": u})
}

// serveVideoRange 提供视频字节流（http.ServeContent 自动处理 Range / 断点续传）
func (h *Handler) serveVideoRange(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	videoId := r.URL.Query().Get("videoId")
	if userId == "" || videoId == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	videoDir := h.cfg.VideoDirPath(userId)
	baseName := util.BaseWithoutExt(videoId)
	pattern := filepath.Join(videoDir, "PM"+baseName+".*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	filePath := matches[0]
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
	// 允许跨源媒体加载（Wails 页面源与 127.0.0.1 不同源）
	w.Header().Set("Access-Control-Allow-Origin", "*")
	contentType := mime.TypeByExtension(filepath.Ext(filePath))
	if contentType == "" {
		contentType = "video/mp4"
	}
	w.Header().Set("Content-Type", contentType)
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}
