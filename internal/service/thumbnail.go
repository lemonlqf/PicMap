package service

import (
	"bytes"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"golang.org/x/image/bmp"
	"golang.org/x/image/tiff"
	"golang.org/x/image/webp"
)

const (
	ThumbnailWidth  = 1000
	FallbackWidth   = 800
	ThumbnailPrefix = "_THUMBNAIL_PM_"
)

func init() {
	image.RegisterFormat("jpeg", "\xff\xd8", jpeg.Decode, jpeg.DecodeConfig)
	image.RegisterFormat("png", "\x89PNG", png.Decode, png.DecodeConfig)
	image.RegisterFormat("gif", "GIF8", gifDecode, gifDecodeConfig)
	image.RegisterFormat("bmp", "BM", bmp.Decode, bmp.DecodeConfig)
	image.RegisterFormat("webp", "RIFF", webp.Decode, webp.DecodeConfig)
	image.RegisterFormat("tiff", "II*\x00", tiff.Decode, tiff.DecodeConfig)
	image.RegisterFormat("tiff", "MM\x00*", tiff.Decode, tiff.DecodeConfig)
}

func gifDecode(r io.Reader) (image.Image, error) {
	img, _, err := image.Decode(r)
	return img, err
}

func gifDecodeConfig(r io.Reader) (image.Config, error) {
	cfg, _, err := image.DecodeConfig(r)
	return cfg, err
}

func IsSupportedImageFormat(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif":
		return true
	}
	return false
}

func GenerateThumbnail(inputPath, outputDir string) (string, error) {
	src, err := imaging.Open(inputPath, imaging.AutoOrientation(true))
	if err != nil {
		return "", err
	}

	resized := imaging.Resize(src, ThumbnailWidth, 0, imaging.Lanczos)

	baseName := filepath.Base(inputPath)
	thumbName := ThumbnailPrefix + baseName
	outputPath := filepath.Join(outputDir, thumbName)

	ext := strings.ToLower(filepath.Ext(outputPath))
	switch ext {
	case ".png":
		err = imaging.Save(resized, outputPath, imaging.PNGCompressionLevel(png.BestSpeed))
	case ".bmp":
		err = imaging.Save(resized, outputPath)
	default:
		err = imaging.Save(resized, outputPath, imaging.JPEGQuality(80))
	}
	if err != nil {
		return "", err
	}

	return outputPath, nil
}

func ResizeToJPEGBytes(inputPath string, width int) ([]byte, error) {
	src, err := imaging.Open(inputPath, imaging.AutoOrientation(true))
	if err != nil {
		return nil, err
	}

	resized := imaging.Resize(src, width, 0, imaging.Lanczos)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 80}); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}


