<!--
 * @Author: Do not edit
 * @Date: 2026-03-11 17:04:59
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-11 21:50:42
 * @FilePath: \PicMap\picMap_fontend\src\components\timeLine\TimeLine.vue
 * @Description: 
-->
<template>
  <div class="time-line-box">
    <!-- 日期 -->
    <TimePrecision class="time-precision" v-model="realStep"></TimePrecision>
    <!-- TODO:重置按钮 -->
    
    <!-- 范围框 -->
    <div class="time-line" ref="timeLineRef">
      <div ref="minSliderRef" class="min-slider slider-text">{{ getFormatterStr(dataRange.min) }}</div>
      <div ref="maxSliderRef" class="max-slider slider-text">{{ getFormatterStr(dataRange.max) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type PropType } from 'vue'
import 'nouislider/dist/nouislider.css';
import noUiSlider from 'nouislider'
import { TimeType } from '@/utils/group';
import TimePrecision from '../drawer/components/TimePrecision.vue';

const minLeft = ref(0)
const maxLeft = ref(0)

const minSliderRef = ref<HTMLSpanElement | null>()
const maxSliderRef = ref<HTMLSpanElement | null>()

// 计算滑块位置
function calcSliderPosition() {
  if (!timeLineRef.value) return

  const sliderWidth = timeLineRef.value.clientWidth
  const minPercent = (dataRange.value.min - props.TimeRanges.min) / (props.TimeRanges.max - props.TimeRanges.min)
  const maxPercent = (dataRange.value.max - props.TimeRanges.min) / (props.TimeRanges.max - props.TimeRanges.min)

  minLeft.value = minPercent * sliderWidth
  maxLeft.value = maxPercent * sliderWidth
  maxSliderRef.value && (maxSliderRef.value.style.left = `${maxLeft.value}px`)
  minSliderRef.value && (minSliderRef.value.style.left = `${minLeft.value}px`)

}

const props = defineProps({
  TimeRanges: {
    type: Object as PropType<{ min: number; max: number }>,
    default: () => ({
      min: new Date('2000-01-01').getTime(),
      max: new Date().getTime()
    })
  },
  mode: {
    type: String as PropType<TimeType>,
    default: TimeType.MONTH // 目前只支持范围选择
  },
  step: {
    type: String as PropType<TimeType | undefined | number>,
    default: undefined // 可以传入具体的步长，或者使用预设的时间单位，单位ms
  }
})

const realStep = ref(props.step || props.mode)

// 计算步长,如果是数字直接使用，如果是预设的时间单位则转换为对应的毫秒数,如果没有传入则根据mode来决定步长
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

// 预设的时间格式化函数
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

const timeLineRef = ref<HTMLDivElement | null>(null)

const dataRange = ref<{ min: number; max: number }>({
  min: props.TimeRanges.min,
  max: props.TimeRanges.max
})

watch(() => [props.mode, realStep.value], () => {
  changeTimeLineOption()
})

const sliderInstance = ref<any | null>(null)

function initTimeLine() {
  if (!timeLineRef.value) return

  sliderInstance.value = noUiSlider.create(timeLineRef.value, {
    start: [dataRange.value.min, dataRange.value.max],
    connect: true,
    step: stepTime.value,
    range: {
      min: props.TimeRanges.min,
      max: props.TimeRanges.max
    }
  })

  sliderInstance.value.on('update', (values) => {
    // console.log('时间范围更新了', values)
    dataRange.value = {
      min: Number(values[0]),
      max: Number(values[1])
    }

    calcSliderPosition()

    emits("update", dataRange.value)

  })
  sliderInstance.value.on("change", (values) => {
    emits("change", dataRange.value)
  })
}

function changeTimeLineOption() {
  if (!timeLineRef.value) return
  const slider = timeLineRef.value.noUiSlider
  slider.updateOptions({
    step: stepTime.value
  })
}

onMounted(() => {
  initTimeLine()
})
</script>

<style scoped lang="scss">
.time-line-box {
  display: flex;
  // justify-content: center;
  align-items: center;

  .time-precision {
    width: 150px;
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
