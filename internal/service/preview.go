package service

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/disintegration/imaging"
)

const PreviewWidth = 800

// GeneratePreviewBase64 生成图片预览图（JPEG base64）
// 标准格式直接用 imaging 缩略；HEIC/RAW 先经外部工具转 JPEG 再缩略
func GeneratePreviewBase64(inputPath string) (string, error) {
	name := filepath.Base(inputPath)

	if NeedsThumbnail(name) {
		// HEIC/RAW 先转换为 JPEG
		jpegPath, err := convertToTempJPEG(inputPath)
		if err != nil {
			return "", err
		}
		defer os.Remove(jpegPath)
		return resizeToBase64(jpegPath)
	}

	return resizeToBase64(inputPath)
}

// ConvertToTempJPEG 将 HEIC/RAW 转换为临时 JPEG 文件，返回临时文件路径（调用方负责删除）
func ConvertToTempJPEG(inputPath string) (string, error) {
	return convertToTempJPEG(inputPath)
}

func convertToTempJPEG(inputPath string) (string, error) {
	tmpDir, err := os.MkdirTemp("", "picmap-preview-")
	if err != nil {
		return "", err
	}
	outputPath := filepath.Join(tmpDir, "converted.jpg")

	name := filepath.Base(inputPath)
	if IsHEICFormat(name) {
		if err := ConvertHEICToJPEG(inputPath, outputPath); err != nil {
			os.RemoveAll(tmpDir)
			return "", err
		}
		return outputPath, nil
	}

	if IsRAWFormat(name) {
		if err := ConvertRAWToJPEG(inputPath, outputPath); err != nil {
			// 兜底：ImageMagick
			magickPath := filepath.Join(getToolsDir(), "imagemagick", "magick.exe")
			cmd := exec.Command(magickPath, inputPath, "-auto-orient", "-resize", "2048x2048>", outputPath)
			if output, err := cmd.CombinedOutput(); err != nil {
				os.RemoveAll(tmpDir)
				return "", fmt.Errorf("RAW兜底转换失败: %v, output: %s", err, string(output))
			}
		}
		return outputPath, nil
	}

	os.RemoveAll(tmpDir)
	return "", fmt.Errorf("不支持的图片格式: %s", name)
}

func resizeToBase64(inputPath string) (string, error) {
	src, err := imaging.Open(inputPath, imaging.AutoOrientation(true))
	if err != nil {
		return "", err
	}

	resized := imaging.Resize(src, PreviewWidth, 0, imaging.Lanczos)

	tmpFile, err := os.CreateTemp("", "picmap-resize-*.jpg")
	if err != nil {
		return "", err
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	if err := imaging.Save(resized, tmpPath, imaging.JPEGQuality(75)); err != nil {
		return "", err
	}

	data, err := os.ReadFile(tmpPath)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(data), nil
}
