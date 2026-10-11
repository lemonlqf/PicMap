package handler

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"picmap-go/internal/model"
	"picmap-go/internal/util"
)

// ---- Icon (全局图标库) ----

// 校验图标分类，仅允许 avatar / track
func validIconCategory(category string) bool {
	return category == "avatar" || category == "track"
}

// UploadIcon 上传自定义图标到全局图标库目录
// fileName: 文件名（如 node.png）；category: "avatar" | "track"
func (h *Handler) UploadIcon(fileName, fileData, category string) model.Result {
	if !validIconCategory(category) {
		return model.NewFailResult("无效的图标分类")
	}

	// 解码 base64
	data, err := base64.StdEncoding.DecodeString(fileData)
	if err != nil {
		return model.NewFailResult("解码文件数据失败")
	}

	// 5MB 限制
	if len(data) > 5*1024*1024 {
		return model.NewFailResult("文件大小超过5MB限制")
	}

	// 仅允许图片格式
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".svg", ".webp", ".bmp", ".gif":
	default:
		return model.NewFailResult("仅支持图片格式文件")
	}

	dir := h.cfg.IconDirPath(category)
	if err := util.EnsureDir(dir); err != nil {
		return model.NewFailResult("创建图标目录失败: " + err.Error())
	}

	// 生成唯一文件名，避免重名
	safeName := sanitizeFilename(filepath.Base(fileName))
	outputName := "ICON_PM_" + generateID() + "_" + safeName
	outputPath := filepath.Join(dir, outputName)

	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return model.NewFailResult("保存图标文件失败: " + err.Error())
	}

	// 返回相对路径（icons/<category>/<fileName>）与完整文件名
	relPath := filepath.Join("icons", category, outputName)
	return model.NewSuccessResult(map[string]string{
		"filePath": outputPath,
		"fileName": outputName,
		"relPath":  relPath,
	})
}

// GetIcon 读取图标文件，返回 base64 内容
// fileName: 完整文件名；category: "avatar" | "track"
func (h *Handler) GetIcon(category, fileName string) model.Result {
	if !validIconCategory(category) {
		return model.NewFailResult("无效的图标分类")
	}
	if !isSafeGlobName(fileName) {
		return model.NewFailResult("非法的文件名")
	}
	dir := h.cfg.IconDirPath(category)
	pattern := filepath.Join(dir, "*"+sanitizeFilename(fileName)+"*")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return model.NewFailResult("图标文件不存在")
	}
	data, err := os.ReadFile(matches[0])
	if err != nil {
		return model.NewFailResult("读取图标文件失败")
	}
	return model.NewSuccessResult(map[string]string{
		"file": base64.StdEncoding.EncodeToString(data),
	})
}

// DeleteIcon 删除自定义图标文件
func (h *Handler) DeleteIcon(category, fileName string) model.Result {
	if !validIconCategory(category) {
		return model.NewFailResult("无效的图标分类")
	}
	if !isSafeGlobName(fileName) {
		return model.NewFailResult("非法的文件名")
	}
	dir := h.cfg.IconDirPath(category)
	pattern := filepath.Join(dir, "*"+sanitizeFilename(fileName)+"*")
	matches, _ := filepath.Glob(pattern)
	for _, m := range matches {
		os.Remove(m)
	}
	return model.NewSuccessResult(map[string]string{"message": "删除成功"})
}

// ListIcons 列出指定分类目录下的图标文件
func (h *Handler) ListIcons(category string) model.Result {
	if !validIconCategory(category) {
		return model.NewFailResult("无效的图标分类")
	}
	dir := h.cfg.IconDirPath(category)
	if !util.FileExists(dir) {
		return model.NewSuccessResult([]string{})
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return model.NewFailResult("读取图标目录失败")
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() {
			files = append(files, e.Name())
		}
	}
	return model.NewSuccessResult(files)
}
