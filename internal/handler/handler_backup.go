package handler

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"picmap-go/internal/config"
	"picmap-go/internal/model"
	"picmap-go/internal/util"
)

// 备份事件名
const (
	EventBackupProgress  = "backup-progress"  // 备份进度
	EventBackupDone      = "backup-done"      // 备份完成（成功/失败/取消）
	EventRestoreProgress = "restore-progress" // 恢复进度
)

var errBackupCancelled = errors.New("backup cancelled")

// restoreProgress 统计恢复（解压/合并）进度，并按整数百分比节流上报，
// 避免大备份逐块回调时事件过多。
type restoreProgress struct {
	h         *Handler
	total     int64
	processed int64
	lastPct   int
}

func newRestoreProgress(h *Handler) *restoreProgress {
	return &restoreProgress{h: h, lastPct: -1}
}

func (p *restoreProgress) percent() int {
	if p.total <= 0 {
		return 0
	}
	pct := int(p.processed * 100 / p.total)
	if pct > 100 {
		pct = 100
	}
	return pct
}

func (p *restoreProgress) emit() {
	runtime.EventsEmit(p.h.ctx, EventRestoreProgress, map[string]interface{}{
		"processed": p.processed,
		"total":     p.total,
		"percent":   p.percent(),
	})
}

// setTotal 设置总字节数并立即上报一次（0%）
func (p *restoreProgress) setTotal(total int64) {
	p.total = total
	p.lastPct = -1
	p.emit()
	p.lastPct = p.percent()
}

// add 累加已处理字节，百分比变化时才上报
func (p *restoreProgress) add(n int64) {
	p.processed += n
	if pct := p.percent(); pct != p.lastPct {
		p.lastPct = pct
		p.emit()
	}
}

// finish 结束时确保上报到 100%
func (p *restoreProgress) finish() {
	if p.processed < p.total {
		p.processed = p.total
	}
	p.emit()
}

// progressReader 在读取时回调已读字节数，用于统计解压进度
type progressReader struct {
	r      io.Reader
	onRead func(int64)
}

func (p *progressReader) Read(b []byte) (int, error) {
	n, err := p.r.Read(b)
	if n > 0 && p.onRead != nil {
		p.onRead(int64(n))
	}
	return n, err
}

// ---- Backup ----

// CreateBackup 启动备份任务（异步执行，进度经 backup-progress 事件推送，完成后发 backup-done）
func (h *Handler) CreateBackup(name string) model.Result {
	if h.backupRunning.Load() {
		return model.NewFailResult("正在创建备份，请稍候")
	}
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

	h.backupCancel.Store(false)
	h.backupRunning.Store(true)
	go h.runCreateBackup(outputPath, fileName, totalSize)

	return model.NewSuccessResult(map[string]interface{}{
		"filePath":    outputPath,
		"fileName":    fileName,
		"size":        totalSize,
		"sizeWarning": sizeWarning,
		"started":     true,
	})
}

// CancelBackup 取消正在进行的备份任务
func (h *Handler) CancelBackup() model.Result {
	if !h.backupRunning.Load() {
		return model.NewSuccessResult("没有正在进行的备份")
	}
	h.backupCancel.Store(true)
	return model.NewSuccessResult("正在取消")
}

