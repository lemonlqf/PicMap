import GDSatellite from '@/assets/map/GDSatellite.png'
import GDGraphics from '@/assets/map/GDGraphics.png'
import TXGraphics from '@/assets/map/TXGraphics.png'

export interface IMapTile {
  id: string,
  isDefault?: boolean
  name: String
  url: String
  image: any
}

export const defaultMapTile: IMapTile[] = [
  {
    id: 'tile_default1',
    isDefault: true,
    name: '高德卫星图',
    url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    // image: '@/assets/map/高德卫星地图.png'
    image: GDSatellite
  },
  {
    id: 'tile_default2',
    isDefault: true,
    name: '高德矢量图',
    url: 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    image: GDGraphics
  },
  {
    id: 'tile_default3',
    isDefault: true,
    name: '腾讯矢量图',
    url: 'https://rt1.map.gtimg.com/tile?z={z}&x={x}&y={-y}&styleid=0&version=256',
    image: TXGraphics
  }
]