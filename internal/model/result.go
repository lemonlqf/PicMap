package model

import "time"

type Result struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
	Time int64       `json:"time"`
}

func NewSuccessResult(data interface{}) Result {
	return Result{
		Code: 200,
		Msg:  "成功",
		Data: data,
		Time: time.Now().UnixMilli(),
	}
}

func NewFailResult(msg string) Result {
	return Result{
		Code: 500,
		Msg:  msg,
		Data: nil,
		Time: time.Now().UnixMilli(),
	}
}

type UploadResult struct {
	ID              string `json:"id"`
	ThumbnailBase64 string `json:"thumbnailBase64,omitempty"`
}

// SelectedImage 选择图片后返回的信息（路径方案）
type SelectedImage struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Path         string                 `json:"path"`
	Size         string                 `json:"size"`
	Type         string                 `json:"type"`
	LastModified int64                  `json:"lastModified"`
	GPSInfo      GPSInfo                `json:"GPSInfo"`
	ImageInfo    map[string]interface{} `json:"imageInfo"`
	CameraInfo   map[string]interface{} `json:"cameraInfo"`
	AuthorInfo   map[string]interface{} `json:"authorInfo"`
	Preview       string                 `json:"preview"`
	ThumbnailData string                 `json:"thumbnailData,omitempty"`
	IsPanorama    bool                   `json:"isPanorama"`
	PanoramaType  string                 `json:"panoramaType"`
}

// ImportFile 导入图片的请求项
type ImportFile struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

// SelectedVideo 选择视频后返回的信息
type SelectedVideo struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Path           string  `json:"path"`
	Size           int64   `json:"size"`
	LastModified   int64   `json:"lastModified"`
	DurationMS     int64   `json:"durationMs"`     // 时长（毫秒），ffprobe 失败为 0
	StartTimeMS    int64   `json:"startTimeMs"`    // 起点绝对时刻（来自 creation_time，或文件名兜底）
	HasGpsData     bool    `json:"hasGpsData"`     // 是否有内嵌 GPS
	ParsedTimeText string  `json:"parsedTimeText"` // 解析出的时间文本（供前端显示）
	GPSLatitude    float64 `json:"GPSLatitude,omitempty"`  // 内嵌 GPS 单点纬度（WGS84）
	GPSLongitude   float64 `json:"GPSLongitude,omitempty"` // 内嵌 GPS 单点经度（WGS84）
}

// ImportVideoFile 导入视频的请求项
type ImportVideoFile struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}
