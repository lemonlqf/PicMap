package util

import (
	"os"
	"path/filepath"
	"strings"
)

func Glob(pattern string) ([]string, error) {
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return nil, err
	}
	return matches, nil
}

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func JoinPath(elem ...string) string {
	return filepath.Join(elem...)
}

func Dir(path string) string {
	return filepath.Dir(path)
}

func Base(path string) string {
	return filepath.Base(path)
}

func Ext(path string) string {
	return filepath.Ext(path)
}

func BaseWithoutExt(path string) string {
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	return strings.TrimSuffix(base, ext)
}

func IsImageFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
		".heic", ".heif", ".cr2", ".cr3", ".nef", ".arw",
		".raf", ".orf", ".dng", ".rw2", ".erf", ".gpr":
		return true
	}
	return false
}
