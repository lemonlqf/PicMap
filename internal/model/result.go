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

type UploadImage struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
}

type UploadResult struct {
	ID              string `json:"id"`
	ThumbnailBase64 string `json:"thumbnailBase64,omitempty"`
}
