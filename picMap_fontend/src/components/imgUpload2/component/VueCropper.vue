<template>
  <el-dialog title="请选择合适的图片区域" v-model="compVisible" append-to-body :show-close="false" :close-on-click-modal="false"
    :close-on-press-escape="false" v-bind="$attrs">
    <div class="cropper-content">
      <div v-if="!isReset" class="cropper" style="text-align: center">
        <VueCropper ref="cropperRef" v-bind="option" />
      </div>

      <div class="cropper-actions">
        <!-- <el-button
          plain
          @click="clickReset"
        >
          <span style="font-size:12px;">重新选择</span>
        </el-button> -->
        <el-button-group>
          <el-button :icon="RefreshLeft" plain title="向左旋转90°" @click="cropperRef && cropperRef.rotateLeft()" />
          <el-button :icon="RefreshRight" plain title="向右旋转90°" @click="cropperRef && cropperRef.rotateRight()" />
          <el-button :icon="ZoomIn" plain title="放大" @click="cropperRef && cropperRef.changeScale(1)" />
          <el-button :icon="ZoomOut" plain title="缩小" @click="cropperRef && cropperRef.changeScale(-1)" />
        </el-button-group>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="cancel"> 取消 </el-button>
        <el-button type="primary" :loading="loading" @click="finish"> 确定 </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, watch } from 'vue';
import VueCropper from 'vue-cropper/src/vue-cropper.vue';
import 'vue-cropper/next/dist/index.css';
import { RefreshLeft, RefreshRight, ZoomIn, ZoomOut } from '@element-plus/icons-vue';

defineOptions({
  name: 'ImgCropper',
});

const props = defineProps({
  fileUrl: {
    type: String,
    default: '',
  },
  options: {
    type: Object as () => any,
    default: () => ({}),
  },
});
const compVisible = defineModel<boolean>('visible', {
  type: Boolean,
  default: false,
})
const cropperRef = ref();
const emit = defineEmits(['ok', 'cancel']);
let option = reactive({
  img: '', // 裁剪图片的地址
  info: true, // 裁剪框的大小信息
  outputSize: 1, // 裁剪生成图片的质量
  outputType: 'png', // 裁剪生成图片的格式
  canScale: true, // 图片是否允许滚轮缩放
  autoCrop: true, // 是否默认生成截图框
  autoCropWidth: 200, // 默认生成截图框宽度
  autoCropHeight: 200, // 默认生成截图框高度
  fixedBox: false, // 固定截图框大小 不允许改变
  fixed: true, // 是否开启截图框宽高固定比例
  fixedNumber: [1, 1], // 截图框的宽高比例
  full: true, // 是否输出原图比例的截图
  canMoveBox: true, // 截图框能否拖动
  original: false, // 上传图片按照原始比例渲染
  high: true,
  centerBox: true, // 截图框是否被限制在图片里面
  infoTrue: true, // true 为展示真实输出图片宽高 false 展示看到的截图框宽高
  mode: 'contain'
});
const loading = ref(false);
const isReset = ref(false);

watch(
  () => compVisible.value,
  newVal => {
    onVisibleChange(newVal);
  },
  { immediate: true }
);

function onVisibleChange(val: boolean) {
  mergeOptions();
  if (val) {
    option.img = props.fileUrl;
  }
}

/**
 * @description: 合并配置项
 * @return {*}
 */
function mergeOptions() {
  option = {
    ...option,
    ...props.options,
  };
}

// 确认裁剪
function finish() {
  (cropperRef.value as any).getCropData((data: string) => {
    loading.value = true;
    // 将剪裁后base64的图片转化为file格式
    const file = convertBase64UrlToBlob(data);
    emit('ok', { data, file });
    loading.value = false;
    compVisible.value = false;
  });
}

// 取消裁剪
function cancel() {
  compVisible.value = false;
  emit('cancel');
}

// 将base64的图片转换为file文件
function convertBase64UrlToBlob(urlData: string) {
  // 去掉url的头，并转换为byte
  const bytes = window.atob(urlData.split(',')[1]);
  // 处理异常,将ascii码小于0的转换为大于0
  const ab = new ArrayBuffer(bytes.length);
  const ia = new Uint8Array(ab);
  for (var i = 0; i < bytes.length; i++) {
    ia[i] = bytes.charCodeAt(i);
  }
  return new Blob([ab], { type: 'image/png' });
}
</script>

<style scoped lang="scss">
.cropper-content {
  .cropper {
    width: auto;
    height: 500px;
  }

  .cropper-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding-top: 10px;
  }
}
</style>