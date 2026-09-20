package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
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
	videoCoverCache *thumbCacheLRU // 视频封面(base64) 缓存，key: userId+"/"+videoId
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
	videoCoverCacheCapacity  = 500
)

func New(cfg *config.Config, ctx context.Context) *Handler {
	h := &Handler{
		cfg:             cfg,
		ctx:             ctx,
		thumbCache:      newThumbCacheLRU(markerThumbCacheCapacity),
		largeThumbCache: newThumbCacheLRU(largeThumbCacheCapacity),
		videoCoverCache: newThumbCacheLRU(videoCoverCacheCapacity),
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

// atomicWrite 原子写入：先写唯一临时文件再重命名替换。
// 使用 os.CreateTemp 保证并发写同一目标时临时文件互不冲突（固定 ".tmp" 名会互相覆盖）。
func (h *Handler) atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	tmp, err := os.CreateTemp(dir, base+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	// 失败路径统一清理临时文件
	defer func() { _ = os.Remove(tmpPath) }()

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
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

// 文件名非法字符（Windows 保留字符 + glob 通配符），包级编译一次
var filenameSanitizer = regexp.MustCompile(`[<>:"/\\|?*\[\]]`)

func sanitizeFilename(name string) string {
	return filenameSanitizer.ReplaceAllString(name, "_")
}

// isSafeGlobName 校验用于 glob 匹配的文件名标识：
// 拒绝空串、路径分隔符、上级目录引用与 glob 通配符，防止越出目标目录或误匹配。
func isSafeGlobName(name string) bool {
	if name == "" || name == "." || name == ".." {
		return false
	}
	if strings.ContainsAny(name, `/\`) || strings.Contains(name, "..") {
		return false
	}
	if strings.ContainsAny(name, "*?[]") {
		return false
	}
	return true
}
