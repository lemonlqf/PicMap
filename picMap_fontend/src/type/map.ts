/**
* 线条类型枚举
*/
export enum LineType {
  SMOOTH = 'smooth',  // 光滑曲线（贝塞尔曲线）
  LINE = 'line',      // 普通折线
  STEP = 'step'       // 阶梯图（条形图样式）
}

export interface TimeLineDataPoint {
  timestamp: number; // 时间戳，单位为毫秒
  value: number;     // 对应时间点的数值
}