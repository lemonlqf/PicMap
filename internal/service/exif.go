package service

import (
	"fmt"
	"math"
	"math/big"
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
		if rat, err := tag.Rat(0); err == nil {
			w.data.GPSInfo.Altitude = ratFloat(rat)
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
		if rat, err := tag.Rat(0); err == nil {
			w.data.FNumber = ratString(rat)
		}
	case "ExposureTime":
		if rat, err := tag.Rat(0); err == nil {
			w.data.ExposureTime = ratString(rat)
		}
	case "ISOSpeedRatings":
		if v, err := tag.Int(0); err == nil {
			w.data.ISOSpeedRatings = v
		}
	case "ExposureBiasValue":
		if rat, err := tag.Rat(0); err == nil {
			w.data.ExposureBiasValue = ratString(rat)
		}
	case "FocalLength":
		if rat, err := tag.Rat(0); err == nil {
			w.data.FocalLength = ratString(rat)
		}
	case "MaxApertureValue":
		if rat, err := tag.Rat(0); err == nil {
			w.data.MaxApertureValue = ratString(rat)
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
		if rat, err := tag.Rat(0); err == nil {
			w.data.BrightnessValue = ratString(rat)
		}
	}
	return nil
}

func ExtractExif(filePath string) (*ExifData, error) {
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

	// GPS
	if lat, lon, err := x.LatLong(); err == nil {
		data.GPSInfo.Latitude = lat
		data.GPSInfo.Longitude = lon
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

func ratFloat(r *big.Rat) float64 {
	f, _ := r.Float64()
	return f
}

func ratString(r *big.Rat) string {
	v, _ := r.Float64()
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
