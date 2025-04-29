<template>
  <el-dialog z-index="99999" v-model="show" title="设置分组信息" style="width: 440px;">
    <el-form ref="groupFormRef" :model="singleImageGroupInfoFormData" style="width: 400px" label-width="auto"
      :rules="groupEditRules">
      <el-form-item label="目标分组" label-width="90px" prop="groupIds">
        <!-- 下拉框选择已有的分组 -->
        <el-select v-model="singleImageGroupInfoFormData.groupIds" multiple placeholder="请选择分组">
          <el-option v-for="item in groupIdAndNameLists" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
        {{ singleImageGroupInfoFormData.groupIds }}
        {{ '图片id' + singleImageGroupInfoFormData.imageIds }}
      </el-form-item>
      <el-form-item label="是否添加到新分组中？" label-width="90px">
        <Switch :options="[{ value: true, label: '是' }, { value: false, label: '否' }]"
          v-model="singleImageGroupInfoFormData.needAddNewGroup">
        </Switch>
        <span>{{ singleImageGroupInfoFormData.needAddNewGroup }}</span>
      </el-form-item>
      <!-- 新分组相关 -->
      <template v-if="singleImageGroupInfoFormData.needAddNewGroup">
        <el-form-item label="新分组名称" label-width="90px" prop="newGroupName">
          <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.newGroupName"></el-input>
          {{ singleImageGroupInfoFormData.newGroupInfo.newGroupName }}
        </el-form-item>
        <el-form-item label="新分组位置" label-width="90px">
          <Switch :options="[{ value: 'auto', label: '自动定位' }, { value: 'manual', label: '手动定位' }]"
            v-model="singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo">
          </Switch>
          {{ singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo }}
        </el-form-item>
        <template v-if="singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo === 'manual'">
          <el-form-item label="新分组经度" label-width="90px" prop="GPSLongitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.GPSLongitude"></el-input>
            {{ singleImageGroupInfoFormData.newGroupInfo.GPSLongitude }}
          </el-form-item>
          <el-form-item label="新分组纬度" label-width="90px" prop="GPSLatitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.GPSLatitude"></el-input>
            {{ singleImageGroupInfoFormData.newGroupInfo.GPSLatitude }}
          </el-form-item>
          <el-form-item label="新分组海拔" label-width="90px" prop="GPSAltitude">
            <el-input v-model="singleImageGroupInfoFormData.newGroupInfo.GPSAltitude" placeholder="0"></el-input>
            {{ singleImageGroupInfoFormData.newGroupInfo.GPSAltitude }}
          </el-form-item>
        </template>
      </template>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click=""
          v-if="singleImageGroupInfoFormData.needAddNewGroup && singleImageGroupInfoFormData.newGroupInfo.needSetGPSInfo === 'manual'"
          class="locate-button" type="primary">手动定位</el-button>
        <el-button @click="cancleGroupEdit">取消</el-button>
        <el-button type="primary" @click="pushImageToGroupInfo">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { isNumber } from '@/utils/regex.js'
import { getGroupIdAndNameLists } from '@/utils/group.js'
import { useSchemaStore } from '@/store/schema'
import Switch from '@/components/switch/Index.vue'

const props = defineProps({
  imageIds: {
    type: Array,
    default: () => []
  }
})

const schemaStore = useSchemaStore()

const show = defineModel({ default: false })
const groupFormRef = ref()
// 单张图片对应的分组信息
const singleImageGroupInfoFormData = ref({
  // TODO:应该可以被分到多组中
  groupIds: [],
  // 需要被分配的图片ids
  imageIds: [],
  needAddNewGroup: false,
  newGroupInfo: {
    newGroupName: '',
    needSetGPSInfo: 'auto' || 'manual',
    newGroupGPSInfo: {
      GPSAltitude: null,
      GPSLatitude: null,
      GPSLongitude: null
    }
  }
})

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
  singleImageGroupInfoFormData.value.imageIds = ''
  singleImageGroupInfoFormData.value.isCover = false
}

function pushImageToGroupInfo() {
  groupFormRef.value.validate((valid, fields) => {
    if (valid) {
      console.log(singleImageGroupInfoFormData.value)
      // show.value = false
    } else {
      console.log('error submit!', fields)
    }
  })
}

function cancleGroupEdit() {
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
        //校验通过
        callback();
      } else {
        callback(new Error("请输入分组名称！"));
      }
    }, trigger: 'blur'
  }],
  GPSLongitude: [{
    validator: function (rule, value, callback) {
      const GPSLongitude = singleImageGroupInfoFormData.value?.newGroupInfo?.GPSLongitude
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
      const GPSLatitude = singleImageGroupInfoFormData.value?.newGroupInfo?.GPSLatitude
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