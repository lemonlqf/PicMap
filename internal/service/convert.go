package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func getToolsDir() string {
	execPath, _ := os.Executable()
	execDir := filepath.Dir(execPath)
	toolsDir := filepath.Join(execDir, "tools")
	if _, err := os.Stat(toolsDir); err == nil {
		return toolsDir
	}
	cwd, _ := os.Getwd()
	toolsDir = filepath.Join(cwd, "tools")
	if _, err := os.Stat(toolsDir); err == nil {
		return toolsDir
	}
	return filepath.Join(cwd, "tools")
}

func ConvertHEICToJPEG(inputPath, outputPath string) error {
	toolsDir := getToolsDir()
	magickPath := filepath.Join(toolsDir, "imagemagick", "magick.exe")

	cmd := exec.Command(magickPath, inputPath, "-auto-orient", "-resize", "2048x2048>", outputPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("HEIC转换失败: %v, output: %s", err, string(output))
	}
	return nil
}

func ConvertRAWToJPEG(inputPath, outputPath string) error {
	toolsDir := getToolsDir()
	dcrawPath := filepath.Join(toolsDir, "libraw", "dcraw_emu.exe")

	// Tier 1: dcraw_emu with -T flag for TIFF output
	ext := strings.ToLower(filepath.Ext(inputPath))
	tiffPath := strings.TrimSuffix(outputPath, filepath.Ext(outputPath)) + ".tiff"
	cmd := exec.Command(dcrawPath, "-T", "-w", "-q", "3", "-fbdd", "1", inputPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("RAW转换失败: %v, output: %s", err, string(output))
	}

	// Try to find the generated TIFF
	tiffOutput := strings.TrimSuffix(inputPath, ext) + ".tiff"
	if _, err := os.Stat(tiffOutput); err == nil {
		os.Rename(tiffOutput, tiffPath)
	}

	// Tier 2: Convert TIFF to JPEG
	if _, err := os.Stat(tiffPath); err == nil {
		magickPath := filepath.Join(toolsDir, "imagemagick", "magick.exe")
		cmd := exec.Command(magickPath, tiffPath, "-auto-orient", "-resize", "2048x2048>", "-quality", "85", outputPath)
		cmd.CombinedOutput()
		os.Remove(tiffPath)
		return nil
	}

	_ = tiffPath
	return fmt.Errorf("RAW处理完成但未生成输出文件")
}


