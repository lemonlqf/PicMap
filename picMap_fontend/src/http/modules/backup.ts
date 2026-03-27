/*
 * @Author: Do not edit
 * @Date: 2025-03-04
 * @Description: 备份和导入 API 模块
 * 
 * 接口说明:
 * - backup: 创建数据备份
 * - getBackupList: 获取备份文件列表
 * - import: 导入备份数据
 * - deleteBackup: 删除备份文件
 */
import http from '../axios'

export default {
  /**
   * 创建备份
   * 调用后端接口将所有数据打包成zip文件，返回文件信息
   */
  backup: (data: { name?: string }) => {
    return http({
      url: 'backup/backup',
      method: 'post',
      data,
      timeout: 0
    })
  },

  /**
   * 检查备份数据大小
   * 返回数据大小信息，超过阈值时返回警告提示
   */
  getBackupSize: () => {
    return http({
      url: 'backup/backupSize',
      method: 'get'
    })
  },

  /**
   * 获取备份文件列表
   * 返回所有已创建的备份文件信息
   */
  getBackupList: () => {
    return http({
      url: 'backup/backupList',
      method: 'get'
    })
  },
  
  /**
   * 导入备份数据
   * @param filePath - 备份文件路径
   * @param mode - 导入模式: 'cover'(覆盖) 或 'merge'(合并)
   */
  import: (data: { filePath: string, mode: 'cover' | 'merge' }) => {
    return http({
      url: 'backup/import',
      method: 'post',
      data,
      timeout: 0
    })
  },
  
  /**
   * 删除备份文件
   * @param filePath - 要删除的备份文件路径
   */
  deleteBackup: (data: { filePath: string }) => {
    return http({
      url: 'backup/deleteBackup',
      method: 'post',
      data
    })
  }
}
