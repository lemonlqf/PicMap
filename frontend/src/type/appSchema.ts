/*
 * @Author: Do not edit
 * @Date: 2025-06-29 15:27:39
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-10 22:17:21
 * @FilePath: \PicMap\Code\picMap_fontend\src\type\appSchema.ts
 * @Description: 
 */
type IMapTile = {
  id: string
  url: string // 在线地址
  name: string,
  image: string
}

// 瓦片叠加层（路网标注等）配置项
export type ITileOverlay = {
  url: string   // 叠加层瓦片 URL（含 {x}{y}{z} 占位）
  name: string  // 叠加层名称（如 "路网标注"）
}

export type IAppSchema = {
  version: string
  userInfos: IUserInfo[],
  mapInfo: {
    mapTiles: IMapTile[]
    defaultTileId?: string
    // tileId -> 该瓦片配置的叠加层列表（按瓦片 id 全局存储）
    tileOverlays?: Record<string, ITileOverlay[]>
  },
  iconLibrary?: IIconItem[]
}

export type IUserInfo = {
  userId: string
  userName: string;
  userAvatar?: string;
  createTime?: number;
}

// 图标分类：头像 / 轨迹
export type IIconCategory = 'avatar' | 'track'

// 全局图标库条目
export type IIconItem = {
  id: string
  name: string
  url: string              // 相对路径（自定义）或预设 key
  category: IIconCategory
  source: 'preset' | 'custom'
}