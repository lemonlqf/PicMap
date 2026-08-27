<template>
  <div class="setting-icon">
    <div class="icon-section">
      <h3 class="section-title">{{ $t('icon.avatarIcons') }}</h3>
      <div class="icon-grid">
        <div v-for="item in avatarIcons" :key="item.id" class="icon-card">
          <img class="icon-img" :src="item.url" :alt="item.name" />
          <span class="icon-name">{{ item.name }}</span>
          <el-button v-if="item.source === 'custom'" class="icon-del" type="danger" size="small"
            @click="removeIcon(item)">{{ $t('delete') }}</el-button>
        </div>
        <div class="icon-card upload-card" @click="openUpload('avatar')">
          <el-icon :size="24"><Plus /></el-icon>
          <span>{{ $t('icon.uploadIcon') }}</span>
        </div>
      </div>
    </div>

    <div class="icon-section">
      <h3 class="section-title">{{ $t('icon.trackIcons') }}</h3>
      <div class="icon-grid">
        <div v-for="item in trackIcons" :key="item.id" class="icon-card">
          <img class="icon-img" :src="item.url" :alt="item.name" />
          <span class="icon-name">{{ item.name }}</span>
          <el-button v-if="item.source === 'custom'" class="icon-del" type="danger" size="small"
            @click="removeIcon(item)">{{ $t('delete') }}</el-button>
        </div>
        <div class="icon-card upload-card" @click="openUpload('track')">
          <el-icon :size="24"><Plus /></el-icon>
          <span>{{ $t('icon.uploadIcon') }}</span>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".png,.jpg,.jpeg,.svg,.webp,.bmp,.gif" hidden
      @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  getIconListByCategory,
  uploadIconToLibrary,
  deleteIconFromLibrary,
  resolveIconUrl,
} from '@/utils/icon'
import type { IIconCategory, IIconItem } from '@/type/appSchema'

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)
const uploadCategory = ref<IIconCategory>('avatar')

const avatarIcons = ref<IIconItem[]>([])
const trackIcons = ref<IIconItem[]>([])

async function loadIcons() {
  avatarIcons.value = getIconListByCategory('avatar').map((item) => ({ ...item }))
  trackIcons.value = getIconListByCategory('track').map((item) => ({ ...item }))
  // 预设图标 url 已是 URL，自定义需要异步解析，逐个刷新
  await refreshCustomUrls()
}

async function refreshCustomUrls() {
  const refreshList = async (list: IIconItem[]) => {
    for (const item of list) {
      if (item.source === 'custom' && item.id.startsWith('custom_')) {
        const url = await resolveIconUrl(item.id, item.category)
        if (url) item.url = url
      }
    }
  }
  await Promise.all([refreshList(avatarIcons.value), refreshList(trackIcons.value)])
}

function openUpload(category: IIconCategory) {
  uploadCategory.value = category
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await uploadIconToLibrary(file, uploadCategory.value)
    ElMessage.success(t('icon.uploadSuccess'))
    await loadIcons()
  } catch (err: any) {
    ElMessage.error(err?.message || t('icon.uploadFailed'))
  }
}

async function removeIcon(item: IIconItem) {
  try {
    await deleteIconFromLibrary(item.id)
    ElMessage.success(t('description.deleteSuccess'))
    await loadIcons()
  } catch (err) {
    ElMessage.error(t('description.deleteFailed'))
  }
}

loadIcons()
</script>

<style scoped lang="scss">
.setting-icon {
  padding: 10px;
  overflow: auto;

  .icon-section {
    margin-bottom: 30px;

    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #542de2;
      margin-bottom: 15px;
    }

    .icon-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }

    .icon-card {
      width: 90px;
      height: 110px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 2px solid rgba(0, 81, 255, 0.3);
      border-radius: 10px;
      background: #fff;
      position: relative;
      padding: 8px;

      .icon-img {
        width: 48px;
        height: 48px;
        object-fit: contain;
      }

      .icon-name {
        font-size: 12px;
        color: #666;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .icon-del {
        position: absolute;
        top: -8px;
        right: -8px;
      }
    }

    .icon-card.upload-card {
      border-style: dashed;
      cursor: pointer;
      color: #909399;
      flex-direction: column;

      &:hover {
        color: #542de2;
        border-color: #542de2;
      }
    }
  }
}
</style>
