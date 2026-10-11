package service

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"

	"picmap-go/internal/util"
)

const PreviewWidth = 800

// PanoramaPreviewWidth 待上传全景图的预览宽度。
// 全景图（等距柱状投影）在查看器里是整颗球面的纹理，用上传列表的 800px 缩略图会被拉伸得
// 非常模糊；而已上传的全景走媒体流服务按 8192 降采样，待上传图片还不在用户目录里、只能走
// base64 回传，这里取 4096 作为折中：像素量是 800px 的 25 倍，全屏观看足够清晰，桥接体积仍可控。
const PanoramaPreviewWidth = 4096

// GeneratePreviewBase64 生成图片预览图（JPEG base64）
// 标准格式直接用 imaging 缩略；HEIC/RAW 先经外部工具转 JPEG 再缩略
func GeneratePreviewBase64(inputPath string) (string, error) {
	return GeneratePreviewBase64WithWidth(inputPath, PreviewWidth)
}

// GeneratePreviewBase64WithWidth 按指定宽度上限生成图片预览（JPEG base64）
// 仅当原图更宽时缩小，不做放大
func GeneratePreviewBase64WithWidth(inputPath string, width int) (string, error) {
	name := filepath.Base(inputPath)

	if NeedsThumbnail(name) {
		// HEIC/RAW 先转换为 JPEG
		jpegPath, err := convertToTempJPEG(inputPath)
		if err != nil {
			return "", err
		}
		defer os.Remove(jpegPath)
		return resizeToBase64(jpegPath, width)
	}

	return resizeToBase64(inputPath, width)
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
			cmd := util.Command(magickPath, inputPath, "-auto-orient", "-resize", "2048x2048>", outputPath)
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

func resizeToBase64(inputPath string, width int) (string, error) {
	src, err := imaging.Open(inputPath, imaging.AutoOrientation(true))
	if err != nil {
		return "", err
	}

	resized := src
	if width > 0 && src.Bounds().Dx() > width {
		resized = imaging.Resize(src, width, 0, imaging.Lanczos)
	}

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
