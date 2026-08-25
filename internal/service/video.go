package service

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// VideoProbeInfo 视频探测结果（时长、尺寸、绝对开始时间、GPS 单点）
type VideoProbeInfo struct {
	DurationMS    int64   // 视频时长（毫秒）
	Width         int
	Height        int
	CreationTime  int64   // 绝对开始时间（epoch 毫秒，来自 creation_time），0 表示缺失
	GPSLatitude   float64 // 内嵌 GPS 单点纬度（WGS84），0 表示缺失
	GPSLongitude  float64 // 内嵌 GPS 单点经度（WGS84），0 表示缺失
	HasGPS        bool    // 是否有内嵌 GPS
}

// GpxPoint 一条 GPX 轨迹点（含绝对时间戳）
type GpxPoint struct {
	Lat    float64
	Lng    float64
	TimeMs int64  // epoch 毫秒，0 表示缺失
	Ele    float64
}

// ---- 文件名时间解析 ----

// ParseStartTimeFromName 从文件名解析视频起始绝对时刻。
// 支持格式（含前缀/分隔符）：
//   - 20260820_171710.mp4
//   - 2026-08-20_17-17-10.mp4 / 2026-08-20 17-17-10.mp4
//   - IMG_20260820_171710.mp4
//
// 返回 epoch 毫秒，无法解析返回 0。
func ParseStartTimeFromName(name string) int64 {
	base := strings.TrimSuffix(name, filepathExt(name))
	re := regexp.MustCompile(`(\d{4})[-_]?(\d{2})[-_]?(\d{2})[\s_\-]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})`)
	m := re.FindStringSubmatch(base)
	if m == nil {
		return 0
	}

	year, _ := strconv.Atoi(m[1])
	month, _ := strconv.Atoi(m[2])
	day, _ := strconv.Atoi(m[3])
	hour, _ := strconv.Atoi(m[4])
	minute, _ := strconv.Atoi(m[5])
	second, _ := strconv.Atoi(m[6])

	if year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 ||
		hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59 {
		return 0
	}

	t := time.Date(year, time.Month(month), day, hour, minute, second, 0, time.Local)
	return t.UnixMilli()
}

func filepathExt(name string) string {
	i := strings.LastIndexByte(name, '.')
	if i < 0 {
		return ""
	}
	return name[i:]
}

// ---- GPX 逐点解析 ----

// gpx 最小结构，仅解析 trkpt 的 lat/lon/time/ele
type gpxXML struct {
	Trk []struct {
		TrkSeg []struct {
			Trkpt []gpxTrkpt `xml:"trkpt"`
		} `xml:"trkseg"`
	} `xml:"trk"`
}

type gpxTrkpt struct {
	Lat  float64 `xml:"lat,attr"`
	Lon  float64 `xml:"lon,attr"`
	Time string  `xml:"time"`
	Ele  string  `xml:"ele"`
}

// ParseGpxPoints 解析 GPX 文件，返回逐点 [lat, lng, timeMs, ele]。
// 时间戳缺失的点 TimeMs 为 0。坐标保持原始 WGS84（不转 GCJ02，由调用方决定）。
func ParseGpxPoints(data []byte) ([]GpxPoint, error) {
	var g gpxXML
	if err := xml.Unmarshal(data, &g); err != nil {
		return nil, err
	}
	var pts []GpxPoint
	for _, trk := range g.Trk {
		for _, seg := range trk.TrkSeg {
			for _, p := range seg.Trkpt {
				pt := GpxPoint{Lat: p.Lat, Lng: p.Lon}
				if p.Time != "" {
					if t, err := time.Parse(time.RFC3339, p.Time); err == nil {
						pt.TimeMs = t.UnixMilli()
					}
				}
				if p.Ele != "" {
					pt.Ele, _ = strconv.ParseFloat(p.Ele, 64)
				}
				pts = append(pts, pt)
			}
		}
	}
	return pts, nil
}

// ---- ffprobe 探测 ----

