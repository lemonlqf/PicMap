//go:build !windows

package util

import (
	"context"
	"os/exec"
)

// HideConsole 非 Windows 平台无需处理（空实现，保持调用点跨平台可编译）
func HideConsole(cmd *exec.Cmd) {}

// Command 创建外部命令（非 Windows 平台无窗口概念，等价于 os/exec.Command）
func Command(name string, args ...string) *exec.Cmd {
	return exec.Command(name, args...)
}

// CommandContext 与 Command 等价，但绑定 context：ctx 取消/超时后终止子进程。
func CommandContext(ctx context.Context, name string, args ...string) *exec.Cmd {
	return exec.CommandContext(ctx, name, args...)
}
