package service

import (
	"os"
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
