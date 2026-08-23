package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"picmap-go/internal/model"
)

const (
	DefaultUserName    = "user1"
	SchemaFileName     = "schema.json"
	AppSchemaFileName  = "appSchema.json"
	SchemaReactivePath = "images/schema"
	ImageReactivePath  = "images"
	TrackReactivePath  = "tracks"
	VideoReactivePath  = "videos"
)

var DefaultCenter = []float64{30.2489634, 120.2052342}

type Config struct {
	archiveDir      string
	defaultAppInfo  string
	defaultSchema   string
}

func New() *Config {
	return &Config{}
}

func (c *Config) ArchiveDir() string {
	return c.archiveDir
}

func (c *Config) Init() {
	c.archiveDir = c.findArchiveDir()
	log.Println("Archive directory:", c.archiveDir)
	c.initAppSchema()
	c.initUsers()
}

func (c *Config) findArchiveDir() string {
	if runtime.GOOS == "windows" {
		for drive := 'D'; drive <= 'Z'; drive++ {
			path := fmt.Sprintf("%c:/", drive)
			if _, err := os.Stat(path); err == nil {
				return fmt.Sprintf("%c:/PicMap", drive)
			}
		}
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "PicMap")
}

func (c *Config) initAppSchema() {
	appSchemaPath := filepath.Join(c.archiveDir, AppSchemaFileName)
	if _, err := os.Stat(appSchemaPath); os.IsNotExist(err) {
		os.MkdirAll(c.archiveDir, 0755)
		defaultApp := model.AppSchema{
			Version: "1.0.0",
			UserInfos: []model.UserInfo{
				{UserID: "user1", UserName: "用户1", UserAvatar: ""},
			},
			MapInfo: model.AppSchemaMapInfo{
				MapTiles:      []model.MapTile{},
				DefaultTileID: "",
			},
		}
		data, _ := json.MarshalIndent(defaultApp, "", "  ")
		os.WriteFile(appSchemaPath, data, 0644)
	}
}

func (c *Config) initUsers() {
	appSchemaPath := filepath.Join(c.archiveDir, AppSchemaFileName)
	data, err := os.ReadFile(appSchemaPath)
	if err != nil {
		return
	}
	var app model.AppSchema
	if err := json.Unmarshal(data, &app); err != nil {
		return
	}
	for _, user := range app.UserInfos {
		userDir := filepath.Join(c.archiveDir, user.UserID)
		os.MkdirAll(userDir, 0755)
	}
}

func (c *Config) SchemaPath(userId string) string {
	return filepath.Join(c.archiveDir, userId, SchemaReactivePath, SchemaFileName)
}

func (c *Config) SchemaDirPath(userId string) string {
	return filepath.Join(c.archiveDir, userId, SchemaReactivePath)
}

func (c *Config) ImageDirPath(userId string) string {
	return filepath.Join(c.archiveDir, userId, ImageReactivePath)
}

func (c *Config) TrackDirPath(userId string) string {
	return filepath.Join(c.archiveDir, userId, TrackReactivePath)
}

func (c *Config) VideoDirPath(userId string) string {
	return filepath.Join(c.archiveDir, userId, VideoReactivePath)
}

func (c *Config) AppSchemaPath() string {
	return filepath.Join(c.archiveDir, AppSchemaFileName)
}

func (c *Config) BackupDir() string {
	return filepath.Join(filepath.Dir(c.archiveDir), "PicMap_Backup")
}

func (c *Config) DefaultSchema() model.Schema {
	return model.Schema{
		Version: "1.0.0",
		MapInfo: model.MapInfo{
			Center: DefaultCenter,
			ActiveTiles: []string{
				"tile_default1",
				"tile_default2",
				"tile_default3",
			},
		},
		GroupInfo: []model.GroupInfo{},
		ImageInfo: []model.ImageInfo{},
	}
}
