package service

import (
	"bytes"
	"image"
	"os"
)

// 全景类型
const (
	PanoramaSpherical   = "spherical"   // 球面/VR 全景（严格 2:1，完整球面）
	PanoramaCylindrical = "cylindrical" // 柱形/环形全景（水平 360°，高度不固定）
)

// xmpHeader XMP 数据在 JPEG APP1 段的标识头（后面紧跟 XML）
var xmpHeader = []byte("http://ns.adobe.com/xap/1.0/\x00")

// IsPanoramaImage 通过 XMP GPano 元数据判断是否为全景 360 图片（equirectangular）
func IsPanoramaImage(inputPath string) bool {
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return false
	}
	idx := bytes.Index(data, xmpHeader)
	if idx < 0 {
		return false
	}
	start := idx + len(xmpHeader)
	// XMP XML 通常不超过 64KB，限制搜索范围
	end := start + 64*1024
	if end > len(data) {
		end = len(data)
	}
	return bytes.Contains(data[start:end], []byte("equirectangular"))
}

// DetectPanorama 检测图片的全景类型
// 优先 XMP GPano 元数据，其次按宽高比兜底：
//   - 比例 ≈ 2:1 → 球面全景
//   - 比例 > 2:1 → 柱形/环形全景
func DetectPanorama(inputPath string) (isPanorama bool, panoType string) {
	// 1. XMP GPano 元数据识别（equirectangular 标记的默认为球面全景）
	if IsPanoramaImage(inputPath) {
		return true, PanoramaSpherical
	}

	// 2. 按宽高比兜底判断
	width, height := getImageDimensions(inputPath)
	if width > 0 && height > 0 {
		ratio := float64(width) / float64(height)
		if ratio >= 1.9 && ratio <= 2.1 {
			return true, PanoramaSpherical
		}
		if ratio > 2.1 {
			return true, PanoramaCylindrical
		}
	}

	return false, ""
}

// getImageDimensions 读取图片宽高（仅标准格式，HEIC/RAW 需先转码）
func getImageDimensions(inputPath string) (int, int) {
	f, err := os.Open(inputPath)
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return 0, 0
	}
	return cfg.Width, cfg.Height
}
