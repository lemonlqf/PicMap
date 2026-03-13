<!--
 * @Author: Do not edit
 * @Date: 2026-03-11 17:04:59
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-13 23:00:41
 * @FilePath: \PicMap\picMap_fontend\src\components\timeLine\TimeLine.vue
 * @Description: 
-->
<template>
  <div class="time-line-box">
    <el-tooltip :content="$t('timeline')">
      <TimeLineIcon :content="$t('timeline')" @click="toggleExpand" class="icon" />
    </el-tooltip>
    <div v-show="isExpanded" :class="['content-box', animateClass]">
      <!-- 日期 -->
      <TimePrecision class="time-precision" v-model="realStep"></TimePrecision>
      <!-- 范围框 -->
      <div class="time-line" ref="timeLineRef">
        <div ref="minSliderRef" class="min-slider slider-text">{{ getFormatterStr(dataRange.min) }}</div>
        <div ref="maxSliderRef" class="max-slider slider-text">{{ getFormatterStr(dataRange.max) }}</div>
        <LineChart class="line-chart" :showArea="true" :line-type="LineType.SMOOTH" :data="dataList"></LineChart>
      </div>
      <!-- 重置按钮 -->
      <el-tooltip :content="$t('reset')">
        <el-icon class="reset-btn" @click="resetTimeRange" :size="16">
          <Refresh />
        </el-icon>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type PropType } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import 'nouislider/dist/nouislider.css';
import noUiSlider from 'nouislider'
import { TimeType } from '@/utils/group';
import TimeLineIcon from '@/assets/icon/时间轴.svg?component'
import TimePrecision from '../drawer/components/TimePrecision.vue';
import LineChart from './component/LineChart.vue';
import { LineType, type TimeLineDataPoint } from '@/type/map';

const props = defineProps({
  // 时间精度模式（日、月、年）
  mode: {
    type: String as PropType<TimeType>,
    default: TimeType.MONTH // 目前只支持范围选择
  },
  // 步长，可以是具体数值或时间单位
  step: {
    type: String as PropType<TimeType | undefined | number>,
    default: undefined // 可以传入具体的步长，或者使用预设的时间单位，单位ms
  },
  // 数据，用于渲染时间线上的折线图
  data: {
    type: Array as PropType<TimeLineDataPoint[]>,
    default: () => []
  }
})

// 实际使用的步长值
const realStep = ref(props.step || props.mode)

// 不同时间单位对应的默认精度值（数据点数量）
const modePrecision = {
  [TimeType.DAY]: 300,
  [TimeType.MONTH]: 100,
  [TimeType.YEAR]: 40
}

// 根据step获取精度值
function getPrecision() {
  if (typeof realStep.value === 'number') {
    return realStep.value
  }
  return modePrecision[realStep.value as TimeType] || 100
}

const dataList = computed(() => {
  return formatterTime(props.data, getPrecision())
})

/**
 * @description:
 * @param {*} data
 * @param {number} precision 精度
 * @return {*}
 */
function formatterTime(data: TimeLineDataPoint[], precision: number | undefined = 100): number[] {
  // 计算最大区间和最小区间，分100段，计算每段的数量，作为折线图的数据
  if (data.length === 0) {
    return []
  }
  const timestamps = data.map(item => item.timestamp)
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  const step = (max - min) / precision
  const timeMap: Record<number, number> = {}
  data.forEach(item => {
    const index = Math.floor((item.timestamp - min) / step)
    if (timeMap[index]) {
      timeMap[index] += item.value
    } else {
      timeMap[index] = item.value
    }
  })
  const result: number[] = []
  for (let i = 0; i <= precision; i++) {
    result.push(timeMap[i] || 0)
  }
  return result
}

const timeRanges = computed(() => {
  if (props.data.length <= 1) {
    return {
      min: new Date('2000-01-01').getTime(),
      max: new Date().getTime()
    }
  }
  const timestamps = props.data.map(item => item.timestamp)
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  return { min, max }
})

