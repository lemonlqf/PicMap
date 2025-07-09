<template>
  <div class="background-image-setting">
    <el-upload ref="upload" :class="['image-uploader', { 'is-disabled': disabled, 'is-upload': avatarUrlArr.length }]"
      :action="fileAction" :file-list="fileList" :auto-upload="false" :show-file-list="false" :limit="fileLimit + 1"
      :accept="formatAccept(fileAccept)" :disabled="disabled" :on-change="handleAvatarChangeUpload"
      :on-remove="handleAvatarRemove">
      <ul v-if="avatarUrlArr.length" class="el-upload-list el-upload-list--picture-card">
        <li v-for="(url, idx) in avatarUrlArr" :key="idx" :tabindex="idx" class="el-upload-list__item is-ready">
          <img :src="url" alt="" class="el-upload-list__item-thumbnail">
          <span class="el-upload-list__item-actions" @click.stop="clickEditAvatar(idx)">
            <el-icon class="el-icon-close el-upload-list__item-delete" title="删除" @click.stop="clickDelAvatar(idx);">
              <Close />
            </el-icon>
          </span>
        </li>
      </ul>
      <svg-icon v-else name="style-template-add" class="avatar-uploader-icon" />
      <template #tip>
        <div class="el-upload__tip">
          <!-- {{ `支持上传 png、jpg、jpeg 格式图片，大小不超过 10 M` }} -->
        </div>
      </template>
    </el-upload>
    <img-cropper v-model:visible="cropper.visible" :file-url="cropper.fileUrl" :options="cropper.options"
      @ok="handleConfirmCropper" @cancel="handleCancel" @closed="handleClosedCropper" @click.stop />
  </div>
</template>

<script setup lang="ts">
import { ElMessage, type UploadFile } from 'element-plus'
import ImgCropper from './component/VueCropper.vue'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { IImageDetailInfo, IUploadImageInfo } from '@/type/image'
import { uploadImages as UploadImages, calcMBSize, addImageUrl, getImageUrl } from '@/utils/Image'
import API from '@/http/index'

defineOptions({
  name: 'BackgroundImageSetting'
})
defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})
function formatAccept(fileAccept: string) {
  return fileAccept.split(',').map((item) => {
    return `.${item}`
  }).join(',')
}
const emit = defineEmits(['change'])
const value = defineModel<string, string>()
const fileList = ref<UploadFile[]>([])
const fileAction = ref('') // 上传服务地址
const fileAccept = ref('jpg,jpeg,png,bmp') // 允许的文件格式
const fileLimit = ref(1) // 最大上传个数
const fileSizeLimit = ref(100) // 单个文件不超过 10 MB
const avatarUrlArr = ref<any[]>([])
const cacheAvatarUrl = ref('')
const cacheFile = ref<UploadFile | null>(null)
const upload = ref()
interface ICropperProp {
  visible: boolean
  options: {
    fixed: boolean
    [prop: string]: any
  }
  fileIndex: number
  file: UploadFile | null
  fileUrl: string
}
// 裁剪图片相关
const cropper = reactive<ICropperProp>({
  visible: false,
  options: {
    // 不固定宽高
    fixed: false
  },
  fileIndex: 0,
  file: null,
  fileUrl: ''
})

watch(() => value.value, (newVal: string | undefined) => {
  // console.log('newVal')
  if (newVal && newVal !== 'unset') {
    newVal = transformBgImage2Url(newVal)
    avatarUrlArr.value = [newVal]
  } else {
    clearAvatarUploadRelatedData()
  }
}, {
  immediate: true
})

onBeforeUnmount(() => {
  clearAvatarUploadRelatedData()
})

// 上传前判断文件类型
function handleAvatarChangeUpload(file: UploadFile, uploadFileList: UploadFile[]) {
  const arr = file.name.split('.')
  const fileType = `${(arr.pop() ?? '').toLowerCase()}` // 文件后缀
  const fileSize = (file.size ?? 0) / (1024 * 1024) // fileSize 单位 MB
  let message = ''
  // 验证文件类型
  if (!fileAccept.value.split(',').includes(fileType)) {
    message = `文件类型需要为${fileAccept.value}`
    fileList.value = uploadFileList.filter((item) => item.name !== file.name)
  }
  // 验证文件大小
  if (fileSize > fileSizeLimit.value) {
    message = `请上传小于${fileSizeLimit.value}MB的文件`
    fileList.value = uploadFileList.filter((item) => item.name !== file.name)
  }
  // 是否有错误信息
  if (message) {
    ElMessage.error(message)
    return false
  }
  // 说明上传超过限制了，需要删除第一个文件
  if (fileLimit.value <= avatarUrlArr.value.length) {
    // 缓存上次的file和fileUrl
    cacheAvatarUrl.value = avatarUrlArr.value[0]
    cacheFile.value = fileList.value[0]
    clearDelAvatar(0, false)
  } else {
    cacheAvatarUrl.value = ''
    cacheFile.value = null
  }
  fileList.value.push(file)
  const fileUrl = URL.createObjectURL(file.raw as Blob)
  avatarUrlArr.value.push(fileUrl)

  // svg不用裁剪，直接显示
  // if (fileType === 'svg') {
  // handleSvgUpload(file)
  // } else {
  // 其他图片格式，打开裁剪弹窗
  cropper.file = file
  cropper.fileIndex = fileList.value.length - 1
  cropper.fileUrl = fileUrl
  cropper.visible = true
  // }
}

