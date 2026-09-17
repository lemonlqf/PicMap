<!--
 * @Description: 时区选择
 * - 用于解释 GPX 中不带时区信息的时间戳
 * - 用户选择后持久化到 localStorage，并提示重新打开相关弹框生效
-->
<template>
  <div class="timezone-change">
    <el-icon class="timezone-icon"><Clock /></el-icon>
    <el-select
      size="small"
      :model-value="selectedOffset"
      placeholder="Timezone"
      style="width: 150px"
      @change="changeTimezone"
    >
      <el-option
        v-for="item in TIMEZONE_OPTIONS"
        :key="item.offsetMinutes"
        :label="item.label"
        :value="item.offsetMinutes"
      />
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Clock } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  TIMEZONE_OPTIONS,
  getTimezoneOffsetMinutes,
  getSystemTimezoneOffsetMinutes,
  setTimezoneOffsetMinutes,
  isUsingSystemTimezone,
} from '@/utils/timezone'

const { t } = useI18n()

const selectedOffset = ref<number>(
  isUsingSystemTimezone() ? getSystemTimezoneOffsetMinutes() : getTimezoneOffsetMinutes()
)

function changeTimezone(offsetMinutes: number) {
  setTimezoneOffsetMinutes(offsetMinutes)
  ElMessage.success(t('timezone.saveSuccess'))
}
</script>

<style scoped>
.timezone-change {
  display: flex;
  align-items: center;
  gap: 10px;
}

.timezone-icon {
  font-size: 20px;
  color: #409eff;
}
</style>
