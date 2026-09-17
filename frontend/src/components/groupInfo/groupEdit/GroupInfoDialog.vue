<template>
    <el-dialog :z-index="9999" v-model="show" :title="$t('setGroupInfo')" style="width: 440px;" append-to-body>
    <el-form ref="groupFormRef" :model="singleImageGroupInfoFormData" style="width: 400px" label-width="auto"
      :rules="groupEditRules">
      <el-form-item :label="$t('targetGroup')" label-width="90px" prop="groupIds">
        <!-- 下拉框选择已有的分组 -->
        <el-select v-model="singleImageGroupInfoFormData.groupIds" multiple :placeholder="$t('placeholder.selectGroup')"
          popper-class="group-info-group-select-popper">
          <el-option v-for="item in groupIdAndNameLists" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('joinNewGroup')" label-width="90px">
        <Switch :options="[{ value: true, label: $t('yes') }, { value: false, label: $t('no') }]"
          v-model="singleImageGroupInfoFormData.needAddNewGroup">
        </Switch>
      </el-form-item>
      <!-- 新分组相关 -->
      <template v-if="singleImageGroupInfoFormData.needAddNewGroup">
        <el-form-item :label="$t('newGroupName')" label-width=" 90px" prop="newGroupName">
          <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupName"></el-input>
        </el-form-item>
        <el-form-item :label="$t('newGroupLocation')" label-width=" 90px">
          <Switch :options="[{ value: 'auto', label: $t('autoLocate') }, { value: 'manual', label: $t('manualLocate') }]"
            v-model="singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo">
          </Switch>
        </el-form-item>
        <template v-if="singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo === 'manual'">
          <el-form-item :label="$t('newGroupLongitude')" label-width="90px" prop="GPSLongitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLongitude"></el-input>
          </el-form-item>
          <el-form-item :label="$t('newGroupLatitude')" label-width="90px" prop="GPSLatitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLatitude"></el-input>
          </el-form-item>
          <el-form-item :label="$t('newGroupAltitude')" label-width="90px" prop="GPSAltitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSAltitude"
              placeholder="0"></el-input>
          </el-form-item>
        </template>
      </template>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="locateNewGroup"
          v-if="singleImageGroupInfoFormData.needAddNewGroup && singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo === 'manual'"
          class="locate-button" type="primary">{{ $t('manualLocate') }}</el-button>
        <el-button @click="closeGroupEdit">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="pushImageToGroupInfo">
          {{ $t('confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, type Ref } from 'vue'
import { isNumber } from '@/utils/regex'
import { getGroupIdAndNameLists } from '@/utils/group'
import { useSchemaStore } from '@/store/schema'
import Switch from '@/components/switch/Index.vue'
import { cloneDeep } from 'lodash-es'
import { createGroupId } from '@/utils/group'
import { saveSchema } from '@/utils/schema'
import { getVideoInfoById } from '@/utils/schema'
import { ElMessage } from 'element-plus'
import { getAutoGroupGPSInfo, updateGroupMarkerImage } from '@/utils/group'
import type { IGroupInfo, ISchema } from '@/type/schema'
import markerService from '@/services/marker'
import mapService from '@/services/map'

import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  imageIds: {
    type: Array<string>,
    default: () => []
  },
  // 视频 id 列表：与 imageIds 互斥使用，用于将视频加入分组
  videoIds: {
    type: Array<string>,
    default: () => []
  }
})

const schemaStore = useSchemaStore()

const show = defineModel({ default: false })
const groupFormRef = ref()

// 分组设置完成事件，如果图片还未上传则触发自动上传
const emit = defineEmits<{
  (e: 'groupSetupComplete', imageIds: string[]): void
}>()

type ISingleImageGroupInfoFormData = {
  groupIds: string[]
  imageIds: string[]
  videoIds: string[]
  needAddNewGroup: boolean
  newGroupInfo: {
    newGroupName: string
    needSetGPSInfo: 'auto' | 'manual'
    newGroupGPSInfo: {
      GPSAltitude: number | null
      GPSLatitude: number | null
      GPSLongitude: number | null
    }
  },
  isCover: boolean
}
// 单张图片/单个视频对应的分组信息
const singleImageGroupInfoFormData: Ref<ISingleImageGroupInfoFormData> = ref({
  // TODO:应该可以被分到多组中
  groupIds: [],
  // 需要被分配的图片ids
  imageIds: props.imageIds,
  // 需要被分配的视频ids
  videoIds: props.videoIds,
  // 是否要添加到新分组中
  needAddNewGroup: false,
  // 如果需要添加到新分组中，则需要填写新分组信息
  newGroupInfo: {
    newGroupName: '',
    needSetGPSInfo: 'auto',
    newGroupGPSInfo: {
      GPSAltitude: null,
      GPSLatitude: null,
      GPSLongitude: null
    }
  },
  // 是否作为封面图
  isCover: false
})

const groupIdAndNameLists = ref<Array<{ id: string; name: string }>>([])

watch(() => show.value, (newVal) => {
  if (newVal) {
    singleImageGroupInfoFormData.value.imageIds = props.imageIds
    singleImageGroupInfoFormData.value.videoIds = props.videoIds
    // 打开时刷新分组列表，避免挂载时机早于分组数据导致下拉为空
    groupIdAndNameLists.value = getGroupIdAndNameLists()
  }
}, { immediate: true })

watch(() => schemaStore.getGroupInfo, (newVal) => {
  groupIdAndNameLists.value = getGroupIdAndNameLists()
}, { immediate: true, deep: true })

/**
 * @description:
 * @return {*}
 */
function showGroupDialog(imageId) {
  resetGroupForm()
  singleImageGroupInfoFormData.value.imageIds = [imageId]
  show.value = true
}

/**
 * @description: 重置表单
 * @return {*}
 */
function resetGroupForm() {
  singleImageGroupInfoFormData.value.groupIds = []
  singleImageGroupInfoFormData.value.imageIds = []
  singleImageGroupInfoFormData.value.videoIds = []
  singleImageGroupInfoFormData.value.needAddNewGroup = false
  singleImageGroupInfoFormData.value.isCover = false
}

function pushImageToGroupInfo() {
  groupFormRef.value.validate((valid, fields) => {
    if (valid) {
      console.log(singleImageGroupInfoFormData.value)
      // 将新分组信息添加到schema中
      handleNewGroupInfo(singleImageGroupInfoFormData.value)
      closeGroupEdit()
    } else {
      console.log('error submit!', fields)
    }
  })
}

/**
 * @description: 将新分组信息添加到schema中
 * @param {*} formData
 * @return {*}
 */
async function handleNewGroupInfo(formData: ISingleImageGroupInfoFormData, draggable = false) {
  // 注意：本函数 await saveSchema 期间，调用方会同步执行 closeGroupEdit → resetGroupForm 清空表单，
  // 因此必须在 await 之前就把需要用到的数据全部捕获出来。
  const hiddenImageIds = [...(formData.imageIds ?? [])]
  const hiddenVideoIds = new Set<string>(formData.videoIds ?? [])
  const groupIds = [...formData.groupIds]
  // 往schemaStore中添加分组信息
  const newGroupInfo = updateGroupInfoInSchema(formData)
  // 受影响的分组（已有 + 新建），同步捕获其 videoNumbers 用于隐藏视频节点
  const affectedGroupIds = [...groupIds, newGroupInfo?.id].filter(Boolean) as string[]
  affectedGroupIds.forEach(gid => {
    const group = schemaStore.getGroupInfo.find((item: any) => item.id === gid)
    ;(group?.videoNumbers ?? []).forEach((vid: string) => hiddenVideoIds.add(vid))
  })
  // 保存最新的schema信息
  const res = await saveSchema()
  if (res.code === 200) {
    ElMessage.success(t('description.editGroupInfoSuccess'))
    // 更新地图中的节点
    updateVisibleMarkersByFormData(newGroupInfo, hiddenImageIds, draggable)
    // 分组内视频节点从地图隐藏
    hiddenVideoIds.forEach(videoId => {
      markerService.hiddenMarkerById(videoId)
    })
    // 分组归属变化后强制重建聚合索引（分组内图片/视频不再单独显示）
    markerService.refreshClusters()
    // 通知父组件，分组设置完成，需要自动上传这些图片
    emit('groupSetupComplete', hiddenImageIds)
  } else {
    ElMessage.error(t('description.editGroupInfoFail'))
  }
}

/**
 * @description: 计算待加入分组的视频的 GPS 平均值（自动定位新分组用）
 * @param {string[]} videoIds
 * @return {*} GPS 平均值，无有效坐标时返回 null
 */
function getAutoGroupGPSInfoByVideos(videoIds: string[]): { GPSLatitude: number; GPSLongitude: number; GPSAltitude: number } | null {
  let lat = 0, lng = 0, count = 0
  videoIds.forEach(videoId => {
    const video = getVideoInfoById(videoId)
    if (video?.GPSLatitude && video?.GPSLongitude) {
      lat += video.GPSLatitude
      lng += video.GPSLongitude
      count++
    }
  })
  if (count === 0) return null
  return { GPSLatitude: lat / count, GPSLongitude: lng / count, GPSAltitude: 0 }
}

/**
 * @description: 往schemaStore中添加分组信息
 * @param {*} formData
 * @return {*} 返回新分组的信息，如果没有就返回null
 */
function updateGroupInfoInSchema(formData: ISingleImageGroupInfoFormData): IGroupInfo {
  let resNewGroupInfo: IGroupInfo = null
  const schema = schemaStore.getSchema
  const imageIds = formData.imageIds ?? []
  const videoIds = formData.videoIds ?? []
  // 涉及到的groupId
  const groupIds = [...formData.groupIds]
  if (formData.needAddNewGroup) {
    // 如果需要新建分组，则生成一个新的组件id
    groupIds.push(createGroupId())
  }
  const groupInfo = schema.groupInfo
  if (groupIds.length) {
    // 如果有分组id，则需要将图片/视频添加到分组中
    groupIds.forEach((groupId) => {
      // 获取已有的分组信息
      const group = groupInfo.find((item) => item.id === groupId)
      if (group) {
        // 如果分组存在，则将图片添加到分组中
        group.groupNumbers = [...new Set([...(group.groupNumbers || []), ...imageIds])]
        // 将视频添加到分组中
        if (videoIds.length) {
          group.videoNumbers = [...new Set([...(group.videoNumbers || []), ...videoIds])]
        }
        // 并将图片添加到分组所在的marker中（视频加入时同样需要刷新分组图标计数/封面）
        if (imageIds.length || videoIds.length) {
          updateGroupMarkerImage(group)
        }
      } else { // 如果分组不存在，则新建一个分组
        // 如果是自动定位，则需要获取当前的经纬度
        if (formData.newGroupInfo.needSetGPSInfo === 'auto') {
          // 优先用图片平均坐标，无图片时回退到视频平均坐标
          let autoGPS = null
          if (imageIds.length) {
            const { GPSLatitude, GPSLongitude, GPSAltitude } = getAutoGroupGPSInfo(imageIds)
            autoGPS = { GPSLatitude, GPSLongitude, GPSAltitude }
          } else if (videoIds.length) {
            autoGPS = getAutoGroupGPSInfoByVideos(videoIds)
          }
          if (autoGPS) {
            formData.newGroupInfo.newGroupGPSInfo.GPSLatitude = autoGPS.GPSLatitude
            formData.newGroupInfo.newGroupGPSInfo.GPSLongitude = autoGPS.GPSLongitude
            formData.newGroupInfo.newGroupGPSInfo.GPSAltitude = autoGPS.GPSAltitude
          }
        }
        resNewGroupInfo = {
          id: groupId,
          name: formData.newGroupInfo.newGroupName,
          groupNumbers: imageIds,
          GPSInfo: formData.newGroupInfo.newGroupGPSInfo
        }
        if (videoIds.length) {
          resNewGroupInfo.videoNumbers = [...videoIds]
        }
        groupInfo.push(resNewGroupInfo)
      }
    })
  }
  return resNewGroupInfo
}

/**
 * @description: 手动定位新分组
 * @return {*}
 */
function locateNewGroup() {
  const MAP_INSTANCE = mapService.getMapInstance()
  const { lat, lng } = MAP_INSTANCE.getCenter()
  // 取地图中心位置
  singleImageGroupInfoFormData.value.newGroupInfo.newGroupGPSInfo.GPSLatitude = lat
  singleImageGroupInfoFormData.value.newGroupInfo.newGroupGPSInfo.GPSLongitude = lng
  singleImageGroupInfoFormData.value.newGroupInfo.newGroupGPSInfo.GPSAltitude = 0
  groupFormRef.value.validate((valid, fields) => {
    if (valid) {
      console.log(singleImageGroupInfoFormData.value)
      // 将新分组信息添加到schema中
      handleNewGroupInfo(singleImageGroupInfoFormData.value, true)
      closeGroupEdit()
    } else {
      console.log('error submit!', fields)
    }
  })
}

/**
 * @description: 添加新分组，删除在分组中的图片
 * @param {*} newGroupInfo
 * @param {*} deleteMarkerIds
 * @param {*} draggable 是否需要移动
 * @return {*}
 */
function updateVisibleMarkersByFormData(newGroupInfo: IGroupInfo, hiddenMarkerIds: string[], draggable = false) {
  // 将分配到组件中的图片隐藏
  hiddenMarkerIds.forEach((imageId) => {
    markerService.hiddenMarkerById(imageId)
  })
  if (newGroupInfo) {
    if (draggable) {
      markerService.addManualLocateGroupMarkerToMap(newGroupInfo)
      return
    }
    // 添加新的分组点位
    markerService.addGroupMarkerToMap(newGroupInfo)
  }
}

function closeGroupEdit() {
  resetGroupForm()
  show.value = false
}

const groupEditRules = reactive({
  groupIds: [{
    validator: function (rule, value, callback) {
      if (singleImageGroupInfoFormData.value.needAddNewGroup === false && value.length === 0) {
        callback(new Error(t('description.selectOrCreateGroup')));
      } else {
        //校验通过
        callback();
      }
    }, trigger: 'blur'
  }],
  newGroupName: [{
    validator: function (rule, value, callback) {
      const newGroupName = singleImageGroupInfoFormData.value?.newGroupInfo?.newGroupName
      if (singleImageGroupInfoFormData.value.needAddNewGroup === true && newGroupName?.length > 0) {
        // 如果分组名称已经存在了校验则不通过
        if (groupIdAndNameLists.value.some(item => item.name === newGroupName)) {
          callback(new Error(t('groupNameExist')));
        }
        //校验通过
        callback();
      } else {
        callback(new Error(t('description.enterGroupName')));
      }
    }, trigger: 'blur'
  }],
  GPSLongitude: [{
    validator: function (rule, value, callback) {
      const GPSLongitude = singleImageGroupInfoFormData.value?.newGroupInfo?.newGroupGPSInfo.GPSLongitude
      if (singleImageGroupInfoFormData.value.needAddNewGroup === true && singleImageGroupInfoFormData.value.newGroupInfo.needSetGPSInfo === 'manual' && isNumber(GPSLongitude)) {
        //校验通过
        callback();
      } else if (!GPSLongitude) {
        callback(new Error(t('description.enterLongitude')));
      } else if (!isNumber(GPSLongitude)) {
        callback(new Error(t('description.enterNumber')));
      }
    }, trigger: 'blur'
  }],
  GPSLatitude: [{
    validator: function (rule, value, callback) {
      const GPSLatitude = singleImageGroupInfoFormData.value?.newGroupInfo?.newGroupGPSInfo.GPSLatitude
      if (singleImageGroupInfoFormData.value.needAddNewGroup === true && singleImageGroupInfoFormData.value.newGroupInfo.needSetGPSInfo === 'manual' && isNumber(GPSLatitude)) {
        //校验通过
        callback();
      } else if (!GPSLatitude) {
        callback(new Error(t('description.enterLongitude')));
      } else if (!isNumber(GPSLatitude)) {
        callback(new Error(t('description.enterNumber')));
      }
    }, trigger: 'blur'
  }],
  isCover: [{}]
})
</script>

<style lang="scss" scoped>
:deep() {
  .el-form-item--default .el-form-item__label {
    line-height: 14px;
    transform: translateY(6px);
  }
}
</style>

<style>
/* 目标分组下拉需要高于弹框（弹框硬编码 z-index=9999，默认 popper 层级会落在其下导致无法点选） */
.group-info-group-select-popper.el-popper {
  z-index: 10000 !important;
}
</style>