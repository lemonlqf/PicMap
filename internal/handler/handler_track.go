package handler

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"picmap-go/internal/model"
	"picmap-go/internal/util"
)

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
	// 文件名清洗：去除路径分隔符，避免落到目标目录之外
	trackID := generateID()
	safeName := sanitizeFilename(filepath.Base(fileName))
	outputName := "_TRACK_PM_" + trackID + "_" + safeName
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
	if !isSafeGlobName(fileName) {
		return model.NewFailResult("非法的文件名")
	}
	trackDir := h.cfg.TrackDirPath(userId)
	pattern := filepath.Join(trackDir, "*"+fileName+"*")
	matches, _ := filepath.Glob(pattern)
	for _, m := range matches {
		os.Remove(m)
	}
	return model.NewSuccessResult(map[string]string{"message": "删除成功"})
}

func (h *Handler) GetTrack(userId, fileName string) model.Result {
	if !isSafeGlobName(fileName) {
		return model.NewFailResult("非法的文件名")
	}
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
