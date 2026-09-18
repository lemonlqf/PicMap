package handler

import (
	"encoding/json"
	"os"
	"path/filepath"

	"picmap-go/internal/model"
	"picmap-go/internal/util"
)

// ---- User ----

func (h *Handler) CreateUser(userId string) model.Result {
	appData, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err != nil {
		return model.NewFailResult("读取 appSchema 失败")
	}
	var app model.AppSchema
	if err := json.Unmarshal(appData, &app); err != nil {
		return model.NewFailResult("解析 appSchema 失败")
	}
	for _, u := range app.UserInfos {
		if u.UserID == userId {
			return model.NewSuccessResult("用户已存在")
		}
	}
	app.UserInfos = append(app.UserInfos, model.UserInfo{
		UserID:   userId,
		UserName: userId,
	})
	userDir := filepath.Join(h.cfg.ArchiveDir(), userId)
	os.MkdirAll(userDir, 0755)

	schemaDir := h.cfg.SchemaDirPath(userId)
	os.MkdirAll(schemaDir, 0755)
	imageDir := h.cfg.ImageDirPath(userId)
	os.MkdirAll(imageDir, 0755)
	trackDir := h.cfg.TrackDirPath(userId)
	os.MkdirAll(trackDir, 0755)

	defaultSchema := h.cfg.DefaultSchema()
	schemaData, _ := json.MarshalIndent(defaultSchema, "", "  ")
	schemaPath := h.cfg.SchemaPath(userId)
	os.WriteFile(schemaPath, schemaData, 0644)

	newData, _ := json.MarshalIndent(app, "", "  ")
	os.WriteFile(h.cfg.AppSchemaPath(), newData, 0644)

	return model.NewSuccessResult("创建成功")
}

func (h *Handler) DeleteUser(userId string) model.Result {
	userDir := filepath.Join(h.cfg.ArchiveDir(), userId)
	if !util.FileExists(userDir) {
		return model.NewFailResult("用户不存在")
	}
	if err := os.RemoveAll(userDir); err != nil {
		return model.NewFailResult("删除用户目录失败: " + err.Error())
	}

	// 清理该用户的缩略图缓存，避免长期运行内存只增不减
	prefix := userId + "/"
	h.thumbCache.DeleteByPrefix(prefix)
	h.largeThumbCache.DeleteByPrefix(prefix)

	// 同步从 appSchema 中移除该用户，否则重启时 initUsers 会依据残留记录重新建目录（幽灵用户）
	appData, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err == nil {
		var app model.AppSchema
		if json.Unmarshal(appData, &app) == nil {
			filtered := app.UserInfos[:0]
			for _, u := range app.UserInfos {
				if u.UserID != userId {
					filtered = append(filtered, u)
				}
			}
			app.UserInfos = filtered
			newData, mErr := json.MarshalIndent(app, "", "  ")
			if mErr == nil {
				_ = h.atomicWrite(h.cfg.AppSchemaPath(), newData)
			}
		}
	}

	return model.NewSuccessResult("删除成功")
}

// ---- AppSchema ----

func (h *Handler) GetAppSchema() model.Result {
	data, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err != nil {
		return model.NewFailResult("读取 appSchema 失败")
	}
	var app model.AppSchema
	if err := json.Unmarshal(data, &app); err != nil {
		return model.NewFailResult("解析 appSchema 失败")
	}
	return model.NewSuccessResult(app)
}

func (h *Handler) SetAppSchema(schemaJSON string) model.Result {
	if err := h.atomicWrite(h.cfg.AppSchemaPath(), []byte(schemaJSON)); err != nil {
		return model.NewFailResult("保存 appSchema 失败: " + err.Error())
	}
	return model.NewSuccessResult("appSchema数据更新成功！")
}

func (h *Handler) GetUserInfos() model.Result {
	data, err := os.ReadFile(h.cfg.AppSchemaPath())
	if err != nil {
		return model.NewFailResult("读取 appSchema 失败")
	}
	var app model.AppSchema
	if err := json.Unmarshal(data, &app); err != nil {
		return model.NewFailResult("解析 appSchema 失败")
	}
	return model.NewSuccessResult(app.UserInfos)
}

// ---- Schema ----

func (h *Handler) GetSchema(userId string) model.Result {
	schemaPath := h.cfg.SchemaPath(userId)
	if !util.FileExists(schemaPath) {
		h.ensureDefaultSchema(userId)
	}
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		return model.NewFailResult("读取 schema 失败")
	}
	return model.NewSuccessResult(string(data))
}

func (h *Handler) SetSchema(userId, schemaJSON string) model.Result {
	h.ensureUserDir(userId)
	schemaPath := h.cfg.SchemaPath(userId)
	if err := h.atomicWrite(schemaPath, []byte(schemaJSON)); err != nil {
		return model.NewFailResult("保存 schema 失败: " + err.Error())
	}
	return model.NewSuccessResult("schema数据更新成功！")
}
