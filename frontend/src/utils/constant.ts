/*
 * @Author: your name
 * @Date: 2025-07-17 18:40:56
 * @LastEditTime: 2026-08-16 20:02:38
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @Description: In User Settings Edit
 * @FilePath: \picmap-go\frontend\src\utils\constant.ts
 */

// 默认地图中心点坐标
export const DEFAULT_CENTER = [30.2489634, 120.2052342]
// 默认地图缩放级别
export const DEFAULT_ZOOM = 10

// 抽屉的高度
export const DRAWER_HEIGHT = 380

// 地图常量
export const MAP_CONSTANT = {
  // 最大缩放级别（高德瓦片最高 18，再大会出现空白）
  MAX_ZOOM: 18,
  // 最小缩放级别
  MIN_ZOOM: 3
}

// 分组相关常量
export const GROUP_CONSTANT = {
  // 分组的marker封面图片的数量
  GROUP_COVER_NUMBER: 4
}

// marker的常量
export const MARKER_CONSTANT = {
  // 正常图片的marker大小
  IMAGE_MARKER_SIZE: [40, 40],
  // 分组的marker大小
  GROUP_MARKER_SIZE: [60, 60],
  // 放大比例
  MARKER_SHOW_RADIO: 1,
  // 鼠标悬停时的放大比例
  MARKER_HOVER_SHOW_RADIO: 1.5,
}

// marker向上偏移的量
export const imageMarkerTranslateY = MARKER_CONSTANT.IMAGE_MARKER_SIZE[1]
// 分组marker向上偏移的量
export const groupMarkerTranslateY = MARKER_CONSTANT.GROUP_MARKER_SIZE[1]

// 节点重叠判定阈值（经纬度差小于该值视为同一位置，用于点击展开蛛网）
export const MARKER_OVERLAP_THRESHOLD = 0.000005

// 瓦片叠加层图层 / 源 的 id 前缀（Map.vue 内按序号生成 overlay-layer-<i> / overlay-src-<i>）
export const OVERLAY_LAYER_PREFIX = 'overlay-layer-'
export const OVERLAY_SOURCE_PREFIX = 'overlay-src-'