/*
 * @Author: Do not edit
 * @Date: 2025-01-26 18:21:16
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-10 22:58:53
 * @FilePath: \PicMap\Code\picMap_fontend\src\utils\schema.ts
 * @Description:
 */
import { useSchemaStore } from '@/store/schema'
import { cloneDeep, set } from 'lodash-es'
import API from '@/http/index'
import type { ISchema, IGroupInfo, IImageInfo, IShowType } from '@/type/schema'

type IGroupList = IGroupInfo & {
  showType: 'group'
}

type IImageList = IImageInfo & {
  showType: 'image'
}

type IGroupAndImageList = (IGroupList | IImageList)[]

/**
 * @description: 获取图片组和图片列表，用于直接在地图上展示
 * @return {*}
 */
export function getGroupAndImageList() {
  const schemaStore = useSchemaStore()
  console.log('-----------', schemaStore.getSchema)
  const imageInfo = cloneDeep(schemaStore.getSchema.imageInfo) as IImageList[]
  const groupInfo = cloneDeep(schemaStore.getSchema.groupInfo) as IGroupList[]
  const imageIdInGroup = []
  const res: IGroupAndImageList = []
  // 将分组的信息放到res中
  groupInfo?.forEach?.(item => {
    // 将本来在放到imageIdInGroup，后续剩余的照片就不放到返回的结果中
    item.groupNumbers && imageIdInGroup.push(...item.groupNumbers)
    item.showType = 'group'
    res.push(item)
  })
  // 将不在分组内的照片放到res中
  imageInfo?.forEach?.(item => {
    if (!imageIdInGroup.includes(item.id)) {
      item.showType = 'image'
      res.push(item)
    }
  })
  return res
}

/**
 * @description: 获取图片或者分组中schema的信息
 * @param {*} id
 * @return {*}
 */
export function getSchemaInfoById(id) {
  const schemaStore = useSchemaStore()
  const groupInfo = schemaStore.getSchema.groupInfo
  const imageInfo = schemaStore.getSchema.imageInfo
  const filterGroupInfo = groupInfo.find(item => {
    return item.id === id
  })
  const filterImageInfo = imageInfo.find(item => {
    return item.id === id
  })
  if (filterGroupInfo) {
    return {...filterGroupInfo, showType: 'group'}
  }
  if (filterImageInfo) {
    return {...filterImageInfo, showType: 'image'}
  }
  else {
    return null
  }
}

/**
 * @description: 判断图片是否已经上传了
 * @param {*} id
 * @return {*}
 */
export function judgeHadUploadImage(id) {
  const schemaStore = useSchemaStore()
  return schemaStore.getUploadedImageIds.some(item => {
    return item === id
  })
}

/**
 * @description: 获取schema中imageInfo的所有id
 * @return {*}
 */
export function getAllImageIdInSchema() {
  const schemaStore = useSchemaStore()
  const res = schemaStore?.getSchema?.imageInfo?.map(item => item.id)
  return res
}

export function getAllGroupIdInSchema() {
  const schemaStore = useSchemaStore()
  const res = schemaStore?.getSchema?.groupInfo?.map(item => item.id)
  return res
}

/**
 * @description: 保存schema
 * @return {*}
 */
export async function saveSchema() {
  const schemaStore = useSchemaStore()
  const schema = cloneDeep(schemaStore.getSchema)
  const updateImages = schemaStore.getUploadedImageIds
  // 只保留已经上传的图片信息（剔除未上传的）
  schema.imageInfo = schema.imageInfo.filter(item => {
    return updateImages.includes(item.id)
  })
  schema?.imageInfo?.forEach?.(item => {
    // 删除url，精简schema
    delete item.url
  })
  const res = await API.schema.setSchema({ schema: JSON.stringify(schema) })
  return res
}

/**
 * @description: 
 * @param {string} id
 * @param {string} attr
 * @param {any} value
 * @return {*}
 */
export async function editSchemaAndSave(id: string, attr: string, value: any) {
  const schemaStore = useSchemaStore()
  const groupInfos = schemaStore.getSchema.groupInfo
  const imageInfos = schemaStore.getSchema.imageInfo
  const groupOrImageInfo = [...groupInfos, ...imageInfos].find(item => {
    return item.id === id
  })
  set(groupOrImageInfo, attr, value)
  await saveSchema()
}

/**
 * @description: 编辑schema属性
 * @param {string} attr
 * @param {any} value
 * @return {*}
 */
export async function editSchemaAttrAndSave(attr: string, value: any) {
  const schemaStore = useSchemaStore()
  const schema = schemaStore.getSchema
  set(schema, attr, value)
  const newSchema = cloneDeep(schemaStore.getSchema)
  // 单独掉接口，不要走处理图片的逻辑
  await API.schema.setSchema({ schema: JSON.stringify(newSchema) })
}

/**
 * @description: 将图片的"2024:06:09 16:15:43"格式的日期转化为时间戳
 * @param {string} str
 * @return {*}
 */
export function exifDateToTimestamp(str: string) {
  // str: "2024:06:09 16:15:43"
  if (!str) return null;
  // 替换冒号为横杠，只替换前两个
  const norm = str.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  return new Date(norm).getTime();
}