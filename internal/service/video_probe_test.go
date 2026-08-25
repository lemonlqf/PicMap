package service

import (
	"os"
	"path/filepath"
	"testing"
)

func TestProbeVideo(t *testing.T) {
	path := `C:\Users\450282\Documents\视频\20260820_171710.mp4`
	info, err := ProbeVideo(path)
	if err != nil {
		t.Fatalf("ProbeVideo 失败: %v", err)
	}
	t.Logf("时长=%dms 宽=%d 高=%d", info.DurationMS, info.Width, info.Height)
	if info.DurationMS <= 0 {
		t.Errorf("时长应大于0，得到 %d", info.DurationMS)
	}
	if info.Width != 1920 || info.Height != 1080 {
		t.Errorf("尺寸应为 1920x1080，得到 %dx%d", info.Width, info.Height)
	}
}

func TestProbeVideoGPSAndCreationTime(t *testing.T) {
	// video.mp4 内嵌 GPS 单点 + creation_time
	path := `C:\Users\450282\Documents\视频\video.mp4`
	if !fileExists(path) {
		t.Skip("测试文件不存在")
	}
	info, err := ProbeVideo(path)
	if err != nil {
		t.Fatalf("ProbeVideo 失败: %v", err)
	}
	t.Logf("creationTime=%d hasGPS=%v lat=%f lng=%f duration=%d", info.CreationTime, info.HasGPS, info.GPSLatitude, info.GPSLongitude, info.DurationMS)
	if !info.HasGPS {
		t.Error("video.mp4 应有内嵌 GPS")
	}
	if info.GPSLatitude < 20 || info.GPSLatitude > 40 {
		t.Errorf("纬度应在合理范围，得到 %f", info.GPSLatitude)
	}
	if info.CreationTime == 0 {
		t.Error("video.mp4 应有 creation_time")
	}
	if info.DurationMS <= 0 {
		t.Errorf("时长应大于0，得到 %d", info.DurationMS)
	}
}

func TestParseGPSLocation(t *testing.T) {
	cases := []struct {
		in        string
		wantLat   float64
		wantLng   float64
		wantValid bool
	}{
		{"+30.1864+120.1689/", 30.1864, 120.1689, true},
		{"+30.1864+120.1689/150.5/", 30.1864, 120.1689, true},
		{"", 0, 0, false},
		{"abc", 0, 0, false},
	}
	for _, c := range cases {
		lat, lng := parseGPSLocation(c.in)
		if !c.wantValid {
			if lat != 0 || lng != 0 {
				t.Errorf("%q: 期望无效，得到 %f,%f", c.in, lat, lng)
			}
			continue
		}
		if lat != c.wantLat || lng != c.wantLng {
			t.Errorf("%q: 期望 %f,%f，得到 %f,%f", c.in, c.wantLat, c.wantLng, lat, lng)
		}
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func TestExtractVideoFrame(t *testing.T) {
	// 用不同像素格式的两个视频验证兼容性（yuvj420p 兜底）
	paths := []string{
		`C:\Users\450282\Documents\视频\20260820_171710.mp4`,
		`C:\Users\450282\Documents\视频\video.mp4`,
	}
	found := false
	for _, path := range paths {
		if !fileExists(path) {
			continue
		}
		found = true
		if _, err := os.Stat(filepath.Join(getToolsDir(), "ffmpeg", "ffmpeg.exe")); err != nil {
			t.Skip("找不到 ffmpeg，跳过封面提取测试")
		}
		frame, err := ExtractVideoFrame(path, 0, 0)
		if err != nil {
			t.Fatalf("ExtractVideoFrame(%s) 失败: %v", path, err)
		}
		if len(frame) == 0 {
			t.Errorf("%s: 封面帧数据为空", path)
		}
		// JPEG 魔数（FF D8 FF）
		if len(frame) < 3 || frame[0] != 0xFF || frame[1] != 0xD8 || frame[2] != 0xFF {
			t.Errorf("%s: 首字节应为 JPEG 魔数，得到 % X", path, frame[:3])
		}
	}
	if !found {
		t.Skip("测试视频文件均不存在")
	}
}