function handleAvatarRemove(_: UploadFile, uploadFileList: UploadFile[]) {
  fileList.value = uploadFileList
}

function clickEditAvatar(_: number) {
  upload.value.$el.querySelector('.el-upload__input[name=file]').click()
}

function clickDelAvatar(index: number) {
  clearDelAvatar(index)
  value.value = ''
  emit('change', '')
}

function clearDelAvatar(index: number, isRevoke = true) {
  fileList.value.splice(index, 1)
  isRevoke && URL.revokeObjectURL(avatarUrlArr.value[index])
  avatarUrlArr.value.splice(index, 1)
}

async function handleConfirmCropper({ file, data }: { file: UploadFile, data: string }) {
  clearDelAvatar(cropper.fileIndex)
  const name = cropper.file?.name ?? ''
  // console.log(file, data)
  // TODO:data传过来的是base64，上传到后端处理的逻辑在这里实现
  // 包装成imageInfo的格式{id, name, url}
  fileList.value.push(file)
  avatarUrlArr.value.push(data)
  const imageInfo: IUploadImageInfo = {
    url: data,
    name,
    id: name,
  }
  // 上传图片
  // 请求后端接口上传图片，保存本地文件目录下
  const res = await API.image.uploadImages({ images: [imageInfo] })
  // 保存返回的接口结果
  if (res.code !== 200) {
    ElMessage.warning(`${imageInfo.name} 上传失败！`)
    return
  }

  data = transformUrl2BgImage(data)
  value.value = data
  emit('change', data)
}
function handleCancel() {
  clearDelAvatar(cropper.fileIndex, false)
  if (cacheAvatarUrl.value) {
    avatarUrlArr.value.push(cacheAvatarUrl.value)
    fileList.value.push(cacheFile.value as UploadFile)
  }
}
function handleClosedCropper() {
  cropper.file = null
  cropper.fileIndex = 0
  cropper.fileUrl = ''
}
function clearAvatarUploadRelatedData() {
  fileList.value = []
  avatarUrlArr.value.forEach((url) => URL.revokeObjectURL(url))
  avatarUrlArr.value = []
}
function transformBgImage2Url(backgroundImage: string) {
  return backgroundImage.replace(/url\((.+)\)/, '$1')
}
function transformUrl2BgImage(url: string) {
  return `url(${url})`
}
</script>

<style scoped lang="scss">
$blue: #1c79f4;
$borderColor: #c5cdd6;
$fontColor: #474d5f;
$tipsColor: #7F7F7F;
$red: #ff5555;

.background-image-setting {
  .image-uploader {
    width: 100%;
    aspect-ratio: 1 / 1;
    position: relative;
  }

  :deep(.el-upload) {
    border: 1px dashed $borderColor;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .avatar-uploader-icon {
      font-size: 20px;
      color: $fontColor;
    }

    &:hover {
      border-color: $blue;

      .avatar-uploader-icon {
        color: $blue;
      }
    }

    .el-upload-list {
      width: 100%;
      height: 100%;

      &__item {
        width: 100%;
        height: 100%;
        margin: 0;
        border: none;
        border-radius: 0;
        position: relative;

        &-thumbnail {
          object-fit: scale-down;
          background-position: center center;
        }

        &-delete {
          display: inline-block;
          width: 18px;
          height: 18px;
          background-color: $red;
          position: absolute;
          right: -4px;
          top: -4px;
          font-size: 16px;
          line-height: 18px;
          color: #fff;
          transform: scale(.6);
        }
      }

      &__item-actions {
        display: inline-block;
        width: 100%;
        height: 100%;
        background-color: transparent;
        cursor: pointer;
      }
    }
  }

  :deep(.el-upload__tip) {
    position: absolute;
    bottom: -4px;
    left: 2px;
    margin-top: 0;
    width: 280px;
    font-size: 12px;
    line-height: 1.5;
    color: $tipsColor;
    transform: scale(.75);
  }

  .is-disabled {
    :deep(.el-upload) {
      cursor: not-allowed;

      &:hover {
        border-color: $borderColor;

        .avatar-uploader-icon {
          color: $fontColor;
        }
      }

      .el-upload-list {
        &__item {
          &-delete {
            display: none;
          }
        }
      }
    }
  }

  .is-upload {
    :deep(.el-upload) {
      &:hover {
        border-color: $borderColor;

        .avatar-uploader-icon {
          color: $fontColor;
        }
      }
    }
  }
}
</style>