<template>
  <el-dialog :z-index="9999" v-model="show" title="创建新分组" style="width: 440px;">
    <el-form ref="groupFormRef" :model="createGroupInfoFormData" style="width: 400px" label-width="auto"
      :rules="groupEditRules">
      <el-form-item label="分组名称" label-width="90px" prop="newGroupName">
        <el-input v-model="createGroupInfoFormData.newGroupInfo.newGroupName"></el-input>
        {{ createGroupInfoFormData.newGroupInfo.newGroupName }}
      </el-form-item>
      <!-- <el-form-item label="新分组经度" label-width="90px" prop="GPSLongitude">
        <el-input v-model="createGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLongitude"></el-input>
        {{ createGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLongitude }}
      </el-form-item>
      <el-form-item label="新分组纬度" label-width="90px" prop="GPSLatitude">
        <el-input v-model="createGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLatitude"></el-input>
        {{ createGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSLatitude }}
      </el-form-item>
      <el-form-item label="新分组海拔" label-width="90px" prop="GPSAltitude">
        <el-input v-model="createGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSAltitude" placeholder="0"></el-input>
        {{ createGroupInfoFormData.newGroupInfo.newGroupGPSInfo.GPSAltitude }}
      </el-form-item> -->
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <!-- <el-button @click="addManualLocateGroupToMap" class="locate-button" type="primary">手动定位</el-button> -->
        <el-button @click="closeGroupEdit">取消</el-button>
        <el-button type="primary" @click="createNewGroup">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, Ref } from 'vue'
import { isNumber } from '@/utils/regex'
import { getGroupIdAndNameLists } from '@/utils/group'
import { useSchemaStore } from '@/store/schema'
import Switch from '@/components/switch/Index.vue'
import { cloneDeep } from 'lodash-es'
import { IGroupInfo, ISchema } from '@/type/schema'
import { createGroupId } from '@/utils/group'
import { saveSchema } from '@/utils/schema'
import { ElMessage } from 'element-plus'
import type { ICreateGroupInfoData } from '@/type/group'
import { getAutoGroupGPSInfo, updateGroupMarkerImage, createNewGroupToSchema } from '@/utils/group'
import { addGroupMarkerToMap, MAP_INSTANCE, hiddenMarkerById, addManualLocateImageToMap, addManualLocateGroupToMap } from '@/utils/map'
const show = defineModel({ default: false })


const groupFormRef = ref()

// 单张图片对应的分组信息
const createGroupInfoFormData: Ref<ICreateGroupInfoData> = ref({
  // 如果需要添加到新分组中，则需要填写新分组信息
  newGroupInfo: {
    newGroupName: '',
    newGroupGPSInfo: {
      GPSAltitude: null,
      GPSLatitude: null,
      GPSLongitude: null
    }
  },
})

const schemaStore = useSchemaStore()
const groupIdAndNameLists = ref([])

watch(() => schemaStore.getGroupInfo, (newVal) => {
  groupIdAndNameLists.value = getGroupIdAndNameLists()
}, { immediate: true, deep: true })

const groupEditRules = reactive({
  newGroupName: [{
    validator: function (rule, value, callback) {
      const newGroupName = createGroupInfoFormData.value?.newGroupInfo?.newGroupName
      if (newGroupName?.length > 0) {
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
      const GPSLongitude = createGroupInfoFormData.value?.newGroupInfo?.newGroupGPSInfo.GPSLongitude
      if (isNumber(GPSLongitude)) {
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
      const GPSLatitude = createGroupInfoFormData.value?.newGroupInfo?.newGroupGPSInfo.GPSLatitude
      if (isNumber(GPSLatitude)) {
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

/**
 * @description: 重置表单
 * @return {*}
 */
function resetGroupForm() {
  createGroupInfoFormData.value.newGroupInfo.newGroupName = ''
  createGroupInfoFormData.value.newGroupInfo.newGroupGPSInfo.GPSAltitude = null
  createGroupInfoFormData.value.newGroupInfo.newGroupGPSInfo.GPSLatitude = null
  createGroupInfoFormData.value.newGroupInfo.newGroupGPSInfo.GPSLongitude = null
}

function closeGroupEdit() {
  resetGroupForm()
  show.value = false
}

/**
 * @description: 创建新分组
 * @return {*}
 */
function createNewGroup() {
  groupFormRef.value.validate(async (valid, fields) => {
    if (valid) {
      // 将新分组信息添加到schema中
      const newGroupInfo = await createNewGroupToSchema(createGroupInfoFormData.value)
      const GPSInfo = newGroupInfo.GPSInfo
      if (GPSInfo) {
        // 往地图上添加groupMarker
        addGroupMarkerToMap(newGroupInfo as IGroupInfo)
      }
      closeGroupEdit()
    } else {
      console.log('error submit!', fields)
    }
  })
}


</script>

<style lang="scss" scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;

  .locate-button {
    flex: 1;
    margin-right: 50px;
    margin-left: 10px;
    justify-self: flex-start
  }
}
</style>