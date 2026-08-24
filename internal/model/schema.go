package model

type GPSInfo struct {
	GPSLatitude  float64 `json:"GPSLatitude"`
	GPSLongitude float64 `json:"GPSLongitude"`
	GPSAltitude  float64 `json:"GPSAltitude,omitempty"`
}

type ImageInfo struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	GPSInfo      GPSInfo `json:"GPSInfo"`
	Type         string  `json:"type"`
	Describe     string  `json:"describe,omitempty"`
	LastModified int64   `json:"lastModified,omitempty"`
	Size         int64   `json:"size,omitempty"`
	URL          string  `json:"url,omitempty"`
	BlobURL      string  `json:"blobUrl,omitempty"`
}

type GroupInfo struct {
	Name         string   `json:"name"`
	ID           string   `json:"id"`
	GPSInfo      GPSInfo  `json:"GPSInfo"`
	GroupNumbers []string `json:"groupNumbers,omitempty"`
	VideoNumbers []string `json:"videoNumbers,omitempty"`
	TrackNumbers []string `json:"trackNumbers,omitempty"`
	Visible      bool     `json:"visible,omitempty"`
}

type TrackSetting struct {
	LineColor string `json:"lineColor,omitempty"`
}

// VideoRef 一条 GPX 轨迹（TrackInfo）上关联的一个视频引用
type VideoRef struct {
	VideoID      string `json:"videoId"`
	TimeOffsetMS int64  `json:"timeOffsetMs"` // 视频起点相对 GPX 起点的偏移（毫秒）
}

type TrackInfo struct {
	ID             string       `json:"id"`
	Name           string       `json:"name,omitempty"`
	Distance       float64      `json:"distance,omitempty"`
	StartTime      string       `json:"startTime,omitempty"`
	EndTime        string       `json:"endTime,omitempty"`
	MovingTime     float64      `json:"movingTime,omitempty"`
	TotalTime      float64      `json:"totalTime,omitempty"`
	MovingPace     float64      `json:"movingPace,omitempty"`
	MovingSpeed    float64      `json:"movingSpeed,omitempty"`
	TotalSpeed     float64      `json:"totalSpeed,omitempty"`
	ElevationMin   float64      `json:"elevationMin,omitempty"`
	ElevationMax   float64      `json:"elevationMax,omitempty"`
	ElevationGain  float64      `json:"elevationGain,omitempty"`
	ElevationLoss  float64      `json:"elevationLoss,omitempty"`
	SpeedMax       float64      `json:"speedMax,omitempty"`
	AverageHr      float64      `json:"averageHr,omitempty"`
	AverageCadence float64      `json:"averageCadence,omitempty"`
	AverageTemp    float64      `json:"averageTemp,omitempty"`
	Setting        TrackSetting `json:"setting,omitempty"`
	Videos         []VideoRef   `json:"videos,omitempty"` // 该 GPX 关联的视频
	Images         []string     `json:"images,omitempty"` // 该轨迹关联的图片
}

// VideoInfo 一段轨迹视频（含内嵌 GPS 独立视频，或关联 GPX 的普通视频）
type VideoInfo struct {
	ID           string  `json:"id"`                     // 唯一 ID
	Name         string  `json:"name"`                   // 原始文件名
	Path         string  `json:"path"`                   // videos/ 下的文件名（不含目录），如 PM3f8a...mp4
	DurationMS   int64   `json:"durationMs,omitempty"`   // 视频时长（毫秒）
	TrackID      string  `json:"trackId,omitempty"`      // 关联的 GPX 轨迹 ID（普通视频必填；内嵌 GPS 独立视频可为空）
	TimeMode     string  `json:"timeMode,omitempty"`     // 时间对齐模式："absolute"（绝对起始时间）| "offset"（相对 GPX 起始时间的偏移），默认 absolute
	StartTimeMS  int64   `json:"startTimeMs,omitempty"`  // 视频起点绝对时刻（epoch 毫秒），timeMode=absolute 时生效
	TimeOffsetMS int64   `json:"timeOffsetMs,omitempty"` // 视频起点相对 GPX 起始时间的偏移（毫秒），timeMode=offset 时生效
	ViewType     string  `json:"viewType,omitempty"`     // "image" | "panorama"（本次仅 image）
	Size         int64   `json:"size,omitempty"`         // 文件大小（字节）
	LastModified int64   `json:"lastModified,omitempty"` // 修改时间（epoch 毫秒）
	GPSLatitude  float64 `json:"GPSLatitude,omitempty"`  // 内嵌 GPS 单点纬度（WGS84），独立视频定位用
	GPSLongitude float64 `json:"GPSLongitude,omitempty"` // 内嵌 GPS 单点经度（WGS84）
}

type MapInfo struct {
	Center        []float64 `json:"center"`
	MaxZoom       float64   `json:"maxZoom,omitempty"`
	MinZoom       float64   `json:"minZoom,omitempty"`
	Zoom          float64   `json:"zoom,omitempty"`
	ActiveTiles   []string  `json:"activeTiles"`
	DefaultTileID string    `json:"defaultTileId,omitempty"`
}

type Schema struct {
	Version    string      `json:"version"`
	MapInfo    MapInfo     `json:"mapInfo"`
	GroupInfo  []GroupInfo `json:"groupInfo"`
	ImageInfo  []ImageInfo `json:"imageInfo"`
	TrackInfo  []TrackInfo `json:"trackInfo,omitempty"`
	VideoInfo  []VideoInfo `json:"videoInfo,omitempty"`
}
