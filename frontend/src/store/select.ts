import { ref, computed } from 'vue'

/**
 * 框选选中集 store（全局单例）。
 *
 * 设计核心：选中态以 id 集合的形式存于 store，marker 只是表现层。
 * 无论聚合/离散/时间筛选如何重建 marker，选中集都不会漂移，重建后按 id 自动恢复高亮。
 */
const selectedIds = ref<Set<string>>(new Set())

export function useSelectStore() {
  const selectedIdSet = computed(() => selectedIds.value)

  const isSelected = (id: string) => selectedIds.value.has(id)

  const getSelectedIds = () => Array.from(selectedIds.value)

  const getSelectedCount = () => selectedIds.value.size

  const select = (ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids]
    list.forEach((id) => selectedIds.value.add(id))
    // 触发响应式更新（Set 变化不触发响应式，需替换引用）
    selectedIds.value = new Set(selectedIds.value)
  }

  const unselect = (ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids]
    list.forEach((id) => selectedIds.value.delete(id))
    selectedIds.value = new Set(selectedIds.value)
  }

  const toggle = (id: string) => {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
    selectedIds.value = new Set(selectedIds.value)
  }

  const clear = () => {
    selectedIds.value = new Set()
  }

  const replace = (ids: string[]) => {
    selectedIds.value = new Set(ids)
  }

  // 筛选出选中的图片 id（排除分组 id）
  const getSelectedImageIds = (imageIds: string[]) => {
    return imageIds.filter((id) => selectedIds.value.has(id))
  }

  return {
    selectedIdSet,
    isSelected,
    getSelectedIds,
    getSelectedCount,
    select,
    unselect,
    toggle,
    clear,
    replace,
    getSelectedImageIds,
  }
}
