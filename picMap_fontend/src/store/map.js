/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 20:24:19
 * @FilePath: \Code\picMap_fontend\src\store\map.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus'
export const useMapStore = defineStore('map', {
  state: () => ({
    // 地图中添加的所有marker，包括在可视范围外的
    markers: [],
    // 已经可见的marker，即已经请求过图片数据了
    visibleMarkers: [],
    // TODO:选中的marker，后续用于分组使用？
    selectedMarkers: []
  }),
  getters: {
    getMarkers: state => state.markers,
    getVisibleMarkers: state => state.visibleMarkers,
    getSelectedMarkers: state => state.selectedMarkers
  },
  actions: {
    addMarker(marker) {
      this.markers.push(marker)
    },
    deleteMarker(marker) {
      this.markers = this.markers.filter(item => {
        return item.options.id !== marker.options.id
      })
      this.deleteVisbleMarker(marker)
    },
    addVisibleMarker(marker) {
      this.visibleMarkers.push(marker)
      // 添加点击事件监听，这里的mouseEvent的target中有marker信息
      marker.on('click', event => {
        ElMessage.success('触发Marker点击事件')
        // 点击节点后弹出图片详情框
        eventBus.emit('show-image-data', event)
      })
      // 添加右击时间监听
      marker.on('contextmenu', event => {
        ElMessage.success('触发Marker右键事件')
        // 出现右键菜单
        eventBus.emit('show-content-menu', event)
      })
    },
    deleteVisbleMarker(marker) {
      this.visibleMarkers = this.visibleMarkers.filter(item => {
        return item.options.id !== marker.options.id
      })
    }
  }
})
