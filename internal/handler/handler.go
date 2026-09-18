package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"regexp"
	"sync"
	"sync/atomic"

	"picmap-go/internal/config"
)

// Handler 聚合了各 domain 的处理器方法。
// 按业务域拆分在 handler_user.go / handler_image.go / handler_track.go /
// handler_backup.go / handler_video.go 中。
type Handler struct {
	cfg             *config.Config
	ctx             context.Context
	mu              sync.Mutex
	parsing         atomic.Bool
	thumbCache      *thumbCacheLRU // marker 缩略图(base64) 缓存，key: userId+"/"+imageId（120px）
	largeThumbCache *thumbCacheLRU // 普通缩略图(base64) 缓存，key: userId+"/"+imageId（1000px）
	// 本地视频流服务（支持 Range，供原生 <video> 边下边播）
	streamBase   string
	streamServer *http.Server
	// 备份任务状态（支持进度上报与中途取消）
	backupRunning atomic.Bool
	backupCancel  atomic.Bool
}

// 缩略图缓存容量上限（条目数）。marker 图小(120px)可多存，大图(1000px)按估算显存/内存控制。
const (
	markerThumbCacheCapacity = 2000
	largeThumbCacheCapacity  = 300
)

func New(cfg *config.Config, ctx context.Context) *Handler {
	h := &Handler{
		cfg:             cfg,
		ctx:             ctx,
		thumbCache:      newThumbCacheLRU(markerThumbCacheCapacity),
		largeThumbCache: newThumbCacheLRU(largeThumbCacheCapacity),
	}
	h.startMediaStreamServer()
	return h
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
	os.MkdirAll(schemaDir, 0755)
}

func (h *Handler) atomicWrite(path string, data []byte) error {
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

// ---- 公共工具 ----

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
