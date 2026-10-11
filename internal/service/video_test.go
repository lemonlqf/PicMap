package service

import (
	"testing"
	"time"
)

func TestParseStartTimeFromName(t *testing.T) {
	cases := []struct {
		name string
		want string // 期望的本地时间串，"" 表示应为 0
	}{
		{"20260820_171710.mp4", "2026-08-20 17:17:10"},
		{"20260820_171710", "2026-08-20 17:17:10"},
		{"2026-08-20_17-17-10.mp4", "2026-08-20 17:17:10"},
		{"2026-08-20 17-17-10.mp4", "2026-08-20 17:17:10"},
		{"20260820171710.mp4", "2026-08-20 17:17:10"},
		{"IMG_20260820_171710.mp4", "2026-08-20 17:17:10"},
		{"VID_20240115_091530.mp4", "2024-01-15 09:15:30"},
		{"randomname.mp4", ""},
		{"video.mov", ""},
		{"99999999_999999.mp4", ""}, // 非法日期
		{"20261332_999999.mp4", ""}, // 非法月份
		{"test.mp4", ""},
	}
	for _, c := range cases {
		ms := ParseStartTimeFromName(c.name)
		if c.want == "" {
			if ms != 0 {
				t.Errorf("%s: 期望 0，得到 %d", c.name, ms)
			}
			continue
		}
		if ms == 0 {
			t.Errorf("%s: 期望解析 %s，得到 0", c.name, c.want)
			continue
		}
		got := time.UnixMilli(ms).Format("2006-01-02 15:04:05")
		if got != c.want {
			t.Errorf("%s: 期望 %s，得到 %s", c.name, c.want, got)
		}
	}
}

func TestParseGpxPoints(t *testing.T) {
	gpx := `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="30.1865" lon="120.1689"><ele>10.5</ele><time>2026-08-20T17:17:00Z</time></trkpt>
      <trkpt lat="30.1870" lon="120.1695"><ele>11.0</ele><time>2026-08-20T17:17:05Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="30.1880" lon="120.1707"><ele>13.0</ele><time>2026-08-20T17:17:15Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`

	pts, err := ParseGpxPoints([]byte(gpx))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(pts) != 3 {
		t.Fatalf("期望 3 个点，得到 %d", len(pts))
	}
	if pts[0].Lat != 30.1865 || pts[0].Lng != 120.1689 {
		t.Errorf("点0坐标错误: %v", pts[0])
	}
	// 时间戳应为 RFC3339 转换后的 epoch ms
	want0 := time.Date(2026, 8, 20, 17, 17, 0, 0, time.UTC).UnixMilli()
	if pts[0].TimeMs != want0 {
		t.Errorf("点0时间错误: 期望 %d，得到 %d", want0, pts[0].TimeMs)
	}
	if pts[2].TimeMs == 0 {
		t.Error("跨 trkseg 的点时间应为非 0")
	}
}
