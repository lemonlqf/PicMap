<!--
 * @Author: Do not edit
 * @Date: 2026-03-11 16:40:55
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-11 16:40:55
 * @FilePath: \PicMap\picMap_fontend\src\components\drawer\components\TimePrecision.vue
 * @Description: 时间精度选择组件
 *   - 用于选择按年/月/日分组
 -->
<template>
  <el-radio-group v-model="precision" size="small">
    <template v-for="item in radioOptions" :key="item.value">
      <el-radio-button :label="item.label" :value="item.value" />
    </template>
  </el-radio-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TimeType } from '@/utils/group'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const precision = defineModel<TimeType>()

const radioOptions = computed(() => [
  {
    label: t('year'),
    value: TimeType.YEAR
  },
  {
    label: t('month'),
    value: TimeType.MONTH
  },
  {
    label: t('day'),
    value: TimeType.DAY
  },
])
</script>

<style lang="scss" scoped>
</style>
