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
      <div class="section-title">{{ $t('storage.storageDir') }}</div>
      <div class="section-content">
        <div class="storage-row">
          <span class="label">{{ $t('storage.archiveDir') }}:</span>
          <span class="path">{{ storageConfig.archiveDir }}</span>
          <el-button size="small" @click="selectArchiveDir">{{ $t('storage.selectDir') }}</el-button>
        </div>
        <div class="storage-row">
          <span class="label">{{ $t('storage.backupDir') }}:</span>
          <span class="path">{{ storageConfig.backupDir }}</span>
          <el-button size="small" @click="selectBackupDir">{{ $t('storage.selectDir') }}</el-button>
        </div>
        <div class="storage-actions">
          <el-button type="primary" :loading="savingStorage" @click="saveStorageConfig">{{ $t('save') }}</el-button>
          <span class="tip">{{ $t('storage.changeTip') }}</span>
        </div>
      </div>
    </div>

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
      <div class="section-title">
        {{ $t('backupHistory') }}
        <el-button class="restore-file-btn" size="small" @click="restoreFromFile">{{ $t('restoreFromFile') }}</el-button>
      </div>
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

    <el-dialog v-model="backupDialogVisible" :title="$t('createBackup')" width="400px"
      :close-on-click-modal="!backupLoading" :close-on-press-escape="!backupLoading" :show-close="!backupLoading">
      <div class="backup-name-input">
        <el-input
          v-model="backupName"
          :placeholder="$t('backupNamePlaceholder')"
          clearable
          :disabled="backupLoading"
          @keyup.enter="handleBackup"
        />
      </div>
      <div v-if="backupLoading" class="backup-progress">
        <el-progress :percentage="backupPercent" :stroke-width="12" />
        <div class="backup-progress-text">
          {{ formatSize(backupProgress.processed) }} / {{ formatSize(backupProgress.total) }}
        </div>
      </div>
      <template #footer>
        <el-button v-if="backupLoading" type="danger" @click="handleCancelBackup">{{ $t('cancel') }}</el-button>
        <el-button v-else @click="backupDialogVisible = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleBackup" :loading="backupLoading" :disabled="backupLoading">{{ $t('confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="restoreDialogVisible" :title="$t('restoreData')" width="460px">
      <div class="restore-file" v-if="selectedBackupPath">
        <span class="label">{{ $t('backupFile') }}:</span>
        <span class="path">{{ selectedBackupPath }}</span>
      </div>
      <div class="restore-mode">
        <el-radio-group v-model="restoreMode">
          <el-radio value="cover">{{ $t('coverMode') }}</el-radio>
          <el-radio value="merge">{{ $t('mergeMode') }}</el-radio>
        </el-radio-group>
        <div class="mode-tip">
          {{ restoreMode === 'cover' ? $t('coverModeTip') : $t('mergeModeTip') }}
        </div>
        <div class="mode-tip restore-warning">{{ $t('restoreWarning') }}</div>
      </div>
      <template #footer>
        <el-button @click="restoreDialogVisible = false" :disabled="restoreLoading">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="confirmRestore" :loading="restoreLoading">{{ $t('confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox, ElIcon } from 'element-plus'
import LoadingTip from '@/components/loadingTip/Index.vue'
import { useI18n } from 'vue-i18n'
import API from '@/wails/api'

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
// 当前选中的备份文件路径（列表或手动选择）
const selectedBackupPath = ref('')
// 备份名称
const backupName = ref('')
// 备份进度（字节）
const backupProgress = ref<{ processed: number; total: number }>({ processed: 0, total: 0 })
const backupPercent = computed(() => {
  const { processed, total } = backupProgress.value
  if (!total) return 0
  return Math.min(100, Math.round((processed / total) * 100))
})

// 存储目录配置
const storageConfig = ref<{ archiveDir: string; backupDir: string }>({ archiveDir: '', backupDir: '' })
const savingStorage = ref(false)
// 保存前已生效的存储配置（用于检测是否修改了数据目录）
let currentStorageConfig: { archiveDir: string; backupDir: string } = { archiveDir: '', backupDir: '' }

// 页面加载时获取备份列表与存储配置
onMounted(() => {
  loadBackupList()
  loadStorageConfig()
  API.backup.onBackupProgress((data: any) => {
    backupProgress.value = {
      processed: data?.processed ?? 0,
      total: data?.total ?? 0,
    }
  })
  API.backup.onBackupDone((data: any) => {
    backupLoading.value = false
    if (data?.success) {
      ElMessage.success(t('backupSuccess'))
      backupDialogVisible.value = false
      backupName.value = ''
      backupProgress.value = { processed: 0, total: 0 }
      loadBackupList()
    } else if (data?.cancelled) {
      ElMessage.info(t('backupCancelled'))
      backupProgress.value = { processed: 0, total: 0 }
    } else {
      ElMessage.error(data?.message || t('backupFailed'))
      backupProgress.value = { processed: 0, total: 0 }
    }
  })
})

onUnmounted(() => {
  API.backup.offBackupEvents()
})

/**
 * 获取当前存储目录配置
 */
async function loadStorageConfig() {
  try {
    const res = await API.storage.getStorageConfig() as any
    if (res.code === 200) {
      storageConfig.value = res.data
      currentStorageConfig = { ...res.data }
    }
  } catch (error) {
    console.error('Load storage config error:', error)
  }
}

/**
 * 选择数据保存目录
 */
async function selectArchiveDir() {
  try {
    const res = await API.storage.selectDirectory() as any
    if (res.code === 200 && res.data?.path) {
      storageConfig.value.archiveDir = res.data.path
    }
  } catch (error) {
    console.error('Select archive dir error:', error)
  }
}

/**
 * 选择备份目录
 */
async function selectBackupDir() {
  try {
    const res = await API.storage.selectDirectory() as any
    if (res.code === 200 && res.data?.path) {
      storageConfig.value.backupDir = res.data.path
    }
  } catch (error) {
    console.error('Select backup dir error:', error)
  }
}

/**
 * 保存存储目录配置
 * 修改数据目录后需重启生效，数据迁移需用户先备份再恢复
 */
async function saveStorageConfig() {
  const changedArchive = storageConfig.value.archiveDir !== currentStorageConfig.archiveDir
  if (changedArchive) {
    try {
      await ElMessageBox.confirm(
        t('storage.changeConfirm'),
        t('storage.storageDir'),
        {
          confirmButtonText: t('confirm'),
          cancelButtonText: t('cancel'),
          type: 'warning'
        }
      )
    } catch {
      return // 用户取消
    }
  }

  savingStorage.value = true
  try {
    const res = await API.storage.setStorageConfig({
      archiveDir: storageConfig.value.archiveDir,
      backupDir: storageConfig.value.backupDir
    }) as any
    if (res.code === 200) {
      ElMessage.success(t('storage.saveSuccess'))
      storageConfig.value = res.data
      currentStorageConfig = { ...res.data }
    } else {
      ElMessage.error(res.message || t('storage.saveFailed'))
    }
  } catch (error) {
    ElMessage.error(t('storage.saveFailed'))
  } finally {
    savingStorage.value = false
  }
}

/**
 * 获取备份文件列表
 * 调用后端接口获取所有备份文件
 */
async function loadBackupList() {
  try {
    const res = await API.backup.getBackupList() as any
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
  if (backupLoading.value) return
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
  backupProgress.value = { processed: 0, total: 0 }
  try {
    const sizeRes = await API.backup.getBackupSize()
    if (sizeRes.code === 200 && sizeRes.data.sizeWarning) {
      ElMessage.warning(t('backupLargeWarning'))
    }

    // 异步启动备份，进度/结果通过事件推送
    const res = await API.backup.backup({ name: backupName.value.trim() })
    if (res.code !== 200) {
      ElMessage.error(res.message || res.msg || t('backupFailed'))
      backupLoading.value = false
    }
  } catch (error) {
    ElMessage.error(t('backupFailed'))
    backupLoading.value = false
  }
}

/**
 * 取消正在进行的备份
 */
async function handleCancelBackup() {
  try {
    await API.backup.cancelBackup()
  } catch (error) {
    console.error('Cancel backup error:', error)
  }
}

/**
 * 打开恢复数据弹窗（从备份列表选择）
 * @param item - 选中的备份文件信息
 */
function handleRestore(item: any) {
  selectedBackup.value = item
  selectedBackupPath.value = item.filePath
  restoreDialogVisible.value = true
}

/**
 * 从文件系统手动选择备份文件进行恢复
 */
async function restoreFromFile() {
  try {
    const res = await API.storage.selectBackupFile() as any
    if (res.code === 200 && res.data?.filePath) {
      selectedBackup.value = { filePath: res.data.filePath, fileName: res.data.filePath.split(/[\\/]/).pop() }
      selectedBackupPath.value = res.data.filePath
      restoreDialogVisible.value = true
    }
  } catch (error) {
    ElMessage.error(t('restoreFailed'))
  }
}

/**
 * 确认恢复数据
 * 根据选择的模式恢复数据，恢复前提示覆盖风险
 */
async function confirmRestore() {
  if (!selectedBackupPath.value) {
    ElMessage.warning(t('storage.selectBackupFirst'))
    return
  }

  // 覆盖模式恢复前明确警告：会覆盖当前数据，请提前备份
  if (restoreMode.value === 'cover') {
    try {
      await ElMessageBox.confirm(
        t('storage.coverWarning'),
        t('warning'),
        {
          confirmButtonText: t('confirm'),
          cancelButtonText: t('cancel'),
          type: 'warning'
        }
      )
    } catch {
      return // 用户取消
    }
  }

  restoreLoading.value = true
  try {
    const res = await API.backup.import({
      filePath: selectedBackupPath.value,
      mode: restoreMode.value
    })
    if (res.code === 200) {
      ElMessage.success(t('restoreSuccess'))
      restoreDialogVisible.value = false
      loadBackupList()
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
    display: flex;
    align-items: center;
    justify-content: space-between;

    .restore-file-btn {
      margin-left: 12px;
    }
  }

  .section-content {
    .tip {
      margin-top: 10px;
      color: #999;
      font-size: 14px;
    }

    .storage-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;

      .label {
        color: #666;
        flex-shrink: 0;
        width: 80px;
      }

      .path {
        flex: 1;
        color: #333;
        word-break: break-all;
        background: #f5f7fa;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 13px;
      }
    }

    .storage-actions {
      display: flex;
      align-items: center;
      gap: 10px;
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
  margin-top: 10px;
  color: #666;
  font-size: 14px;
}

.backup-progress {
  margin-top: 16px;
}

.backup-progress-text {
  margin-top: 6px;
  text-align: center;
  font-size: 12px;
  color: #909399;
}

.restore-file {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;

  .label {
    color: #666;
    flex-shrink: 0;
  }

  .path {
    flex: 1;
    color: #333;
    word-break: break-all;
    background: #f5f7fa;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
  }
}

.restore-mode {
  .restore-warning {
    margin-top: 10px;
    color: #e6a23c;
    font-size: 13px;
  }
}
</style>
