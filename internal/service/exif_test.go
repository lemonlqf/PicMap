package service

import (
	"testing"
	"time"
)

func TestExifDateToMillis(t *testing.T) {
	// EXIF 拍摄时间是不带时区的墙钟时间，按传入的时区偏移解释
	const offset = 480 // 东八区
	cases := []struct {
		in   string
		want string // 期望的墙钟时间串（东八区下），"" 表示应为 0
	}{
		{"2024:06:09 16:15:43", "2024-06-09 16:15:43"},
		{"2024-06-09 16:15:43", "2024-06-09 16:15:43"},
		{"  2024:06:09 16:15:43  ", "2024-06-09 16:15:43"},
		{"", ""},
		{"not a date", ""},
		{"2024:13:09 16:15:43", ""}, // 非法月份
	}
	loc := time.FixedZone("", offset*60)
	for _, c := range cases {
		ms := exifDateToMillis(c.in, offset)
		if c.want == "" {
			if ms != 0 {
				t.Errorf("%q: 期望 0，得到 %d", c.in, ms)
			}
			continue
		}
		if ms == 0 {
			t.Errorf("%q: 期望解析 %s，得到 0", c.in, c.want)
			continue
		}
		got := time.UnixMilli(ms).In(loc).Format("2006-01-02 15:04:05")
		if got != c.want {
			t.Errorf("%q: 期望 %s，得到 %s", c.in, c.want, got)
		}
	}
}

// TestExifDateToMillisTimezone 验证同一 EXIF 字符串在不同时区下解析出的绝对时刻不同
func TestExifDateToMillisTimezone(t *testing.T) {
	const s = "2024:06:09 16:15:43"
	msEast := exifDateToMillis(s, 480) // 东八区 16:15:43 = UTC 08:15:43
	msUtc := exifDateToMillis(s, 0)    // UTC 16:15:43
	if msEast == 0 || msUtc == 0 {
		t.Fatal("解析失败")
	}
	// 东八区解释出的绝对时刻应比 UTC 解释早 8 小时
	if diff := msUtc - msEast; diff != 8*3600*1000 {
		t.Errorf("东八区与 UTC 差异应为 8 小时，得到 %d 毫秒", diff)
	}
}
