package handler

import (
	"path/filepath"

	"picmap-go/internal/model"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ---- Storage (存储目录管理) ----

// GetStorageConfig 返回当前数据目录与备份目录
func (h *Handler) GetStorageConfig() model.Result {
	sc := h.cfg.GetStorageConfig()
	return model.NewSuccessResult(sc)
}

// SelectDirectory 打开系统目录选择框，返回用户选择的目录路径（未选择则返回空）
func (h *Handler) SelectDirectory() model.Result {
	dir, err := runtime.OpenDirectoryDialog(h.ctx, runtime.OpenDialogOptions{
		Title: "选择目录",
	})
	if err != nil {
		return model.NewFailResult("打开目录选择失败: " + err.Error())
	}
	return model.NewSuccessResult(map[string]string{"path": dir})
}

// SelectBackupFile 打开文件选择框选择备份 zip 文件，返回文件路径
func (h *Handler) SelectBackupFile() model.Result {
	file, err := runtime.OpenFileDialog(h.ctx, runtime.OpenDialogOptions{
		Title: "选择备份文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "备份文件 (*.zip)", Pattern: "*.zip"},
		},
	})
	if err != nil {
		return model.NewFailResult("打开文件选择失败: " + err.Error())
	}
	return model.NewSuccessResult(map[string]string{
		"path":     filepath.ToSlash(file),
		"filePath": file,
	})
}

// SetStorageConfig 保存存储目录配置（archiveDir 或 backupDir 可传空，空则保留当前或自动推断）
// 注意：修改目录后需要重启应用生效，数据迁移需用户手动完成
func (h *Handler) SetStorageConfig(archiveDir, backupDir string) model.Result {
	if err := h.cfg.SetStorageConfig(archiveDir, backupDir); err != nil {
		return model.NewFailResult("保存存储配置失败: " + err.Error())
	}
	return model.NewSuccessResult(h.cfg.GetStorageConfig())
}
