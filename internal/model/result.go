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
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Path          string                 `json:"path"`
	Size          string                 `json:"size"`
	Type          string                 `json:"type"`
	LastModified  int64                  `json:"lastModified"`
	GPSInfo       GPSInfo                `json:"GPSInfo"`
	ImageInfo     map[string]interface{} `json:"imageInfo"`
	CameraInfo    map[string]interface{} `json:"cameraInfo"`
	AuthorInfo    map[string]interface{} `json:"authorInfo"`
	Preview       string                 `json:"preview"`
	ThumbnailData string                 `json:"thumbnailData,omitempty"`
}

// ImportFile 导入图片的请求项
type ImportFile struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}
