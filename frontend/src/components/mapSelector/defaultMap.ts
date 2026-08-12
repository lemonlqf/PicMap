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
import TXGraphics from '@/assets/map/TXGraphics.png'
import { useI18n } from 'vue-i18n'
export interface IMapTile {
  id: string,
  isDefault?: boolean
  name: String
  url: String
  image: any
}

export const getDefaultMapTile = (): IMapTile[] => {
  const { t } = useI18n()
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
      name: t('TVector'),
      url: 'https://rt1.map.gtimg.com/tile?z={z}&x={x}&y={-y}&styleid=0&version=256',
      image: TXGraphics
    }
  ]
}