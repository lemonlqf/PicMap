//go:build windows

package util

import (
	"os/exec"
	"syscall"
	"testing"
)

func TestHideConsoleSetsNoWindow(t *testing.T) {
	cmd := exec.Command("cmd.exe", "/c", "echo", "hi")
	HideConsole(cmd)

	if cmd.SysProcAttr == nil {
		t.Fatal("SysProcAttr 未设置")
	}
	if !cmd.SysProcAttr.HideWindow {
		t.Error("HideWindow 未开启，仍可能弹出窗口")
	}
	if cmd.SysProcAttr.CreationFlags&createNoWindow == 0 {
		t.Errorf("缺少 CREATE_NO_WINDOW 标志，CreationFlags=%#x", cmd.SysProcAttr.CreationFlags)
	}
}

func TestHideConsoleKeepsExistingFlags(t *testing.T) {
	const other = 0x00000400 // 任意已有标志
	cmd := exec.Command("cmd.exe")
	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.CreationFlags = other

	HideConsole(cmd)
	HideConsole(cmd) // 幂等

	if cmd.SysProcAttr.CreationFlags&other == 0 {
		t.Error("覆盖了调用方已有的 CreationFlags")
	}
	if cmd.SysProcAttr.CreationFlags&createNoWindow == 0 {
		t.Error("重复调用后 CREATE_NO_WINDOW 丢失")
	}
}

func TestHideConsoleNilSafe(t *testing.T) {
	HideConsole(nil) // 不应 panic
}