// runCreateBackup 执行备份并推送进度/结果事件
func (h *Handler) runCreateBackup(outputPath, fileName string, totalSize int64) {
	defer h.backupRunning.Store(false)
	err := h.createZipWithProgress(outputPath, totalSize)
	if err != nil {
		// 失败或取消：清理半成品
		_ = os.Remove(outputPath)
		if errors.Is(err, errBackupCancelled) {
			runtime.EventsEmit(h.ctx, EventBackupDone, map[string]interface{}{
				"success":   false,
				"cancelled": true,
			})
		} else {
			runtime.EventsEmit(h.ctx, EventBackupDone, map[string]interface{}{
				"success": false,
				"message": err.Error(),
			})
		}
		return
	}
	runtime.EventsEmit(h.ctx, EventBackupDone, map[string]interface{}{
		"success":  true,
		"fileName": fileName,
		"filePath": outputPath,
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

// calcDataSize 单次遍历数据目录统计总字节数。
// 使用 WalkDir 的 DirEntry.Info()（Windows 下直接携带大小）避免每个文件额外 Stat，
// 并跳过备份目录自身，防止把历史备份算入体积。
func (h *Handler) calcDataSize() int64 {
	archiveDir := h.cfg.ArchiveDir()
	backupDir := filepath.Clean(h.cfg.BackupDir())

	var totalSize int64
	_ = filepath.WalkDir(archiveDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			// 单个条目不可访问时跳过，不中断整体统计
			if d != nil && d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		// 备份目录若位于数据目录内，需跳过（不属于用户数据）
		if d.IsDir() {
			if filepath.Clean(path) == backupDir {
				return filepath.SkipDir
			}
			return nil
		}
		if info, infoErr := d.Info(); infoErr == nil {
			totalSize += info.Size()
		}
		return nil
	})
	return totalSize
}

// createZipWithProgress 打包数据目录，按已处理字节上报进度，并在取消时返回 errBackupCancelled
func (h *Handler) createZipWithProgress(outputPath string, totalSize int64) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	w := zip.NewWriter(file)

	var processed int64
	// 上报进度；返回 false 表示已请求取消
	report := func() bool {
		percent := 0
		if totalSize > 0 {
			percent = int(processed * 100 / totalSize)
			if percent > 100 {
				percent = 100
			}
		}
		runtime.EventsEmit(h.ctx, EventBackupProgress, map[string]interface{}{
			"processed": processed,
			"total":     totalSize,
			"percent":   percent,
		})
		return !h.backupCancel.Load()
	}

	// 流式写入：按 1MB 分块 io.Copy，避免大视频/大图整文件读入内存导致 OOM。
	// 使用 Store（不压缩）：媒体文件（JPEG/MP4 等）本身已压缩，再 Deflate 徒增 CPU 且几乎无收益。
	addFile := func(path, zipName string) error {
		if !report() {
			return errBackupCancelled
		}
		src, openErr := os.Open(path)
		if openErr != nil {
			return openErr
		}
		defer src.Close()

		info, statErr := src.Stat()
		if statErr != nil {
			return statErr
		}

		fw, createErr := w.CreateHeader(&zip.FileHeader{
			Name:   zipName,
			Method: zip.Store,
			// 保留源文件修改时间（与归档时间一致，便于恢复后比对）
			Modified: info.ModTime(),
		})
		if createErr != nil {
			return createErr
		}

		// 分块拷贝，边写边按已处理字节上报进度并在取消时中断
		buf := make([]byte, 1<<20) // 1MB
		for {
			if !report() {
				return errBackupCancelled
			}
			n, readErr := src.Read(buf)
			if n > 0 {
				if _, writeErr := fw.Write(buf[:n]); writeErr != nil {
					return writeErr
				}
				processed += int64(n)
			}
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				return readErr
			}
		}
		return nil
	}

	// appSchema.json
	if err := addFile(h.cfg.AppSchemaPath(), config.AppSchemaFileName); err != nil {
		_ = w.Close()
		return err
	}

	// 用户目录
	entries, _ := os.ReadDir(h.cfg.ArchiveDir())
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		userDir := filepath.Join(h.cfg.ArchiveDir(), e.Name())
		prefix := e.Name() + "/"
		var walkErr error
		filepath.WalkDir(userDir, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() || walkErr != nil {
				return nil
			}
			relPath, _ := filepath.Rel(userDir, path)
			// zip 条目统一正斜杠（与 Node 版 archiver 输出一致）
			relPath = strings.ReplaceAll(relPath, "\\", "/")
			if e := addFile(path, prefix+relPath); e != nil {
				walkErr = e
				return e
			}
			return nil
		})
		if walkErr != nil {
			_ = w.Close()
			return walkErr
		}
	}

	return w.Close()
}

