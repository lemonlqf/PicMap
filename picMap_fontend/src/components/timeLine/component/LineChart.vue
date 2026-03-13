<!--
 * @Author: Do not edit
 * @Date: 2026-03-13 20:55:45
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-13 22:52:16
 * @FilePath: \PicMap\picMap_fontend\src\components\timeLine\component\LineChart.vue
 * @Description: 根据数据和线条类型渲染折线图，使用原生svg实现，支持光滑曲线、折线图、条形图等
-->
<template>
  <div ref="lineChartRef" class="line-chart-container">
    <svg v-if="data.length > 0 && svgWidth > 1 && svgHeight > 1" :width="svgWidth" :height="svgHeight"
      :viewBox="`0 0 ${svgWidth} ${svgHeight}`">
      <!-- 数据点 -->
      <g v-if="showPoints" class="data-points">
        <circle v-for="(value, index) in data" :key="`point-${index}`" :cx="getX(index)" :cy="getY(value)"
          :r="pointRadius" class="data-point" />
      </g>

      <!-- 折线路径 -->
      <path :d="pathD" fill="none" :stroke="lineColor" :stroke-width="lineWidth"
        :stroke-linecap="lineType === LineType.STEP ? 'square' : 'round'"
        :stroke-linejoin="lineType === LineType.STEP ? 'miter' : 'round'" class="line-path" />

      <!-- 区域填充（可选） -->
      <path v-if="showArea" :d="areaD" :fill="areaColor" :opacity="areaOpacity" class="area-path" />
    </svg>

    <!-- 无数据提示 -->
    <div v-else class="no-data">
      暂无数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, type PropType } from 'vue';
import { LineType } from '@/type/map';

const props = defineProps({
  /**
   * 传入的数据，渲染为折线图
   * @type {number[]}
   */
  data: {
    type: Array as PropType<number[]>,
    default: () => []
  },
  /**
   * 线条类型：smooth-光滑曲线，line-折线图，step-阶梯图
   * @type {LineType}
   * @default LineType.SMOOTH
   */
  lineType: {
    type: String as PropType<LineType>,
    default: LineType.SMOOTH
  },
  /**
   * 线条颜色
   * @type {string}
   * @default '#3498db'
   */
  lineColor: {
    type: String,
    default: '#3498db'
  },
  /**
   * 线条宽度
   * @type {number}
   * @default 2
   */
  lineWidth: {
    type: Number,
    default: 1
  },
  /**
   * 数据点半径
   * @type {number}
   * @default 4
   */
  pointRadius: {
    type: Number,
    default: 4
  },
  showPoints: {
    type: Boolean,
    default: false
  },
  /**
   * 是否显示区域填充
   * @type {boolean}
   * @default false
   */
  showArea: {
    type: Boolean,
    default: false
  },
  /**
   * 区域填充颜色
   * @type {string}
   * @default '#3498db'
   */
  areaColor: {
    type: String,
    default: '#3498db'
  },
  /**
   * 区域填充透明度
   * @type {number}
   * @default 0.2
   */
  areaOpacity: {
    type: Number,
    default: 0.2
  },
  /**
   * X轴内边距
   * @type {number}
   * @default 0
   */
  paddingX: {
    type: Number,
    default: 0
  },
  /**
   * Y轴内边距
   * @type {number}
   * @default 0
   */
  paddingY: {
    type: Number,
    default: 0
  }
})

// 组件refs
const lineChartRef = ref<HTMLDivElement | null>(null)

// 容器尺寸（基于父元素）
const containerWidth = ref(0)
const containerHeight = ref(0)

/**
 * SVG尺寸（减去内边距，确保不为负数）
 */
const svgWidth = computed(() => Math.max(containerWidth.value - props.paddingX * 2, 1))
const svgHeight = computed(() => Math.max(containerHeight.value - props.paddingY * 2, 1))

/**
 * 计算数据范围
 */
const dataRange = computed(() => {
  if (props.data.length === 0) {
    return { min: 0, max: 100 }
  }
  const min = Math.min(...props.data)
  const max = Math.max(...props.data)
  // 如果最大值等于最小值，扩展范围
  if (min === max) {
    return { min: min - 10, max: max + 10 }
  }
  // 增加一些缓冲空间
  const padding = (max - min) * 0.1
  return {
    min: Math.floor(min - padding),
    max: Math.ceil(max + padding)
  }
})

/**
 * 将数据索引转换为X坐标
 * @param index 数据索引
 * @returns X坐标
 */
const getX = (index: number): number => {
  if (props.data.length <= 1) {
    return svgWidth.value / 2
  }
  return props.paddingX + (index / (props.data.length - 1)) * svgWidth.value
}

