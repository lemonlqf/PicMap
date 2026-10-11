package util

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// 直接调用 os/exec 的写法（含带 context 的变体）
var directExecRe = regexp.MustCompile(`\bexec\.Command(Context)?\(`)

// skipDirs 不参与扫描的目录
var skipDirs = map[string]bool{
	"node_modules": true,
	"vendor":       true,
	".git":         true,
	"dist":         true,
	"build":        true,
	"tools":        true,
}

// TestNoDirectExecCommand 守住"外部命令必须走 util.Command"这条约定。
//
// 打包后的 picmap.exe 是 GUI 子系统、没有可继承的控制台，直接 exec 控制台程序
// （ffmpeg / ffprobe / magick / dcraw …）会让 Windows 新建一个控制台窗口，
// 表现为上传视频或 HEIC/RAW 时弹出黑框。这类问题单元测试抓不到，只能靠约定 + 本测试拦截。
//
// 该测试失败时的正确处理：把对应调用改成 util.Command(name, args...)，不要放宽这个测试。
func TestNoDirectExecCommand(t *testing.T) {
	root := filepath.Join("..", "..") // internal/util -> 仓库根目录
	if _, err := os.Stat(filepath.Join(root, "go.mod")); err != nil {
		t.Skipf("找不到仓库根目录（%s），跳过源码扫描", root)
	}

	selfDir := filepath.Clean(filepath.Join(root, "internal", "util"))
	var offenders []string

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if skipDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		// 本包负责实现 util.Command，允许直接使用 os/exec
		if filepath.Clean(filepath.Dir(path)) == selfDir {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if directExecRe.Match(data) {
			rel, relErr := filepath.Rel(root, path)
			if relErr != nil {
				rel = path
			}
			offenders = append(offenders, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		t.Fatalf("扫描源码失败: %v", err)
	}

	if len(offenders) > 0 {
		t.Fatalf("以下文件直接使用了 os/exec，会弹出控制台窗口，请改用 util.Command：\n  - %s",
			strings.Join(offenders, "\n  - "))
	}
}
