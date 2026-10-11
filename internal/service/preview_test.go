package service

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	_ "image/jpeg"
	"path/filepath"
	"testing"

	"github.com/disintegration/imaging"
)

// decodePreviewWidth 解出 base64 预览图的实际宽度
func decodePreviewWidth(t *testing.T, b64 string) int {
	t.Helper()
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		t.Fatalf("base64 解码失败: %v", err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("预览图解码失败: %v", err)
	}
	return cfg.Width
}

// 全景预览（待上传）依赖这个行为：目标宽度小于原图时缩到目标宽度，大于原图时不放大
func TestGeneratePreviewBase64WithWidth(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "wide.jpg")
	if err := imaging.Save(imaging.New(1200, 600, color.NRGBA{R: 255, A: 255}), src); err != nil {
		t.Fatalf("构造测试图片失败: %v", err)
	}

	// 小于原图：按目标宽度缩小
	b64, err := GeneratePreviewBase64WithWidth(src, 600)
	if err != nil {
		t.Fatalf("生成预览失败: %v", err)
	}
	if got := decodePreviewWidth(t, b64); got != 600 {
		t.Errorf("目标宽度 600 时应缩到 600，实际 %d", got)
	}

	// 大于原图：不放大（待上传全景图按 4096 目标宽度生成时，小图不应被放大）
	b64, err = GeneratePreviewBase64WithWidth(src, PanoramaPreviewWidth)
	if err != nil {
		t.Fatalf("生成预览失败: %v", err)
	}
	if got := decodePreviewWidth(t, b64); got != 1200 {
		t.Errorf("目标宽度大于原图时应保持原宽 1200，实际 %d", got)
	}
}

// 上传列表预览仍按 PreviewWidth 生成
func TestGeneratePreviewBase64UsesDefaultWidth(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "big.jpg")
	if err := imaging.Save(imaging.New(2000, 1000, color.NRGBA{G: 255, A: 255}), src); err != nil {
		t.Fatalf("构造测试图片失败: %v", err)
	}

	b64, err := GeneratePreviewBase64(src)
	if err != nil {
		t.Fatalf("生成预览失败: %v", err)
	}
	if got := decodePreviewWidth(t, b64); got != PreviewWidth {
		t.Errorf("默认预览宽度应为 %d，实际 %d", PreviewWidth, got)
	}
}
