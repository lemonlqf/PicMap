package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

// toolsDirOnce/toolsDirCached：tools 目录在进程生命周期内不变，查找一次即可，
// 避免每处理一张 HEIC/RAW/视频都全盘回溯 os.Stat。
var (
	toolsDirOnce   sync.Once
	toolsDirCached string
)

func getToolsDir() string {
	toolsDirOnce.Do(func() {
		toolsDirCached = resolveToolsDir()
	})
	return toolsDirCached
}

// resolveToolsDir 依次从 可执行文件目录 与 当前工作目录 向上回溯，查找 tools 目录
func resolveToolsDir() string {
	// 收集所有含 tools 的候选目录
	found := []string{}
	seen := map[string]bool{}
	addCandidates := func(dir string) {
		if dir == "" {
			return
		}
		cur := dir
		for {
			toolsDir := filepath.Join(cur, "tools")
			if _, err := os.Stat(toolsDir); err == nil && !seen[toolsDir] {
				seen[toolsDir] = true
				found = append(found, toolsDir)
			}
			parent := filepath.Dir(cur)
			if parent == cur {
				break
			}
			cur = parent
		}
	}
	if execPath, err := os.Executable(); err == nil {
		addCandidates(filepath.Dir(execPath))
	}
	if cwd, err := os.Getwd(); err == nil {
		addCandidates(cwd)
	}

	// 优先选择包含 ffmpeg 的完整 tools（build/bin 里的 tools 可能只含部分工具）
	for _, d := range found {
		if _, err := os.Stat(filepath.Join(d, "ffmpeg", "ffmpeg.exe")); err == nil {
			return d
		}
	}
	// 否则返回第一个找到的 tools
	if len(found) > 0 {
		return found[0]
	}
	// 兜底：返回 cwd/tools
	cwd, _ := os.Getwd()
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

	// Tier 1: dcraw_emu with -T flag for TIFF output（输出到输入文件同目录，命名 <inputPath>.tiff）
	cmd := exec.Command(dcrawPath, "-T", "-w", "-q", "3", "-fbdd", "1", inputPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("RAW转换失败: %v, output: %s", err, string(output))
	}

	tiffOutput := inputPath + ".tiff"
	defer os.Remove(tiffOutput)

	// Tier 2: Convert TIFF to JPEG
	if _, err := os.Stat(tiffOutput); err != nil {
		return fmt.Errorf("RAW处理完成但未生成输出文件")
	}
	magickPath := filepath.Join(toolsDir, "imagemagick", "magick.exe")
	cmd = exec.Command(magickPath, tiffOutput, "-auto-orient", "-resize", "2048x2048>", "-quality", "85", outputPath)
	output, err = cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("RAW转JPEG失败: %v, output: %s", err, string(output))
	}
	return nil
}


