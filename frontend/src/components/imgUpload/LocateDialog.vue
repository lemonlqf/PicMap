<template>
  <el-dialog :z-index="9999" v-model="dialogVisible" :title="$t('setPictureLocation')" style="width: 440px;">
    <el-form ref="locateFromRef" :model="formData" style="width: 400px" label-width="auto"
      :rules="locateRules">
      <el-form-item :label="$t('longitude')" prop="GPSLongitude">
        <el-input v-model="formData.GPSLongitude"></el-input>
      </el-form-item>
      <el-form-item :label="$t('latitude')" prop="GPSLatitude">
        <el-input v-model="formData.GPSLatitude"></el-input>
      </el-form-item>
      <el-form-item :label="$t('altitude')" prop="GPSAltitude">
        <el-input v-model="formData.GPSAltitude" placeholder="0"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleManualLocate" class="locate-button" type="primary">{{ $t('manualLocate') }}</el-button>
        <el-button @click="handleCancel">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">
          {{ $t('confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMapStore } from '@/store/map'
import markerService from '@/services/marker'
import mapService from '@/services/map'

const { t } = useI18n()
const mapStore = useMapStore()

const props = defineProps<{
  imageId: string | null
}>()

const dialogVisible = defineModel<boolean>('modelValue', { required: true })

const formData = ref({
  id: null as string | null,
  GPSAltitude: null as number | null,
  GPSLatitude: null as number | null,
  GPSLongitude: null as number | null
})

watch(() => props.imageId, (newId) => {
  formData.value.id = newId
}, { immediate: true })

const locateFromRef = ref()

const locateRules = reactive({
  GPSLongitude: [{
    required: true,
    message: t('description.needLongitude'),
    trigger: 'change',
  }],
  GPSLatitude: [{
    required: true,
    message: t('description.needLatitude'),
    trigger: 'change',
  }]
})

function handleCancel() {
  resetForm()
  dialogVisible.value = false
}

function resetForm() {
  formData.value.id = null
  formData.value.GPSAltitude = null
  formData.value.GPSLatitude = null
  formData.value.GPSLongitude = null
}

async function handleConfirm() {
  if (!locateFromRef.value) return
  await locateFromRef.value.validate((valid, fields) => {
    if (valid) {
      emit('confirm', {
        id: formData.value.id,
        GPSLatitude: formData.value.GPSLatitude,
        GPSLongitude: formData.value.GPSLongitude,
        GPSAltitude: formData.value.GPSAltitude
      })
      dialogVisible.value = false
    }
  })
}

function handleManualLocate() {
  const MAP_INSTANCE = mapService.getMapInstance()
  const markerLatLng = MAP_INSTANCE.getCenter()
  formData.value.GPSLatitude = markerLatLng.lat
  formData.value.GPSLongitude = markerLatLng.lng
  emit('manualLocate', {
    id: formData.value.id,
    lat: markerLatLng.lat,
    lng: markerLatLng.lng
  })
  dialogVisible.value = false
}

const emit = defineEmits<{
  (e: 'confirm', data: { id: string | null; GPSLatitude: number | null; GPSLongitude: number | null; GPSAltitude: number | null }): void
  (e: 'manualLocate', data: { id: string | null; lat: number; lng: number }): void
}>()
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.locate-button {
  flex: 1;
  margin-right: 50px;
  margin-left: 10px;
  justify-self: flex-start
}
</style>