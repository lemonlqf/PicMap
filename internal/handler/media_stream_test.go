package handler

import (
	"net"
	"net/http"
	"testing"
	"time"

	"picmap-go/internal/config"
)

// TestMediaStreamServerStartStop 验证媒体流服务可正常启动、监听 127.0.0.1，并在 Stop 后释放端口
func TestMediaStreamServerStartStop(t *testing.T) {
	h := &Handler{
		cfg:             config.New(),
		thumbCache:      newThumbCacheLRU(8),
		largeThumbCache: newThumbCacheLRU(8),
	}
	h.startMediaStreamServer()
	if h.streamBase == "" {
		t.Fatal("expected streamBase to be set")
	}

	// 服务应可访问（即使返回错误状态码，也说明 HTTP 服务在监听）
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(h.streamBase + "/image?userId=x&imageId=y&kind=thumb")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()

	// 解析出端口，Stop 后应无法再连接
	u := h.streamBase
	addr := u[len("http://"):]
	h.StopMediaStreamServer()
	if h.streamServer != nil {
		t.Fatal("expected streamServer to be nil after stop")
	}

	// 给 OS 一点时间释放监听，随后连接应失败
	deadline := time.Now().Add(2 * time.Second)
	for {
		conn, dialErr := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if dialErr != nil {
			break // 预期：端口已释放
		}
		conn.Close()
		if time.Now().After(deadline) {
			t.Fatal("port still accepting connections after stop")
		}
		time.Sleep(50 * time.Millisecond)
	}
}
