/*
 * @Author: Do not edit
 * @Date: 2025-02-02 12:44:33
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-02 12:54:07
 * @FilePath: \Code\picMap_fontend\src\utils\eventBus
 * @Description: 事件总线
 */
import mitt from 'mitt'

export type EventMap = {
  'hidden-content-menu': void
  'show-content-menu': any
  'show-image-data': any
  'show-video-play': { videoId: string }
  'drawer-hidden': void
  'drawer-show': any
  'delete-image': string
  'edit-group': string
  'batch-delete': string[]
  'batch-add-group': string[]
  'box-select-change': string[]
  'clear-selection': void
  [key: string]: any
}

const eventBus = mitt<EventMap>()

export default eventBus
