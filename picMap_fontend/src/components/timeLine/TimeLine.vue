<!--
 * @Author: Do not edit
 * @Date: 2026-03-11 17:04:59
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-12 19:26:56
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

const props = defineProps({
  // 时间范围：最小和最大时间戳
  TimeRanges: {
    type: Object as PropType<{ min: number; max: number }>,
    default: () => ({
      min: new Date('2000-01-01').getTime(),
      max: new Date().getTime()
    })
  },
  // 时间精度模式（日、月、年）
  mode: {
    type: String as PropType<TimeType>,
    default: TimeType.MONTH // 目前只支持范围选择
  },
  // 步长，可以是具体数值或时间单位
  step: {
    type: String as PropType<TimeType | undefined | number>,
    default: undefined // 可以传入具体的步长，或者使用预设的时间单位，单位ms
  }
})

const minValue = ref(props.TimeRanges.min)
const maxValue = ref(props.TimeRanges.max)

watch(() => props.TimeRanges, (newVal) => {
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

// 实际使用的步长值
const realStep = ref(props.step || props.mode)

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
  height: 12px;
  // margin-bottom: 10px;
  background-color: rgba(255, 255, 255, 0.504);

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
  background: rgba(64, 160, 255, 0.9) !important;
}

/* 滑块样式 */
.noUi-horizontal .noUi-handle {
  transform: scale(0.8) translateY(-10%);
}
</style>