const minValue = ref(timeRanges.value.min)
const maxValue = ref(timeRanges.value.max)

watch(() => timeRanges.value, (newVal) => {
  minValue.value = newVal.min
  maxValue.value = newVal.max
}, { deep: true })

/**
 * 左右滑块的当前位置（像素值）
 */
const minLeft = ref(0)
const maxLeft = ref(0)

const isExpanded = ref(true)
const animateClass = ref('')

function toggleExpand() {
  if (isExpanded.value) {
    animateClass.value = 'animate__animated animate__fadeOutDown'
    setTimeout(() => {
      isExpanded.value = false
      animateClass.value = ''
    }, 300)
  } else {
    isExpanded.value = true
    animateClass.value = 'animate__animated animate__fadeInUp'
  }
}

// 滑块DOM元素的引用
const minSliderRef = ref<HTMLSpanElement | null>()
const maxSliderRef = ref<HTMLSpanElement | null>()

/**
 * 计算并更新滑块的位置
 * 根据数据范围计算百分比，然后转换为像素位置
 */
function calcSliderPosition() {
  if (!timeLineRef.value) return

  const sliderWidth = timeLineRef.value.clientWidth
  if (sliderWidth <= 0) return

  const range = maxValue.value - minValue.value
  if (range === 0) return

  const minPercent = (dataRange.value.min - minValue.value) / range
  const maxPercent = (dataRange.value.max - minValue.value) / range

  minLeft.value = minPercent * sliderWidth
  maxLeft.value = maxPercent * sliderWidth
  maxSliderRef.value && (maxSliderRef.value.style.left = `${maxLeft.value}px`)
  minSliderRef.value && (minSliderRef.value.style.left = `${minLeft.value}px`)

}

/**
 * 计算步长对应的毫秒数
 * 如果是数字直接使用，如果是预设的时间单位则转换为对应的毫秒数
 */
const stepTime = computed(() => {
  if (typeof props.step === 'number') {
    return props.step
  }
  const step = realStep.value
  switch (step) {
    case TimeType.DAY:
      return 24 * 60 * 60 * 1000
    case TimeType.MONTH:
      return 30 * 24 * 60 * 60 * 1000
    case TimeType.YEAR:
      return 365 * 24 * 60 * 60 * 1000
    default:
      return 24 * 60 * 60 * 1000
  }
})

/**
 * 时间格式化函数映射表
 * 根据不同的时间精度返回对应的格式化函数
 */
const formatter = new Map([
  ['month', (timestamp: number) => {
    const date = new Date(Number(timestamp))
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }],
  ['day', (timestamp: number) => {
    const date = new Date(Number(timestamp))
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }],
  ['year', (timestamp: number) => {
    const date = new Date(Number(timestamp))
    return `${date.getFullYear()}`
  }]
])

/**
 * 获取格式化后的时间字符串
 * @param timestamp - 时间戳
 * @returns 格式化后的时间字符串
 */
function getFormatterStr(timestamp: number) {
  let formatermode = realStep.value
  if (typeof realStep.value === 'number') {
    formatermode = props.mode
  }
  const func = formatter.get(formatermode as string)
  if (func) {
    return func(timestamp)
  }
  return new Date(Number(timestamp)).toLocaleDateString()

}

const emits = defineEmits(['change', "update"])

// 时间线容器的DOM引用
const timeLineRef = ref<HTMLDivElement | null>(null)
interface TimeRange {
  min: number
  max: number
}

// 当前选中的数据范围
const dataRange = ref<{ min: number; max: number }>({
  min: minValue.value,
  max: maxValue.value
})

// 监听mode和step变化，更新滑块配置
watch(() => [props.mode, realStep.value], () => {
  changeTimeLineOption()
})

