package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rwcarlsen/goexif/exif"
)

type GPSInfo struct {
	Latitude  float64
	Longitude float64
	Altitude  float64
}

func ExtractGPS(filePath string) (*GPSInfo, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	x, err := exif.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("解析EXIF失败: %w", err)
	}

	lat, lon, err := x.LatLong()
	if err != nil {
		return nil, fmt.Errorf("未找到GPS信息: %w", err)
	}

	return &GPSInfo{
		Latitude:  lat,
		Longitude: lon,
		Altitude:  0,
	}, nil
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
