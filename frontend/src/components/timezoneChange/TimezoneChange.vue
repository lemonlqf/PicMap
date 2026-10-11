<!--
 * @Description: 时区选择
 * - 用于解释 GPX / 文件名中「不带时区信息」的时间戳（默认东八区 UTC+08:00）
 * - 时间戳自带时区标记（Z / ±HH:MM）时严格按时区解析，不受本设置影响
 * - 用户选择后持久化到 localStorage，重新打开相关弹框后生效
-->
<template>
  <div class="flex">
    <Clock width="20px" style="color: #542de2" />
    <el-select size="small" :model-value="selectedOffset" @change="changeTimezone" style="width: 170px">
      <el-option v-for="item in TIMEZONE_OPTIONS" :key="item.offsetMinutes" :label="item.label"
        :value="item.offsetMinutes" />
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { Clock } from '@element-plus/icons-vue'
import { TIMEZONE_OPTIONS, getTimezoneOffsetMinutes, setTimezoneOffsetMinutes } from '@/utils/timezone'

const { t } = useI18n()
const selectedOffset = ref<number>(getTimezoneOffsetMinutes())

function changeTimezone(offsetMinutes: number) {
  setTimezoneOffsetMinutes(offsetMinutes)
  ElMessage.success(t('timezone.saveSuccess'))
}
</script>

<style lang="scss" scoped>
.flex {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
