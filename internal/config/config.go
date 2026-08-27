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
	IconReactivePath   = "icons"
	// 存储配置文件名（存用户主目录，避免修改数据目录后找不到配置）
	RootConfigFileName = ".picmap-config.json"
	// 默认备份目录名
	BackupDirName = "PicMap_Backup"
)

var DefaultCenter = []float64{30.2489634, 120.2052342}

// StorageConfig 存储目录配置
type StorageConfig struct {
	ArchiveDir string `json:"archiveDir"`
	BackupDir  string `json:"backupDir"`
}

type Config struct {
	archiveDir      string
	backupDir       string
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
	// 先读取固定位置的存储配置（用户主目录），确定数据目录与备份目录
	c.loadStorageConfig()
	if c.archiveDir == "" {
		c.archiveDir = c.findDefaultArchiveDir()
	}
	if c.backupDir == "" {
		c.backupDir = filepath.Join(filepath.Dir(c.archiveDir), BackupDirName)
	}
	log.Println("Archive directory:", c.archiveDir)
	log.Println("Backup directory:", c.backupDir)
	c.initAppSchema()
	c.initUsers()
}

// 固定位置的存储配置文件路径（用户主目录）
func (c *Config) rootConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, RootConfigFileName)
}

// 读取存储配置，若存在则应用
func (c *Config) loadStorageConfig() {
	data, err := os.ReadFile(c.rootConfigPath())
	if err != nil {
		return
	}
	var sc StorageConfig
	if err := json.Unmarshal(data, &sc); err != nil {
		return
	}
	c.archiveDir = sc.ArchiveDir
	c.backupDir = sc.BackupDir
}

// 保存存储配置到固定位置
func (c *Config) saveStorageConfig(sc StorageConfig) error {
	data, err := json.MarshalIndent(sc, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.rootConfigPath(), data, 0644)
}

// 获取当前存储配置
func (c *Config) GetStorageConfig() StorageConfig {
	return StorageConfig{
		ArchiveDir: c.archiveDir,
		BackupDir:  c.backupDir,
	}
}

// 设置并持久化存储配置（archiveDir 为空则保留当前；backupDir 为空则自动推断）
func (c *Config) SetStorageConfig(archiveDir, backupDir string) error {
	newArchive := archiveDir
	if newArchive == "" {
		newArchive = c.archiveDir
	}
	newBackup := backupDir
	if newBackup == "" {
		newBackup = filepath.Join(filepath.Dir(newArchive), BackupDirName)
	}
	sc := StorageConfig{
		ArchiveDir: newArchive,
		BackupDir:  newBackup,
	}
	if err := c.saveStorageConfig(sc); err != nil {
		return err
	}
	c.archiveDir = newArchive
	c.backupDir = newBackup
	return nil
}

func (c *Config) findDefaultArchiveDir() string {
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

// 全局图标库目录，category: "avatar" 或 "track"
func (c *Config) IconDirPath(category string) string {
	return filepath.Join(c.archiveDir, IconReactivePath, category)
}

func (c *Config) AppSchemaPath() string {
	return filepath.Join(c.archiveDir, AppSchemaFileName)
}

func (c *Config) BackupDir() string {
	if c.backupDir != "" {
		return c.backupDir
	}
	return filepath.Join(filepath.Dir(c.archiveDir), BackupDirName)
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
