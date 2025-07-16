/*
 * @Author: Do not edit
 * @Date: 2025-02-25 20:32:28
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-16 21:31:51
 * @FilePath: \Code\picMap_fontend\src\utils\group.ts
 * @Description: 分组相关的一些方法
 */
import { useSchemaStore } from '@/store/schema'
import { editSchemaAndSave, editSchemaAttrAndSave, saveSchema } from './schema';
import { addImageMarkerToMap, deleteMarkerById, MAP_INSTANCE, getMarkerById, GROUP_COVER_NUMBER, GROUP_MARKER_SIZE, groupMarkerTranslateY } from '@/utils/map';
import { ElMessage } from 'element-plus';
import { getGPSInfoById, addExistImageToMapById, imageUrlsIcon } from '@/utils/map';
import eventBus from '@/utils/eventBus'
import API from '@/http/index'
import L from 'leaflet'
import { getImageUrlByIds, isImageExistInImageInfo } from '@/utils/Image'
import { cloneDeep } from 'lodash-es';
import type { IGPSInfo, IGroupInfo } from '@/type/schema';
import type { ICreateGroupInfoData } from '@/type/group'
import type { INewGroupFormData } from '@/type/schema'
import { resetIconGroupMarker } from '@/utils/map'
import { editAppSchemaAttrAndSave } from './appSchema';

export const defaultGroupNamePrefix = '未命名分组'

/**
 * @description: 判断是否在分组中，如果不传groupId则判断是在所有分组中是否存在
 * @param {*} imageId
 * @param {*} groupId
 * @return {*}
 */
export function isInGroup(imageId: string, groupId?) {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  if (isGroupIdExist(groupId)) {
    return groupLists.find(group => group.id === groupId).groupNumbers?.includes?.(imageId);
  } else {
    return groupLists.find(group => group?.groupNumbers?.includes?.(imageId));
  }
}

/**
 * @description: 根据图片id获取分组id
 * @param {*} imageId
 * @return {*}
 */
function getGroupByImageId(imageId) {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  if (isInGroup(imageId)) {
    return groupLists.find(group => group.groupNumbers.includes(imageId)).id;
  } else {
    return null
  }
}

/**
 * @description: 判断分组id是否存在
 * @param {*} groupId
 * @return {*}
 */
export function isGroupIdExist(groupId) {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  return groupLists.some(group => group.id === groupId);
}

/**
 * @description: 根据分组id获取分组名
 * @param {*} groupId
 * @return {*}
 */
export function getGroupNameById(groupId) {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  return groupLists.find(group => group.id === groupId).name;
}

/**
 * @description: 判断分组名是否存在
 * @param {*} groupName
 * @return {*}
 */
export function isGroupNameExist(groupName) {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  return groupLists.some(group => group.name === groupName);
}

/**
 * @description: 判断图片是否在分组中
 * @param {*} imageId
 * @param {*} groupId
 * @return {*}
 */
export function isImageExistInGroup(imageId, groupId) {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  return groupLists.find(group => group.id === groupId).groupNumbers.includes(imageId);
}

/**
 * @description: 如果没有传入分组名，则创建一个新的分组名，如果传入了分组名，则判断是否存在，如果存在则在后面加上数字
 * @param {*} groupName
 * @return {*}
 */
export function createNewGroupName(groupName) {
  let firsetName = ''
  if (!groupName || groupName === '') {
    firsetName = defaultGroupNamePrefix
  } else {
    firsetName = groupName
  }
  let newName = firsetName
  let index = 1
  while (isGroupNameExist(newName)) {
    newName = `${firsetName}(${index++})`
  }
  return newName
}

/**
 * @description: 获取分组id和分组名列表
 * @return {*}
 */
export function getGroupIdAndNameLists() {
  const schemaStore = useSchemaStore();
  const groupLists = schemaStore.getGroupInfo;
  return groupLists.map(group => {
    return {
      id: group.id,
      name: group.name
    }
  })
}

/**
 * @description: 创建一个新的分组id
 * @return {*}
 */
export function createGroupId() {
  let newId = 'group_' + Date.now()
  while (isGroupIdExist(newId)) {
    newId = 'group_' + Date.now()
  }
  return newId
}

export function getAutoGroupGPSInfo(imageId: string[]): IGPSInfo {
  let GPSLatitude, GPSLongitude, GPSAltitude;
  if (imageId.length > 0) {
    // 获取平均值
    const GPSInfo = getAvarageGPSInfo(imageId)
    GPSLatitude = GPSInfo.GPSLatitude
    GPSLongitude = GPSInfo.GPSLongitude
    GPSAltitude = GPSInfo.GPSAltitude
  } else {
    ElMessage.error('没有传入图片id')
    return { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 }
  }

  return { GPSLatitude, GPSLongitude, GPSAltitude }
}

