package model

type MapTile struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Name  string `json:"name"`
	Image string `json:"image"`
}

type UserInfo struct {
	UserID     string `json:"userId"`
	UserName   string `json:"userName"`
	UserAvatar string `json:"userAvatar,omitempty"`
	CreateTime int64  `json:"createTime,omitempty"`
}

type AppSchemaMapInfo struct {
	MapTiles      []MapTile `json:"mapTiles"`
	DefaultTileID string    `json:"defaultTileId,omitempty"`
}

type AppSchema struct {
	Version   string          `json:"version"`
	UserInfos []UserInfo      `json:"userInfos"`
	MapInfo   AppSchemaMapInfo `json:"mapInfo"`
}
