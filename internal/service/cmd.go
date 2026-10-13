package service

import (
	"context"
	"os/exec"
	"time"

	"picmap-go/internal/util"
)

// 外部命令（ffprobe / ffmpeg / magick / dcraw）的超时设置。
//
// 这些命令在损坏、畸形或网络流输入上可能无限挂起；若不加超时，
// 解析 goroutine 将永久阻塞（并占用并发信号量），最终导致"正在解析…"状态卡死。
// 正常输入下这些命令通常在数秒内完成，取较宽松的上限以避免误杀大文件。
const (
	// probeCommandTimeout ffprobe 探测（仅读元数据，很快）
	probeCommandTimeout = 60 * time.Second
	// convertCommandTimeout 图片/视频转码与帧提取（大图/长视频较慢）
	convertCommandTimeout = 5 * time.Minute
)

// newCommand 创建带超时的外部命令。
// 返回的 cancel 必须由调用方 defer 调用，以释放 context 资源。
// ctx 超时后子进程会被终止（不会残留僵尸进程）。
func newCommand(timeout time.Duration, name string, args ...string) (*exec.Cmd, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	return util.CommandContext(ctx, name, args...), cancel
}
