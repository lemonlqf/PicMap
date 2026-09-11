package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	err := wails.Run(&options.App{
		Title:     "PicMap",
		Width:     1200,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		// 关闭窗口前二次确认（返回 true 表示阻止关闭）
		OnBeforeClose: func(ctx context.Context) bool {
			const confirmText = "退出"
			result, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
				Type:          runtime.QuestionDialog,
				Title:         "退出 PicMap",
				Message:       "确定要退出 PicMap 吗？",
				Buttons:       []string{"取消", confirmText},
				DefaultButton: "取消",
				CancelButton:  "取消",
			})
			if err != nil {
				// 弹窗失败时允许关闭，避免无法退出
				return false
			}
			confirmed := result == confirmText || result == "Yes" || result == "确定"
			return !confirmed
		},
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