/**
 * 将数据值转换为Y坐标
 * 注意：SVG坐标系Y轴向下，所以需要反转
 * @param value 数据值
 * @returns Y坐标
 */
const getY = (value: number): number => {
  const { min, max } = dataRange.value
  const range = max - min
  if (range === 0) {
    return svgHeight.value / 2 + props.paddingY
  }
  // Y轴反转，较大值在较上方
  const ratio = (value - min) / range
  return props.paddingY + svgHeight.value * (1 - ratio)
}

/**
 * 生成普通折线路径
 * @returns SVG路径字符串
 */
const generateLinePath = (): string => {
  if (props.data.length === 0) return ''

  const points = props.data.map((value, index) => {
    return `${getX(index)},${getY(value)}`
  })

  return `M ${points.join(' L ')}`
}

/**
 * 生成光滑曲线（贝塞尔曲线）路径
 * @returns SVG路径字符串
 */
const generateSmoothPath = (): string => {
  if (props.data.length < 2) return ''

  let path = `M ${getX(0)},${getY(props.data[0])}`

  for (let i = 0; i < props.data.length - 1; i++) {
    const currentX = getX(i)
    const currentY = getY(props.data[i])
    const nextX = getX(i + 1)
    const nextY = getY(props.data[i + 1])

    // 计算控制点
    const controlX1 = currentX + (nextX - currentX) / 3
    const controlY1 = currentY
    const controlX2 = currentX + (nextX - currentX) * 2 / 3
    const controlY2 = nextY

    path += ` C ${controlX1},${controlY1} ${controlX2},${controlY2} ${nextX},${nextY}`
  }

  return path
}

/**
 * 生成阶梯图路径
 * @returns SVG路径字符串
 */
const generateStepPath = (): string => {
  if (props.data.length === 0) return ''

  let path = `M ${getX(0)},${getY(props.data[0])}`

  for (let i = 0; i < props.data.length - 1; i++) {
    const currentX = getX(i)
    const currentY = getY(props.data[i])
    const nextX = getX(i + 1)
    const nextY = getY(props.data[i + 1])

    // 阶梯图：先水平移动，再垂直移动
    path += ` L ${nextX},${currentY} L ${nextX},${nextY}`
  }

  return path
}

/**
 * 根据lineType生成对应的路径
 * @returns 完整的SVG路径字符串
 */
const pathD = computed(() => {
  if (props.data.length === 0) return ''

  switch (props.lineType) {
    case LineType.SMOOTH:
      return generateSmoothPath()
    case LineType.STEP:
      return generateStepPath()
    case LineType.LINE:
    default:
      return generateLinePath()
  }
})

/**
 * 生成区域填充路径
 * 区域从折线延伸到X轴
 * @returns SVG路径字符串
 */
const areaD = computed(() => {
  if (props.data.length === 0 || !props.showArea) return ''

  const baselineY = props.paddingY + svgHeight.value
  let path = pathD.value

  // 闭合路径：回到起点，降到X轴，回到起始X坐标
  if (props.data.length > 0) {
    path += ` L ${getX(props.data.length - 1)},${baselineY} L ${getX(0)},${baselineY} Z`
  }

  return path
})

/**
 * 响应容器大小变化
 */
const resizeObserver = ref<ResizeObserver | null>(null)

/**
 * 更新容器尺寸
 */
const updateContainerSize = () => {
  if (lineChartRef.value) {
    const width = lineChartRef.value.clientWidth
    const height = lineChartRef.value.clientHeight
    // 使用固定默认值或实际尺寸
    containerWidth.value = width || 300
    containerHeight.value = height || 150
  }
}

/**
 * 初始化ResizeObserver监听容器大小变化
 */
onMounted(() => {
  nextTick(() => {
    // 延迟获取尺寸，确保DOM已渲染
    requestAnimationFrame(() => {
      updateContainerSize()

      resizeObserver.value = new ResizeObserver(() => {
        updateContainerSize()
      })

      if (lineChartRef.value) {
        resizeObserver.value.observe(lineChartRef.value)
      }
    })
  })
})

/**
 * 监听props变化，重新渲染
 */
watch(() => [props.data, props.lineType, props.lineColor, props.lineWidth], () => {
  nextTick(() => {
    updateContainerSize()
  })
}, { deep: true })

</script>

<style scoped lang="scss">
.line-chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    overflow: visible;

    .data-point {
      fill: #fff;
      stroke: #3498db;
      stroke-width: 2;
      transition: all 0.3s ease;
      cursor: pointer;

      &:hover {
        r: 6;
        fill: #3498db;
        stroke: #2980b9;
      }
    }

  }

  .no-data {
    color: #999;
    font-size: 14px;
    text-align: center;
  }
}
</style>
