/*
 * @Author: your name
 * @Date: 2025-07-17 18:40:56
 * @LastEditTime: 2025-09-13 18:22:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @Description: In User Settings Edit
 * @FilePath: \Code\picMap_fontend\src\utils\constant.ts
 */

// 抽屉的高度
export const DRAWER_HEIGHT = 400

// 地图常量
export const MAP_CONSTANT = {
  // 最大放到18
  MAX_ZOOM: 18,
  // 最小3
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
  MARKER_HOVER_SHOW_RADIO: 1.3,
}

// marker向上偏移的量
export const imageMarkerTranslateY = MARKER_CONSTANT.IMAGE_MARKER_SIZE[1]
// 分组marker向上偏移的量
export const groupMarkerTranslateY = MARKER_CONSTANT.GROUP_MARKER_SIZE[1]