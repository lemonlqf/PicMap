/*
 * @Author: Do not edit
 * @Date: 2025-02-25 20:32:28
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-04-30 13:55:30
 * @FilePath: \Code\picMap_fontend\src\utils\group.ts
 * @Description: 分组相关的一些方法
 */
import { useSchemaStore } from '@/store/schema'
import { IGPSInfo } from '@/type/schema';
import { ElMessage } from 'element-plus';
import { getGPSInfoById } from '@/utils/map';

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
