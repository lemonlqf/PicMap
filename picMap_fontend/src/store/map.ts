/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-01 19:49:01
 * @FilePath: \Code\picMap_fontend\src\store\map.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus'
import { resetMarker, highlightMarker, getMarkerById } from '../utils/map'
export const useMapStore = defineStore('map', {
  state: () => ({
    map: null,
    // 地图中添加的所有marker，包括在可视范围外的
    markerIdList: [],
    // 已经可见的marker，即已经请求过图片数据了
    visibleMarkerIdList: [],
    // 选中的marker，后续用于分组使用？
    selectedMarkerIdList: []
  }),
  getters: {
    getMap: state => state.map,
    getMarkerIdList: state => state.markerIdList,
    getVisibleMarkerIdList: state => state.visibleMarkerIdList,
    getSelectedMarkerIdList: state => state.selectedMarkerIdList
  },
  actions: {
    setMap(map) {
      this.map = map
    },
    removeMap() {
      this.map = null
    },
    addMarkerId(markerId) {
      this.markerIdList.push(markerId)
    },
    deleteMarker(markerId) {
      this.markerIdList = this.markerIdList.filter(item => {
        return item !== markerId
      })
      this.deleteVisbleMarkerId(markerId)
    },
    addVisibleMarkerId(markerId) {
      this.visibleMarkerIdList.push(markerId)
    },
    deleteVisbleMarkerId(markerId) {
      this.visibleMarkerIdList = this.visibleMarkerIdList.filter(item => {
        return item !== markerId
      })
    },
    init() {
      this.selectedMarkerIdList = []
      this.visibleMarkerIdList = []
      this.markerIdList = []
    }
  }
})