/**
 * @description: 获取所有图片的GPS信息的平均值
 * @param {string} imageIds
 * @return {*}
 */
function getAvarageGPSInfo(imageIds: string[]): IGPSInfo {
  let avarageGPSAltitude = 0, avarageGPSLatitude = 0, avarageGPSLongitude = 0;
  const imageIdsLength = imageIds.length
  imageIds.forEach(imageId => {
    const { GPSAltitude, GPSLatitude, GPSLongitude } = getGPSInfoById(imageId)
    GPSAltitude && (avarageGPSAltitude += (GPSAltitude / imageIdsLength))
    GPSLatitude && (avarageGPSLatitude += (GPSLatitude / imageIdsLength))
    GPSLongitude && (avarageGPSLongitude += (GPSLongitude / imageIdsLength))
  })
  return {
    GPSLatitude: avarageGPSLatitude,
    GPSLongitude: avarageGPSLongitude,
    GPSAltitude: avarageGPSAltitude
  }
}

/**
 * @description: 解散分组
 * @param {*} groupId
 * @return {*}
 */
export async function dissolveGroupById(groupId) {
  const schemaStore = useSchemaStore()
  // 将分组内的图片重新添加到地图中
  let { groupNumbers } = schemaStore.getGroupInfo.filter(item => item.id === groupId)[0]
  // 只有不在其他分组内的图片才需要添加到地图中
  groupNumbers = groupNumbers?.filter(id => {
    return !isImageExistInOtherGroup(groupId, id)
  }) ?? []
  groupNumbers.forEach(imageId => {
    addExistImageToMapById(imageId)
  });
  // 删除分组信息
  await deleteGroupById(groupId, false)
}

/**
 * @description: 通过分组id获取分组信息
 * @param {string} groupId
 * @return {*}
 */
export function getGroupInfoByGroupId(groupId: string): IGroupInfo {
  const schemaStore = useSchemaStore()
  return schemaStore.getGroupInfo.filter(item => item.id === groupId)[0]
}

/**
 * @description: 判断图片是否还在其他分组中存在
 * @param {string} deleteGroupId
 * @param {string} deleteImageId
 * @return {*}
 */
export function isImageExistInOtherGroup(currentGroupId: string, imageId: string): boolean {
  const schemaStore = useSchemaStore()
  const otherGroupInfos = schemaStore.getGroupInfo.filter(item => item.id !== currentGroupId)
  return otherGroupInfos.some(groupInfo => {
    return groupInfo.groupNumbers?.includes(imageId)
  })
}

/**
 * @description: 从分组中移除图片
 * @param {string} groupId
 * @param {string} imageId
 * @return {*}
 */
export function removeGroupImage(groupId: string, imageId: string) {
  const schemaStore = useSchemaStore()
  let groupInfo: any = schemaStore.getGroupInfo
  // 移除分组中的图片
  groupInfo = groupInfo.map((item:any) => {
    if (item.id === groupId) {
      item.groupNumbers = item.groupNumbers?.filter((id: string) => {
        return id !== imageId
      })
      return item
    }
    return item
  })
  // 如果在别的分组里就不用在地图中添加了
  if (isImageExistInOtherGroup(groupId, imageId)) {
    return
  }
  addExistImageToMapById(imageId)
  editSchemaAttrAndSave('groupInfo', groupInfo)
  resetIconGroupMarker(groupId)
}

/**
 * @description: 删除分组
 * @param {*} groupId
 * @param {*} needDeleteImages 是否要删除分组内照片的schema信息
 * @return {*}
 */
export async function deleteGroupById(groupId: string, needDeleteImages = true) {
  const schemaStore = useSchemaStore()
  const groupInfo = getGroupInfoByGroupId(groupId)
  // 删除schema分组对应的图片数据
  let deleteGroupNumbers = groupInfo.groupNumbers
  if (!needDeleteImages) {
    deleteGroupNumbers = []
  }
  // 图片还存在其他分组中或者是其他节点中时，不删除
  deleteGroupNumbers = deleteGroupNumbers?.filter(id => {
    return !isImageExistInOtherGroup(groupId, id)
  })
  // 如果存在再删除
  deleteGroupNumbers && deleteGroupNumbers.forEach(imageId => {
    schemaStore.deleteImageInImageInfo(imageId)
  })

  // 删除schema中的分组信息
  schemaStore.deleteGroupInGroupInfo(groupId)
  // eventBus.emit('delete-image', groupId)
  saveSchema()
  return Promise.all([API.image.deleteImages({ deleteImages: deleteGroupNumbers })]).then(res => {
    deleteMarkerById(groupId)
    const tipMsg = res.reduce((msg, item) => {
      return msg + item.data
    }, '')
    // console.log('promise all ==>', res)
  })
}

