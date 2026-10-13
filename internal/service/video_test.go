package service

import (
	"testing"
	"time"
)

func TestParseStartTimeFromName(t *testing.T) {
	// 文件名时间为不带时区的墙钟时间，按传入的时区偏移解释（此处用东八区 +480）
	const offset = 480
	cases := []struct {
		name string
		want string // 期望的墙钟时间串，"" 表示应为 0
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
	loc := time.FixedZone("", offset*60)
	for _, c := range cases {
		ms := ParseStartTimeFromName(c.name, offset)
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
		got := time.UnixMilli(ms).In(loc).Format("2006-01-02 15:04:05")
		if got != c.want {
			t.Errorf("%s: 期望 %s，得到 %s", c.name, c.want, got)
		}
	}
}

// TestParseStartTimeFromNameTimezone 验证同一文件名在不同时区下解析出的绝对时刻不同
func TestParseStartTimeFromNameTimezone(t *testing.T) {
	name := "20260820_171710.mp4"
	msEast := ParseStartTimeFromName(name, 480)  // 东八区 17:17:10 = UTC 09:17:10
	msUtc := ParseStartTimeFromName(name, 0)     // UTC 17:17:10
	if msEast == 0 || msUtc == 0 {
		t.Fatal("解析失败")
	}
	// 东八区解释出的绝对时刻应比 UTC 解释早 8 小时
	if diff := msUtc - msEast; diff != 8*3600*1000 {
		t.Errorf("东八区与 UTC 差异应为 8 小时，得到 %d 毫秒", diff)
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

	pts, err := ParseGpxPoints([]byte(gpx), 480)
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

// TestParseGpxTimeToMillis 覆盖时区/无时区/毫秒/偏移等写法（与前端语义对齐）
func TestParseGpxTimeToMillis(t *testing.T) {
	// 东八区（+480）
	const offset = 480
	// 同一墙钟时间在不同时区下应得到不同绝对时刻
	utcMs := parseGpxTimeToMillis("2026-08-20T17:17:00Z", offset)
	eastMs := parseGpxTimeToMillis("2026-08-20T17:17:00", offset) // 无时区，按东八区
	if utcMs == 0 || eastMs == 0 {
		t.Fatal("解析失败")
	}
	if diff := utcMs - eastMs; diff != 8*3600*1000 {
		t.Errorf("UTC 与东八区差异应为 8 小时，得到 %d 毫秒", diff)
	}
	// 带偏移 +08:00 应与 Z 版的 17:17 相差 8 小时（同一绝对时刻换算）
	if got := parseGpxTimeToMillis("2026-08-20T17:17:00+08:00", offset); got != eastMs {
		t.Errorf("+08:00 与按东八区解释的无时区时间应一致，得到 %d vs %d", got, eastMs)
	}
	// ±HHMM 无冒号写法
	if got := parseGpxTimeToMillis("2026-08-20T17:17:00+0800", offset); got != eastMs {
		t.Errorf("+0800 应与 +08:00 一致，得到 %d vs %d", got, eastMs)
	}
	// 小数秒
	wantFrac := time.Date(2026, 8, 20, 9, 17, 0, 500*int(time.Millisecond), time.UTC).UnixMilli()
	if got := parseGpxTimeToMillis("2026-08-20T17:17:00.500+08:00", offset); got != wantFrac {
		t.Errorf("小数秒解析错误: 期望 %d，得到 %d", wantFrac, got)
	}
	// 空格分隔（非标准但常见）
	if got := parseGpxTimeToMillis("2026-08-20 17:17:00+08:00", offset); got != eastMs {
		t.Errorf("空格分隔应可解析，得到 %d vs %d", got, eastMs)
	}
	// 非法输入
	if got := parseGpxTimeToMillis("not-a-time", offset); got != 0 {
		t.Errorf("非法输入应返回 0，得到 %d", got)
	}
}
