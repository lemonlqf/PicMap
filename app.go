package main

import (
	"context"
	"log"

	"picmap-go/internal/config"
	"picmap-go/internal/handler"
	"picmap-go/internal/model"
)

type App struct {
	ctx     context.Context
	handler *handler.Handler
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	cfg := config.New()
	cfg.Init()
	a.handler = handler.New(cfg, ctx)
	log.Println("PicMap started, data dir:", cfg.ArchiveDir())
}

func (a *App) shutdown(ctx context.Context) {
	log.Println("PicMap shutting down")
}

func (a *App) CreateUser(userId string) model.Result         { return a.handler.CreateUser(userId) }
func (a *App) DeleteUser(userId string) model.Result         { return a.handler.DeleteUser(userId) }
func (a *App) GetAppSchema() model.Result                    { return a.handler.GetAppSchema() }
func (a *App) SetAppSchema(schemaJSON string) model.Result   { return a.handler.SetAppSchema(schemaJSON) }
func (a *App) GetUserInfos() model.Result                    { return a.handler.GetUserInfos() }
func (a *App) GetSchema(userId string) model.Result          { return a.handler.GetSchema(userId) }
func (a *App) SetSchema(userId, schemaJSON string) model.Result { return a.handler.SetSchema(userId, schemaJSON) }

func (a *App) UploadImages(userId string, images []model.UploadImage) model.Result {
	return a.handler.UploadImages(userId, images)
}
func (a *App) GetThumbnail(userId, imageId string) model.Result {
	return a.handler.GetThumbnail(userId, imageId)
}
func (a *App) GetThumbnails(userId string, imageIds []string) model.Result {
	return a.handler.GetThumbnails(userId, imageIds)
}
func (a *App) GetFullImage(userId, imageId string) model.Result {
	return a.handler.GetFullImage(userId, imageId)
}
func (a *App) DeleteImages(userId string, imageIds []string) model.Result {
	return a.handler.DeleteImages(userId, imageIds)
}
func (a *App) UpdateImages() model.Result {
	return model.NewFailResult("接口还在开发完善中....")
}
func (a *App) DownloadImage(userId, imageId string) model.Result {
	return a.handler.DownloadImage(userId, imageId)
}

// 路径方案：选择图片（原生对话框 + EXIF 解析 + 预览图）
func (a *App) SelectImages() model.Result {
	return a.handler.SelectImages()
}

// 路径方案：导入图片（从原路径复制到用户目录）
func (a *App) ImportImages(userId string, files []model.ImportFile) model.Result {
	return a.handler.ImportImages(userId, files)
}

func (a *App) UploadTrack(userId, fileData, fileName string) model.Result {
	return a.handler.UploadTrack(userId, fileData, fileName)
}
func (a *App) DeleteTrack(userId, fileName string) model.Result {
	return a.handler.DeleteTrack(userId, fileName)
}
func (a *App) GetTrack(userId, fileName string) model.Result {
	return a.handler.GetTrack(userId, fileName)
}

func (a *App) CreateBackup(name string) model.Result             { return a.handler.CreateBackup(name) }
func (a *App) GetBackupSize() model.Result                       { return a.handler.GetBackupSize() }
func (a *App) GetBackupList() model.Result                       { return a.handler.GetBackupList() }
func (a *App) ImportBackup(filePath, mode string) model.Result   { return a.handler.ImportBackup(filePath, mode) }
func (a *App) DeleteBackup(filePath string) model.Result         { return a.handler.DeleteBackup(filePath) }
