<template>
  <el-dialog :z-index="9999" v-model="show" title="设置分组信息" style="width: 440px;">
    <el-form ref="groupFormRef" :model="singleImageGroupInfoFormData" style="width: 400px" label-width="auto"
      :rules="groupEditRules">
      <el-form-item label="目标分组" label-width="90px" prop="groupIds">
        <!-- 下拉框选择已有的分组 -->
        <el-select v-model="singleImageGroupInfoFormData.groupIds" multiple placeholder="请选择分组">
          <el-option v-for="item in groupIdAndNameLists" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="加入新分组" label-width="90px">
        <Switch :options="[{ value: true, label: '是' }, { value: false, label: '否' }]"
          v-model="singleImageGroupInfoFormData.needAddNewGroup">
        </Switch>
      </el-form-item>
      <!-- 新分组相关 -->
      <template v-if="singleImageGroupInfoFormData.needAddNewGroup">
        <el-form-item label="新分组名称" label-width="90px" prop="newGroupName">
          <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupName"></el-input>
        </el-form-item>
        <el-form-item label="新分组位置" label-width="90px">
          <Switch :options="[{ value: 'auto', label: '自动定位' }, { value: 'manual', label: '手动定位' }]"
            v-model="singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo">
          </Switch>
        </el-form-item>
        <template v-if="singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo === 'manual'">
          <el-form-item label="新分组经度" label-width="90px" prop="GPSLongitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLongitude"></el-input>
          </el-form-item>
          <el-form-item label="新分组纬度" label-width="90px" prop="GPSLatitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLatitude"></el-input>
          </el-form-item>
          <el-form-item label="新分组海拔" label-width="90px" prop="GPSAltitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSAltitude" placeholder="0"></el-input>
          </el-form-item>
        </template>
      </template>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="locateNewGroup"
          v-if="singleImageGroupInfoFormData.needAddNewGroup && singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo === 'manual'"
          class="locate-button" type="primary" >手动定位</el-button>
        <el-button @click="closeGroupEdit">取消</el-button>
        <el-button type="primary" @click="pushImageToGroupInfo">
          确认
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
import { ElMessage } from 'element-plus'
import { getAutoGroupGPSInfo, updateGroupMarkerImage } from '@/utils/group'
import type { IGroupInfo, ISchema } from '@/type/schema'
import { addGroupMarkerToMap, MAP_INSTANCE, hiddenMarkerById, addManualLocateGroupToMap } from '@/utils/map'

const props = defineProps({
  imageIds: {
    type: Array<string>,
    default: () => []
  }
})

const schemaStore = useSchemaStore()

const show = defineModel({ default: false })
const groupFormRef = ref()

type ISingleImageGroupInfoFormData = {
  groupIds: string[]
  imageIds: string[]
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
// 单张图片对应的分组信息
const singleImageGroupInfoFormData: Ref<ISingleImageGroupInfoFormData> = ref({
  // TODO:应该可以被分到多组中
  groupIds: [],
  // 需要被分配的图片ids
  imageIds: props.imageIds,
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

watch(() => show.value, (newVal) => {
  if (newVal) {
    singleImageGroupInfoFormData.value.imageIds = props.imageIds
  }
}, { immediate: true })

const groupIdAndNameLists = ref([])

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
  const hiddenImageIds = formData.imageIds
  // 往schemaStore中添加分组信息
  const newGroupInfo = updateGroupInfoInSchema(formData)
  // 保存最新的schema信息
  const res = await saveSchema()
  if (res.code === 200) {
    ElMessage.success('分组信息设置成功')
    // 更新地图中的节点
    updateVisibleMarkersByFormData(newGroupInfo, hiddenImageIds, draggable)
  } else {
    ElMessage.error('分组信息设置失败')
  }
}

/**
 * @description: 往schemaStore中添加分组信息
 * @param {*} formData
 * @return {*} 返回新分组的信息，如果没有就返回null
 */
function updateGroupInfoInSchema(formData: ISingleImageGroupInfoFormData): IGroupInfo {
  let resNewGroupInfo: IGroupInfo = null
  const schema = schemaStore.getSchema
  // 涉及到的groupId
  const groupIds = [...formData.groupIds]
  if (formData.needAddNewGroup) {
    // 如果需要新建分组，则生成一个新的组件id
    groupIds.push(createGroupId())
  }
  const groupInfo = schema.groupInfo
  if (groupIds.length) {
    // 如果有分组id，则需要将图片添加到分组中
    groupIds.forEach((groupId) => {
      // 获取已有的分组信息
      const group = groupInfo.find((item) => item.id === groupId)
      if (group) {
        // 如果分组存在，则将图片添加到分组中
        group.groupNumbers = [...new Set([...group.groupNumbers, ...formData.imageIds])]
        // 并将图片添加到分组所在的marker中
        updateGroupMarkerImage(group)
      } else { // 如果分组不存在，则新建一个分组
        // 如果是自动定位，则需要获取当前的经纬度
        if (formData.newGroupInfo.needSetGPSInfo === 'auto') {
          // 获取自动定位的位置信息的算法
          const { GPSLatitude, GPSLongitude, GPSAltitude } = getAutoGroupGPSInfo(formData.imageIds)
          formData.newGroupInfo.newGroupGPSInfo.GPSLatitude = GPSLatitude
          formData.newGroupInfo.newGroupGPSInfo.GPSLongitude = GPSLongitude
          formData.newGroupInfo.newGroupGPSInfo.GPSAltitude = GPSAltitude
        }
        resNewGroupInfo = {
          id: groupId,
          name: formData.newGroupInfo.newGroupName,
          groupNumbers: formData.imageIds,
          GPSInfo: formData.newGroupInfo.newGroupGPSInfo
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
    hiddenMarkerById(imageId)
  })
  if (newGroupInfo) {
    if (draggable) {
      addManualLocateGroupToMap(newGroupInfo)
      return
    }
    // 添加新的分组点位
    addGroupMarkerToMap(newGroupInfo)
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
        callback(new Error("请选择分组或者新建分组！"));
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
          callback(new Error("分组名称已存在！"));
        }
        //校验通过
        callback();
      } else {
        callback(new Error("请输入分组名称！"));
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
        callback(new Error("请输入经度！"));
      } else if (!isNumber(GPSLongitude)) {
        callback(new Error("请输入数字！"));
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
        callback(new Error("请输入经度！"));
      } else if (!isNumber(GPSLatitude)) {
        callback(new Error("请输入数字！"));
      }
    }, trigger: 'blur'
  }],
  isCover: [{}]
})
</script>

<style lang="scss" scoped></style>