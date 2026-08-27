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

export type IAppSchema = {
  version: string
  userInfos: IUserInfo[],
  mapInfo: {
    mapTiles: IMapTile[]
    defaultTileId?: string
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