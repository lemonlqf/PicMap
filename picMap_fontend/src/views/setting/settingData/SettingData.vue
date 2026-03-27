<!--
 * @Author: Do not edit
 * @Date: 2025-03-04
 * @Description: 数据备份和导入页面
 * 
 * 功能说明:
 * - 创建备份: 将所有用户数据和配置打包成zip文件
 * - 备份历史: 显示所有已创建的备份文件列表
 * - 恢复数据: 从备份文件恢复数据，支持覆盖/合并两种模式
 * - 删除备份: 删除不需要的备份文件
-->
<template>
  <div class="data-management">
    <div class="section">
      <div class="section-title">{{ $t('backup') }}</div>
      <div class="section-content">
        <el-button type="primary" @click="openBackupDialog" :loading="backupLoading">
          {{ $t('createBackup') }}
        </el-button>
        <div class="tip">{{ $t('backupTip') }}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">{{ $t('backupHistory') }}</div>
      <div class="backup-list">
        <div v-if="backupList.length === 0" class="empty">{{ $t('noBackup') }}</div>
        <div v-for="item in backupList" :key="item.filePath" class="backup-item">
          <div class="backup-info">
            <span class="file-name">{{ item.fileName }}</span>
            <span class="file-size">{{ formatSize(item.size) }}</span>
            <span class="create-time">{{ formatTime(item.createTime) }}</span>
          </div>
          <div class="backup-actions">
            <el-button size="small" @click="handleRestore(item)">{{ $t('restore') }}</el-button>
            <el-button size="small" type="danger" @click="handleDelete(item)">{{ $t('delete') }}</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="backupDialogVisible" :title="$t('createBackup')" width="400px">
      <div class="backup-name-input">
        <el-input
          v-model="backupName"
          :placeholder="$t('backupNamePlaceholder')"
          clearable
          @keyup.enter="handleBackup"
        />
      </div>
      <div v-if="backupLoading" class="backup-loading">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>{{ $t('backupLoading') }}</span>
      </div>
      <template #footer>
        <el-button @click="backupDialogVisible = false" :disabled="backupLoading">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleBackup" :loading="backupLoading">{{ $t('confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="restoreDialogVisible" :title="$t('restoreData')" width="400px">
      <div class="restore-mode">
        <el-radio-group v-model="restoreMode">
          <el-radio value="cover">{{ $t('coverMode') }}</el-radio>
          <el-radio value="merge">{{ $t('mergeMode') }}</el-radio>
        </el-radio-group>
        <div class="mode-tip">
          {{ restoreMode === 'cover' ? $t('coverModeTip') : $t('mergeModeTip') }}
        </div>
      </div>
      <template #footer>
        <el-button @click="restoreDialogVisible = false" :disabled="restoreLoading">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="confirmRestore" :loading="restoreLoading">{{ $t('confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElIcon } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import API from '@/http'
import Backup from '@/http/modules/backup'

const { t } = useI18n()

// 备份列表数据
const backupList = ref<any[]>([])
// 备份按钮loading状态
const backupLoading = ref(false)
// 备份名称弹窗显示状态
const backupDialogVisible = ref(false)
// 恢复数据弹窗显示状态
const restoreDialogVisible = ref(false)
// 恢复按钮loading状态
const restoreLoading = ref(false)
// 恢复模式: 'cover'(覆盖) 或 'merge'(合并)
const restoreMode = ref<'cover' | 'merge'>('cover')
// 当前选中的备份文件
const selectedBackup = ref<any>(null)
// 备份名称
const backupName = ref('')

// 页面加载时获取备份列表
onMounted(() => {
  loadBackupList()
})

/**
 * 获取备份文件列表
 * 调用后端接口获取所有备份文件
 */
async function loadBackupList() {
  try {
    const res = await Backup.getBackupList() as any
    if (res.code === 200) {
      backupList.value = res.data
    }
  } catch (error) {
    console.error('Load backup list error:', error)
  }
}

/**
 * 打开备份名称弹窗
 * 生成默认备份名称
 */
function openBackupDialog() {
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/\//g, '-').replace(/,/g, '')
  backupName.value = `PicMap_Backup_${timestamp}`
  backupDialogVisible.value = true
}

/**
 * 创建备份
 * 调用后端接口创建新的备份文件
 */
async function handleBackup() {
  if (backupName.value.trim()) {
    const nameExists = backupList.value.some(item => {
      const baseName = item.fileName.replace(/\.zip$/, '')
      return baseName === backupName.value.trim()
    })
    if (nameExists) {
      ElMessage.error(t('backupNameExists'))
      return
    }
  }

  backupLoading.value = true
  try {
    const sizeRes = await API.backup.getBackupSize()
    if (sizeRes.code === 200 && sizeRes.data.sizeWarning) {
      ElMessage.warning(t('backupLargeWarning'))
    }

    const res = await API.backup.backup({ name: backupName.value.trim() })
    if (res.code === 200) {
      ElMessage.success(t('backupSuccess'))
      backupDialogVisible.value = false
      backupName.value = ''
      loadBackupList()
    } else {
      ElMessage.error(res.message || t('backupFailed'))
    }
  } catch (error) {
    ElMessage.error(t('backupFailed'))
  } finally {
    backupLoading.value = false
  }
}

/**
 * 打开恢复数据弹窗
 * @param item - 选中的备份文件信息
 */
function handleRestore(item: any) {
  selectedBackup.value = item
  restoreDialogVisible.value = true
}

/**
 * 确认恢复数据
 * 根据选择的模式恢复数据
 */
async function confirmRestore() {
  if (!selectedBackup.value) return

  restoreLoading.value = true
  try {
    const res = await API.backup.import({
      filePath: selectedBackup.value.filePath,
      mode: restoreMode.value
    })
    if (res.code === 200) {
      ElMessage.success(t('restoreSuccess'))
      restoreDialogVisible.value = false
    } else {
      ElMessage.error(res.message || t('restoreFailed'))
    }
  } catch (error) {
    ElMessage.error(t('restoreFailed'))
  } finally {
    restoreLoading.value = false
  }
}

/**
 * 删除备份文件
 * @param item - 要删除的备份文件信息
 */
async function handleDelete(item: any) {
  try {
    await ElMessageBox.confirm(t('confirmDeleteBackup'), t('warning'), {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning'
    })

    const res = await API.backup.deleteBackup({ filePath: item.filePath })
    if (res.code === 200) {
      ElMessage.success(t('deleteSuccess'))
      loadBackupList()
    } else {
      ElMessage.error(res.message || t('deleteFailed'))
    }
  } catch (error) {
    // 用户取消删除操作
  }
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的字符串
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * 格式化时间
 * @param date - 日期字符串
 * @returns 本地化的日期时间字符串
 */
function formatTime(date: string): string {
  return new Date(date).toLocaleString()
}
</script>

<style scoped lang="scss">
.data-management {
  padding-top: 20px;
  padding-right: 40px;
}

.section {
  margin-bottom: 30px;
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .section-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 15px;
    color: #333;
  }

  .section-content {
    .tip {
      margin-top: 10px;
      color: #999;
      font-size: 14px;
    }
  }
}

.backup-list {
  .empty {
    text-align: center;
    color: #999;
    padding: 20px;
  }

  .backup-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #eee;

    &:last-child {
      border-bottom: none;
    }

    .backup-info {
      display: flex;
      gap: 20px;
      align-items: center;

      .file-name {
        font-weight: 500;
      }

      .file-size {
        color: #666;
      }

      .create-time {
        color: #999;
        font-size: 12px;
      }
    }

    .backup-actions {
      display: flex;
      gap: 10px;
    }
  }
}

.backup-name-input {
  margin-bottom: 10px;
}

.restore-mode {
  .mode-tip {
    margin-top: 10px;
    color: #666;
    font-size: 14px;
  }
}

.backup-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #666;

  .loading-icon {
    font-size: 32px;
    color: #409eff;
    margin-bottom: 10px;
    animation: rotate 1s linear infinite;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
}
</style>