// 监听TimeRanges变化，更新滑块位置
watch(() => [minValue.value, maxValue.value], () => {
  if (sliderInstance.value) {
    sliderInstance.value.updateOptions({
      range: {
        min: minValue.value,
        max: maxValue.value
      }
    })
    calcSliderPosition()
  }
})

// noUiSlider实例
const sliderInstance = ref<any | null>(null)

/**
 * 初始化时间线滑块
 * 创建noUiSlider实例并绑定事件
 */
function initTimeLine() {
  if (!timeLineRef.value) return

  sliderInstance.value = noUiSlider.create(timeLineRef.value, {
    start: [dataRange.value.min, dataRange.value.max],
    connect: true,
    step: stepTime.value,
    range: {
      min: minValue.value,
      max: maxValue.value
    }
  })

  // 滑块更新时触发（拖动过程中）
  sliderInstance.value.on('update', (values: TimeRange[]) => {
    dataRange.value = {
      min: Number(values[0]),
      max: Number(values[1])
    }

    calcSliderPosition()

    emits("update", dataRange.value)

  })
  // 滑块变化完成后触发（松开鼠标时）
  sliderInstance.value.on("change", (values: TimeRange[]) => {
    emits("change", dataRange.value)
  })
}

/**
 * 更改时间线配置
 * 当步长等配置变化时更新滑块选项
 */
function changeTimeLineOption() {
  if (!timeLineRef.value) return
  const slider = timeLineRef.value?.noUiSlider
  slider.updateOptions({
    step: stepTime.value
  })
}

/**
 * 重置时间范围到初始值
 */
function resetTimeRange(args: { min: number | undefined, max: number | undefined }) {
  args.min && (minValue.value = args.min);
  args.max && (maxValue.value = args.max);
  if (!sliderInstance.value) return
  sliderInstance.value.updateOptions({
    start: [minValue.value, maxValue.value],
    connect: true,
    step: stepTime.value,
    range: {
      min: minValue.value,
      max: maxValue.value
    }
  })
  // 手动触发一下，不然可能会有问题
  emits("update", dataRange.value)
  emits("change", dataRange.value)
}

// 组件挂载后初始化滑块
onMounted(() => {
  initTimeLine()
})

defineExpose({
  resetTimeRange
})
</script>

<style scoped lang="scss">
.time-line-box {
  display: flex;
  height: 40px;
  align-items: center;

  .line-chart {
    position: absolute;
    height: 100%;
    width: 100%;
    pointer-events: none; // 让线图不干扰滑块的交互
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }

  .icon {
    cursor: pointer;
    color: #606266;
    height: 20px;
    width: 20px;
    min-width: 20px;
    background: #ffffff;
    padding: 6px;
    border-radius: 50%;
    margin-right: 20px;
  }

  .icon:hover {
    background-color: #ecf5ff;
    color: #409eff;
  }

  .content-box {
    width: 100%;
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .time-precision {
    width: 150px;
  }

  .reset-btn {
    cursor: pointer;
    color: #717479;
    transition: color 0.3s;
    margin-left: 20px;
    background: rgba(255, 255, 255, 0.74);
    padding: 4px;
    border-radius: 4px;

    &:hover {
      color: #409eff;
    }
  }

  // background: black
}

.time-line {
  width: 100%;
  height: 40px;
  // margin-bottom: 10px;
  // box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.63);

  .slider-text {
    height: 1rem;
    position: absolute;
    white-space: nowrap;
    transform: translateX(-50%) translateY(-200%);
    opacity: 0.4;
    transition: opacity 0.3s;
  }
}

.time-line:hover {
  .slider-text {
    opacity: 1
  }
}
</style>

<style>
.noUi-connect {
  background: rgba(64, 160, 255, 0.3) !important;
}

/* 滑块样式 */
.noUi-horizontal .noUi-handle {
  transform: translateY(40%) scaleY(1.5) scaleX(.3);
}
</style>
