/*
 * @Author: Do not edit
 * @Date: 2024-12-13 10:58:34
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-04 14:07:43
 * @FilePath: \Code\picMap_fontend\src\views\picMap\appMapTile
 * @Description:
 */
const appMapTile = [
  {
    name: '高德卫星地图',
    url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
  },
  {
    name: '高德矢量地图',
    url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'
  },

  {
    name: '高度路网标记图',
    url: 'https://webst01.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}'
  }
]

export default appMapTile
