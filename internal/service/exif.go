package service

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/tiff"
)

type GPSInfo struct {
	Latitude  float64
	Longitude float64
	Altitude  float64
}

type ExifData struct {
	GPSInfo            GPSInfo
	DateTime           int64
	Make               string
	Model              string
	FNumber            interface{}
	ExposureTime       interface{}
	ISOSpeedRatings    interface{}
	ExposureBiasValue  interface{}
	FocalLength        interface{}
	MaxApertureValue   interface{}
	Artis              string
	SoftWare           string
	PixelXDimension    int64
	PixelYDimension    int64
	BrightnessValue    interface{}
}

type exifWalker struct {
	data *ExifData
}

func (w exifWalker) Walk(name exif.FieldName, tag *tiff.Tag) error {
	switch string(name) {
	case "GPSAltitude":
		if v, ok := ratToFloat(tag); ok && !math.IsNaN(v) && !math.IsInf(v, 0) {
			w.data.GPSInfo.Altitude = v
		}
	case "DateTime", "DateTimeOriginal":
		if w.data.DateTime == 0 {
			if str, err := tag.StringVal(); err == nil {
				w.data.DateTime = exifDateToMillis(str)
			}
		}
	case "Make":
		if str, err := tag.StringVal(); err == nil {
			w.data.Make = str
		}
	case "Model":
		if str, err := tag.StringVal(); err == nil {
			w.data.Model = str
		}
	case "FNumber":
		if v, ok := ratToFloat(tag); ok {
			w.data.FNumber = floatToString(v)
		}
	case "ExposureTime":
		if v, ok := ratToFloat(tag); ok {
			w.data.ExposureTime = floatToString(v)
		}
	case "ISOSpeedRatings":
		if v, err := tag.Int(0); err == nil {
			w.data.ISOSpeedRatings = v
		}
	case "ExposureBiasValue":
		if v, ok := ratToFloat(tag); ok {
			w.data.ExposureBiasValue = floatToString(v)
		}
	case "FocalLength":
		if v, ok := ratToFloat(tag); ok {
			w.data.FocalLength = floatToString(v)
		}
	case "MaxApertureValue":
		if v, ok := ratToFloat(tag); ok {
			w.data.MaxApertureValue = floatToString(v)
		}
	case "Artist":
		if str, err := tag.StringVal(); err == nil {
			w.data.Artis = str
		}
	case "Software":
		if str, err := tag.StringVal(); err == nil {
			w.data.SoftWare = str
		}
	case "PixelXDimension":
		if v, err := tag.Int(0); err == nil {
			w.data.PixelXDimension = int64(v)
		}
	case "PixelYDimension":
		if v, err := tag.Int(0); err == nil {
			w.data.PixelYDimension = int64(v)
		}
	case "ImageWidth":
		if w.data.PixelXDimension == 0 {
			if v, err := tag.Int(0); err == nil {
				w.data.PixelXDimension = int64(v)
			}
		}
	case "ImageLength":
		if w.data.PixelYDimension == 0 {
			if v, err := tag.Int(0); err == nil {
				w.data.PixelYDimension = int64(v)
			}
		}
	case "BrightnessValue":
		if v, ok := ratToFloat(tag); ok {
			w.data.BrightnessValue = floatToString(v)
		}
	}
	return nil
}

func ExtractExif(filePath string) (*ExifData, error) {
	name := filepath.Base(filePath)
	// HEIC/HEIF 必须先转 JPEG（goexif 不支持 ISO BMFF 容器）
	if IsHEICFormat(name) {
		jpegPath, err := convertToTempJPEG(filePath)
		if err != nil {
			return nil, fmt.Errorf("转换图片格式失败: %w", err)
		}
		defer os.Remove(jpegPath)
		return extractExifFromFile(jpegPath)
	}

	// 标准格式与多数 RAW（TIFF 容器）直接解析，避免转码丢失 EXIF
	if data, err := extractExifFromFile(filePath); err == nil {
		return data, nil
	}

	// 直接解析失败（如 CR3 等 ISO BMFF RAW），转 JPEG 后兜底解析
	if NeedsThumbnail(name) {
		jpegPath, err := convertToTempJPEG(filePath)
		if err != nil {
			return nil, fmt.Errorf("转换图片格式失败: %w", err)
		}
		defer os.Remove(jpegPath)
		return extractExifFromFile(jpegPath)
	}

	return nil, fmt.Errorf("解析EXIF失败")
}

func extractExifFromFile(filePath string) (*ExifData, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	x, err := exif.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("解析EXIF失败: %w", err)
	}

	data := &ExifData{}

	// GPS（过滤无效的 NaN/Inf 值）
	if lat, lon, err := x.LatLong(); err == nil {
		if !math.IsNaN(lat) && !math.IsNaN(lon) && !math.IsInf(lat, 0) && !math.IsInf(lon, 0) {
			data.GPSInfo.Latitude = lat
			data.GPSInfo.Longitude = lon
		}
	}

	// 遍历所有 EXIF 字段
	x.Walk(exifWalker{data: data})

	// 拍摄时间兜底
	if data.DateTime == 0 {
		if dt, err := x.DateTime(); err == nil {
			data.DateTime = dt.UnixMilli()
		}
	}

	return data, nil
}

func exifDateToMillis(str string) int64 {
	// str: "2024:06:09 16:15:43" 或 "2024-06-09 16:15:43"
	norm := strings.TrimSpace(str)
	norm = strings.Replace(norm, ":", "-", 2)
	t, err := time.ParseInLocation("2006-01-02 15:04:05", norm, time.Local)
	if err != nil {
		return 0
	}
	return t.UnixMilli()
}

// ratToFloat 安全读取 tag 的 rational 值，分母为 0 或格式不符时返回 false（避免 big.NewRat 除零 panic）
func ratToFloat(tag *tiff.Tag) (float64, bool) {
	num, den, err := tag.Rat2(0)
	if err != nil || den == 0 {
		return 0, false
	}
	return float64(num) / float64(den), true
}

func floatToString(v float64) string {
	// 保留两位小数
	rounded := math.Round(v*100) / 100
	return fmt.Sprintf("%v", rounded)
}

func GetImageTypeByName(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	case ".heic":
		return "image/heic"
	case ".heif":
		return "image/heif"
	case ".cr2":
		return "image/x-canon-cr2"
	case ".cr3":
		return "image/x-canon-cr3"
	case ".nef":
		return "image/x-nikon-nef"
	case ".arw":
		return "image/x-sony-arw"
	case ".raf":
		return "image/x-fujifilm-raf"
	case ".orf":
		return "image/x-olympus-orf"
	case ".dng":
		return "image/x-adobe-dng"
	case ".rw2":
		return "image/x-panasonic-rw2"
	case ".erf":
		return "image/erf"
	case ".gpr":
		return "image/x-gopro-gpr"
	default:
		return "image/" + strings.TrimPrefix(ext, ".")
	}
}

func CalcMBSize(size int64) string {
	if size == 0 {
		return ""
	}
	return fmt.Sprintf("%.2fMB", float64(size)/(1024*1000))
}

func IsRAWFormat(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".cr2", ".cr3", ".nef", ".arw", ".raf", ".orf", ".dng", ".rw2", ".erf", ".gpr":
		return true
	}
	return false
}

func IsHEICFormat(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".heic" || ext == ".heif"
}

func NeedsThumbnail(name string) bool {
	return IsHEICFormat(name) || IsRAWFormat(name)
}
