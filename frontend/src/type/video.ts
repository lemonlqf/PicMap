/*
 * 轨迹视频相关类型
 * @Description: 轨迹视频（关联 GPX 或内嵌 GPS）的类型定义
 */

// 选择视频后由后端返回的解析结果
export type ISelectedVideo = {
  id: string
  name: string
  path: string
  size: number
  lastModified: number
  durationMs: number        // 时长（毫秒），ffprobe 失败为 0
  startTimeMs: number       // 起点绝对时刻（来自 creation_time，或文件名兜底）
  hasGpsData: boolean       // 是否有内嵌 GPS
  parsedTimeText?: string   // 解析出的时间文本（供前端显示）
  GPSLatitude?: number      // 内嵌 GPS 单点纬度（WGS84）
  GPSLongitude?: number     // 内嵌 GPS 单点经度（WGS84）
  imported?: boolean        // 前端标记：是否已导入
}

// 上传到后端导入视频的请求项
export type IImportVideoFile = {
  id: string
  name: string
  path: string
}

// 视频节点（地图上的点），坐标来自 GPX 时间对应位置
export type IVideoNode = {
  videoId: string
  timeMs: number          // 视频内相对时间（毫秒）
  lat: number             // GCJ02 纬度
  lng: number             // GCJ02 经度
  viewType: 'video' | 'image' | 'panorama'
}
