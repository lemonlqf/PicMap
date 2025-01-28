/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-28 13:47:38
 * @FilePath: \Code\picMap_fontend\src\store\map.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'

export const useMapStore = defineStore('map', {
  state: () => ({
    // 地图中添加的所有marker，包括在可视范围外的
    markers: [],
    // 已经可见的marker，即已经请求过图片数据了
    visibleMarkers: []
  }),
  getters: {
    getMarker: state => state.markers,
    getVisibleMarker: state => state.visibleMarkers
  },
  actions: {
    addMarker(marker) {
      this.markers.push(marker)
    },
    addVisibleMarker(marker) {
      this.visibleMarkers.push(marker)
    }
  }
})