/**
 * @description: 分组marker进入视图时的更新
 * @param {IGroupInfo} groupInfo
 * @return {*}
 */
export async function updateGroupMarkerImage(groupInfo: IGroupInfo) {
  if (!isGroupIdExist(groupInfo.id)) {
    console.error('分组不存在')
    return
  }
  const groupMark = getMarkerById(groupInfo.id)
  // 先只获取前4张图片
  const resImageUrls = await getImageUrlByIds(groupInfo.groupNumbers.slice(0, GROUP_COVER_NUMBER))
  if (!resImageUrls || resImageUrls.length === 0) {
    ElMessage.error('获取图片失败')
    return
  }
  const imageUrls = resImageUrls.map(item => {
    return item
  })
  const myIcon = L.divIcon({
    // 传值使用
    imageUrls,
    html: imageUrlsIcon(imageUrls),
    iconSize: GROUP_MARKER_SIZE,
    iconAnchor: [GROUP_MARKER_SIZE[0] / 2, groupMarkerTranslateY]
  })
  groupMark?.setIcon?.(myIcon)
}

/**
 * @description: 编辑分组
 * @return {*}
 */
export function editGroupById() {
  // TODO:编辑分组信息逻辑
}

/**
 * @description: 创建新分组，更新
 * @return {*}
 */
export async function createNewGroupToSchema(newGroupFromInfo: ICreateGroupInfoData, groupNumbers?: string[]): Promise<INewGroupFormData> {
  const schemaStore = useSchemaStore()
  const groupInfo = cloneDeep(schemaStore.getGroupInfo)
  const newId = createGroupId()
  const GPSInfo = newGroupFromInfo.newGroupInfo.newGroupGPSInfo
  const newGroupInfo = {
    name: newGroupFromInfo.newGroupInfo.newGroupName,
    id: newId,
    GPSInfo,
    groupNumbers: groupNumbers ?? [],
  }
  groupInfo.unshift(newGroupInfo)
  schemaStore.setSchemaAttr('groupInfo', groupInfo)
  await saveSchema()
  return newGroupInfo
}

/**
 * @description: 更新schema中的group信息
 * @param {string} groupId
 * @param {IGroupInfo} groupInfo
 * @return {*}
 */
export async function updateGroupInfoToSchema(groupId: string, groupInfo: IGroupInfo) {
  const schemaStore = useSchemaStore()
  let groupInfos = cloneDeep(schemaStore.getSchema.groupInfo)
  // 修改groupInfo
  groupInfos = groupInfos.map(item => {
    if (item.id === groupId) {
      return groupInfo
    } else {
      return item
    }
  })
  schemaStore.setSchemaAttr('groupInfo', groupInfos)
  await saveSchema()
  return groupInfo
}

// 排序的时间精度
export enum TimeType {
  YEAR = "year",
  MONTH = "month",
  DAY = "day",
}

// 排序方式
export enum SortType {
  ASC = 'ascending',
  DES = 'desending'
}

/**
 * @description: 格式化时间
 * @param {*}
 * @return {*}
 */
function normalizeTimestamp(timestampMs: number, precision: TimeType): string {
  // 如果传入的时间戳非法，则使用当前时间
  if (typeof timestampMs !== "number" || Number.isNaN(timestampMs)) {
    timestampMs = new Date().getTime()
  }
  const date = new Date(timestampMs);
  switch (precision) {
    case TimeType.YEAR:
      return `${date.getFullYear()}`;
    case TimeType.MONTH:
      return date.getFullYear() + "-" + padZero(date.getMonth() + 1);
    case TimeType.DAY:
      return (
        date.getFullYear() + "-" + padZero(date.getMonth() + 1) + "-" + padZero(date.getDate())
      );
  }
}

/**
 * @description: 十位补零
 * @param {*}
 * @return {*}
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * @description: 分组并生成一个map
 * @param {*}
 * @return {*}
 */
export function groupSorting(data: any, precision: TimeType, sort: SortType = SortType.ASC): Map<string, any[]> {
  // 排序
  data.sort((a: any, b: any) => {
    return sort === SortType.ASC ? a.time - b.time : b.time - a.time
  });
  // 时间精度处理
  data.forEach((item: any) => {
    item.formatTime = normalizeTimestamp(item.time, precision);
  })
  // 分组
  const groupMap: Map<string, any[]> = new Map();
  data.forEach((item: any) => {
    const key = item.formatTime;
    let timeArr = groupMap.get(key);
    if (timeArr) {
      timeArr.push({ ...item });
    } else {
      groupMap.set(key, [{ ...item }]);
    }
  })
  return groupMap
}
