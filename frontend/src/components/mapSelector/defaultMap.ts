/*
 * @Author: Do not edit
 * @Date: 2025-07-06 15:19:39
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-17 22:08:21
 * @FilePath: \Code\picMap_fontend\src\components\mapSelector\defaultMap.ts
 * @Description: 
 */
import GDSatellite from '@/assets/map/GDSatellite.png'
import GDGraphics from '@/assets/map/GDGraphics.png'
import i18n from '@/i18n/index'
import type { ITileOverlay } from '@/type/appSchema'

// 卫星底图（tile_default1）预置的路网叠加层，作为初始值，可被用户编辑/删除
export const SATELLITE_ROAD_OVERLAY: ITileOverlay = {
  url: 'https://webst01.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
  name: '路网标注'
}

export interface IMapTile {
  id: string,
  isDefault?: boolean
  name: String
  url: String
  image: any
}

export const getDefaultMapTile = (): IMapTile[] => {
  const t = i18n.global.t
  return [
    {
      id: 'tile_default1',
      isDefault: true,
      name: t('GSatellite'),
      url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      // image: '@/assets/map/高德卫星地图.png'
      image: GDSatellite
    },
    {
      id: 'tile_default2',
      isDefault: true,
      name: t('GVector'),
      url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
      image: GDGraphics
    },
    {
      id: 'tile_default3',
      isDefault: true,
      name: t('GVector3D'),
      url: 'https://wprd01.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8',
      image: GDGraphics
    }
  ]
}