func (h *Handler) importCover(filePath string) model.Result {
	// 先解压到临时目录，全部成功后再原子替换，避免 zip 损坏导致现有数据丢失
	tmpRoot, err := os.MkdirTemp(filepath.Dir(h.cfg.ArchiveDir()), "picmap-restore-")
	if err != nil {
		return model.NewFailResult("创建临时目录失败: " + err.Error())
	}
	// 失败时清理临时目录；成功替换后 tmpRoot 已被移走，RemoveAll 无害
	defer os.RemoveAll(tmpRoot)

	rp := newRestoreProgress(h)
	if err := extractZipTo(filePath, tmpRoot, rp); err != nil {
		return model.NewFailResult("解压备份失败，已保留原有数据: " + err.Error())
	}
	rp.finish()

	// 备份数据至少应包含 appSchema.json 或任一用户目录，防止空 zip 覆盖有效数据
	if !util.FileExists(filepath.Join(tmpRoot, config.AppSchemaFileName)) && !hasSubDir(tmpRoot) {
		return model.NewFailResult("备份文件内容为空或格式不正确，已保留原有数据")
	}

	// 原子替换：先把现有数据目录改名为 .bak，再将临时目录改名为正式目录，
	// 任一步失败则回滚，确保任一时刻都有可用的数据目录
	archiveDir := h.cfg.ArchiveDir()
	bakDir := archiveDir + ".bak_" + time.Now().Format("20060102150405")
	os.RemoveAll(bakDir)

	renamedOld := false
	if util.FileExists(archiveDir) {
		if err := os.Rename(archiveDir, bakDir); err != nil {
			return model.NewFailResult("替换数据目录失败: " + err.Error())
		}
		renamedOld = true
	}
	if err := os.Rename(tmpRoot, archiveDir); err != nil {
		// 回滚：恢复原数据目录
		if renamedOld {
			_ = os.Rename(bakDir, archiveDir)
		}
		return model.NewFailResult("替换数据目录失败: " + err.Error())
	}
	// 替换成功，删除旧数据备份
	if renamedOld {
		_ = os.RemoveAll(bakDir)
	}

	// Re-initialize
	h.cfg.Init()
	return model.NewSuccessResult("导入成功")
}

// extractZipTo 将 zip 内容安全解压到目标目录（校验路径，防止 zip slip 穿越），
// 并通过 rp 上报解压进度（rp 可为 nil）
func extractZipTo(filePath, destDir string, rp *restoreProgress) error {
	reader, err := zip.OpenReader(filePath)
	if err != nil {
		return err
	}
	defer reader.Close()

	if rp != nil {
		var total int64
		for _, f := range reader.File {
			if !f.FileInfo().IsDir() {
				total += int64(f.UncompressedSize64)
			}
		}
		rp.setTotal(total)
	}

	os.MkdirAll(destDir, 0755)
	for _, f := range reader.File {
		// zip 条目可能含正斜杠，filepath.Join 在 Windows 会归一化处理
		relName := strings.ReplaceAll(f.Name, "\\", "/")
		targetPath := filepath.Join(destDir, filepath.FromSlash(relName))
		// 防止 ../../ 路径穿越到目标目录之外
		if rel, err := filepath.Rel(destDir, targetPath); err != nil || strings.HasPrefix(rel, "..") {
			return errors.New("备份文件包含非法路径: " + f.Name)
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(targetPath, 0755)
			continue
		}
		os.MkdirAll(filepath.Dir(targetPath), 0755)
		rc, err := f.Open()
		if err != nil {
			return err
		}
		outFile, err := os.Create(targetPath)
		if err != nil {
			rc.Close()
			return err
		}
		var src io.Reader = rc
		if rp != nil {
			src = &progressReader{r: rc, onRead: rp.add}
		}
		_, copyErr := io.Copy(outFile, src)
		rc.Close()
		outFile.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

// hasSubDir 判断目录下是否存在子目录
func hasSubDir(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if e.IsDir() {
			return true
		}
	}
	return false
}

func (h *Handler) importMerge(filePath string) model.Result {
	reader, err := zip.OpenReader(filePath)
	if err != nil {
		return model.NewFailResult("读取备份文件失败: " + err.Error())
	}
	defer reader.Close()

	// 统计需要复制的文件总字节数，用于上报进度
	rp := newRestoreProgress(h)
	var total int64
	for _, f := range reader.File {
		if f.FileInfo().IsDir() || f.Name == config.AppSchemaFileName {
			continue
		}
		relName := strings.ReplaceAll(f.Name, "\\", "/")
		if util.FileExists(filepath.Join(h.cfg.ArchiveDir(), filepath.FromSlash(relName))) {
			continue
		}
		total += int64(f.UncompressedSize64)
	}
	rp.setTotal(total)

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
		io.Copy(outFile, &progressReader{r: rc, onRead: rp.add})
		rc.Close()
		outFile.Close()
	}
	rp.finish()

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
