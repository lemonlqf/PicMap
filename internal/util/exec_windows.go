//go:build windows

package util

import (
	"context"
	"os/exec"
	"syscall"
)

// createNoWindow 对应 Windows 的 CREATE_NO_WINDOW 创建标志
const createNoWindow = 0x08000000

// HideConsole 让外部命令在 Windows 上不弹出控制台窗口。
//
// 打包后的 picmap.exe 是 GUI 子系统（-H windowsgui），进程本身没有控制台；
// 而 ffprobe / ffmpeg / magick / dcraw 都是控制台子系统程序，此时 Windows 会为子进程
// 新建一个控制台窗口，表现为：上传视频（ffprobe 探测 + ffmpeg 取封面帧）或上传
// HEIC/RAW（magick / dcraw 转码）时弹出黑框终端。
//
// 加上 CREATE_NO_WINDOW（并保留 HideWindow）后子进程无窗口运行，仅保留标准输出/错误管道，
// 调用方仍可通过 cmd.Output() / CombinedOutput() 读取结果。
func HideConsole(cmd *exec.Cmd) {
	if cmd == nil {
		return
	}
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= createNoWindow
}

// Command 创建外部命令，并保证在 Windows 上不会弹出控制台窗口。
//
// 调用外部程序（ffmpeg / ffprobe / magick / dcraw 等）一律走这里，
// 不要直接使用 os/exec.Command —— 漏掉一处就会在上传视频或 HEIC/RAW 时弹出黑框终端。
// internal/util 之外的 Go 文件若直接调用 os/exec，会被 exec_guard_test.go 拦下。
func Command(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	HideConsole(cmd)
	return cmd
}

// CommandContext 与 Command 等价，但绑定了 context：
// ctx 取消/超时后会终止子进程（含其子进程树），避免 ffprobe/ffmpeg 等在
// 损坏或畸形输入上无限挂起，导致解析 goroutine 永久阻塞。
func CommandContext(ctx context.Context, name string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, name, args...)
	HideConsole(cmd)
	return cmd
}
