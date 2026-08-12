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
	TrackNumbers []string `json:"trackNumbers,omitempty"`
	Visible      bool     `json:"visible,omitempty"`
}

type TrackSetting struct {
	LineColor string `json:"lineColor,omitempty"`
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
	Verison    string      `json:"verison"`
	MapInfo    MapInfo     `json:"mapInfo"`
	GroupInfo  []GroupInfo `json:"groupInfo"`
	ImageInfo  []ImageInfo `json:"imageInfo"`
	TrackInfo  []TrackInfo `json:"trackInfo,omitempty"`
}
