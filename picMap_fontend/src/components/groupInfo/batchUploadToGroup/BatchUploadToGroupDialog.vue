<template>
  <el-dialog :z-index="9999" v-model="show" :title="$t('batchUploadToGroup')" style="width: 440px;" :close-on-click-modal="!uploading">
    <el-form ref="groupFormRef" :model="formData" style="width: 400px" label-width="auto">
      <el-form-item :label="$t('targetGroup')" label-width="90px" prop="groupIds">
        <el-select v-model="formData.groupIds" multiple :placeholder="$t('placeholder.selectGroup')" style="width: 100%;" :disabled="uploading">
          <el-option v-for="item in groupIdAndNameLists" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>
    <LoadingTip v-if="uploading" :text="$t('uploadingPleaseWait')" />
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="closeDialog" :disabled="uploading">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="formData.groupIds.length === 0 || uploading">
          {{ $t('confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { getGroupIdAndNameLists } from '@/utils/group'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useSchemaStore } from '@/store/schema'
import LoadingTip from '@/components/loadingTip/Index.vue'

const { t } = useI18n()
const schemaStore = useSchemaStore()

defineProps({
  uploading: {
    type: Boolean,
    default: false
  }
})

const show = defineModel({ default: false })

const emit = defineEmits<{
  (e: 'confirm', groupIds: string[]): void
}>()

const formData = ref<{
  groupIds: string[]
}>({
  groupIds: []
})

interface IGroupIdAndName {
  id: string
  name: string
}

const groupIdAndNameLists = ref<IGroupIdAndName[]>([])

watch(() => show.value, (newVal) => {
  if (newVal) {
    formData.value.groupIds = []
    groupIdAndNameLists.value = getGroupIdAndNameLists()
  }
}, { immediate: true })

watch(() => schemaStore.getGroupInfo, () => {
  if (show.value) {
    groupIdAndNameLists.value = getGroupIdAndNameLists()
  }
}, { deep: true })

function handleConfirm() {
  if (formData.value.groupIds.length === 0) {
    ElMessage.warning(t('description.selectGroup'))
    return
  }
  emit('confirm', [...formData.value.groupIds])
}

function closeDialog() {
  formData.value.groupIds = []
  show.value = false
}
</script>

<style lang="scss" scoped>
</style>