// ffprobeJSON ffprobe -print_format json 输出的最小结构
type ffprobeJSON struct {
	Streams []struct {
		CodecType string `json:"codec_type"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
	} `json:"streams"`
	Format struct {
		Duration string `json:"duration"`
		Tags     struct {
			CreationTime string `json:"creation_time"`
			Location     string `json:"location"`
		} `json:"tags"`
	} `json:"format"`
}

// parseGPSLocation 解析 ffprobe 的 location 字符串（如 "+30.1864+120.1689/"）
// 返回纬度、经度（WGS84）。解析失败返回 0,0。
func parseGPSLocation(loc string) (float64, float64) {
	if loc == "" {
		return 0, 0
	}
	// 格式：{+/-}lat{+/-}lng/  （有时带海拔，忽略）
	re := regexp.MustCompile(`([+-]\d+(?:\.\d+)?)\s*([+-]\d+(?:\.\d+)?)`)
	m := re.FindStringSubmatch(loc)
	if len(m) < 3 {
		return 0, 0
	}
	lat, err1 := strconv.ParseFloat(m[1], 64)
	lng, err2 := strconv.ParseFloat(m[2], 64)
	if err1 != nil || err2 != nil {
		return 0, 0
	}
	return lat, lng
}

// ProbeVideo 用 ffprobe 探测视频：时长、尺寸、绝对开始时间、内嵌 GPS 单点。
func ProbeVideo(inputPath string) (*VideoProbeInfo, error) {
	ffprobePath := filepath.Join(getToolsDir(), "ffmpeg", "ffprobe.exe")
	if _, err := os.Stat(ffprobePath); err != nil {
		return nil, fmt.Errorf("找不到 ffprobe: %w", err)
	}
	cmd := exec.Command(ffprobePath,
		"-v", "error",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		inputPath,
	)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe 执行失败: %w", err)
	}

	var pj ffprobeJSON
	if err := json.Unmarshal(output, &pj); err != nil {
		return nil, fmt.Errorf("解析 ffprobe 输出失败: %w", err)
	}

	info := &VideoProbeInfo{}
	// 时长
	if pj.Format.Duration != "" {
		if sec, err := strconv.ParseFloat(pj.Format.Duration, 64); err == nil {
			info.DurationMS = int64(sec * 1000)
		}
	}
	// 尺寸（取第一个视频流）
	for _, s := range pj.Streams {
		if s.CodecType == "video" && (info.Width == 0 || info.Height == 0) {
			info.Width = s.Width
			info.Height = s.Height
		}
	}
	// 绝对开始时间（creation_time）
	if pj.Format.Tags.CreationTime != "" {
		if t, err := time.Parse(time.RFC3339, pj.Format.Tags.CreationTime); err == nil {
			info.CreationTime = t.UnixMilli()
		}
	}
	// 内嵌 GPS 单点（location）
	if lat, lng := parseGPSLocation(pj.Format.Tags.Location); lat != 0 || lng != 0 {
		info.GPSLatitude = lat
		info.GPSLongitude = lng
		info.HasGPS = true
	}
	return info, nil
}

// ExtractVideoFrame 用 ffmpeg 提取视频某一帧为 JPEG 字节（封面/缩略图用）。
// timeMs 为 0 时取第一帧；maxWidth > 0 时限制输出宽度（保持纵横比）。
func ExtractVideoFrame(inputPath string, timeMs int64, maxWidth int) ([]byte, error) {
	ffmpegPath := filepath.Join(getToolsDir(), "ffmpeg", "ffmpeg.exe")
	if _, err := os.Stat(ffmpegPath); err != nil {
		return nil, fmt.Errorf("找不到 ffmpeg: %w", err)
	}
	args := []string{"-v", "error", "-y"}
	if timeMs > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.3f", float64(timeMs)/1000.0))
	}
	args = append(args, "-i", inputPath)
	// 统一转换为 yuvj420p，规避部分源视频像素格式（如 nv12/yuv444p）导致 mjpeg 编码器初始化失败
	args = append(args, "-pix_fmt", "yuvj420p")
	if maxWidth > 0 {
		args = append(args, "-vf", fmt.Sprintf("scale='min(%d,iw)':-2", maxWidth))
	}
	args = append(args, "-frames:v", "1", "-q:v", "4", "-f", "image2pipe", "-vcodec", "mjpeg", "-")

	cmd := exec.Command(ffmpegPath, args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg 提取帧失败: %w: %s", err, stderr.String())
	}
	if stdout.Len() == 0 {
		return nil, fmt.Errorf("ffmpeg 未输出帧数据")
	}
	return stdout.Bytes(), nil
}
