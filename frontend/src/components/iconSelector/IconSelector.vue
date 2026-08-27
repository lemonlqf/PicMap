<template>
  <el-dialog :model-value="visible" :append-to-body="true" :z-index="3000" width="620px" :title="title"
    @update:model-value="handleDialogVisible" @closed="emit('closed')">
    <div class="icon-selector">
      <div class="icon-grid">
        <div v-for="item in list" :key="item.id"
          :class="['icon-card', { active: item.id === currentId }]" @click="handleSelect(item)">
          <img class="icon-img" :src="item.url" :alt="item.name" />
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getIconListByCategory, resolveIconUrl } from '@/utils/icon'
import type { IIconCategory, IIconItem } from '@/type/appSchema'

const props = defineProps<{
  visible: boolean
  category: IIconCategory
  currentId?: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', item: IIconItem): void
  (e: 'closed'): void
}>()

const { t } = useI18n()
const list = ref<IIconItem[]>([])

function handleDialogVisible(v: boolean | string | number) {
  emit('update:visible', !!v)
}

async function load() {
  list.value = getIconListByCategory(props.category).map((item) => ({ ...item }))
  await refreshCustom()
}

async function refreshCustom() {
  for (const item of list.value) {
    if (item.source === 'custom' && item.id.startsWith('custom_')) {
      const url = await resolveIconUrl(item.id, item.category)
      if (url) item.url = url
    }
  }
}

watch(() => props.visible, (v) => {
  if (v) load()
})

function handleSelect(item: IIconItem) {
  emit('select', item)
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.icon-selector {
  .icon-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .icon-card {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(0, 81, 255, 0.3);
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    overflow: hidden;

    .icon-img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }

    &:hover {
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.3);
    }

    &.active {
      border-color: #542de2;
      box-shadow: 0 0 0 2px rgba(84, 45, 226, 0.3);
    }
  }
}
</style>
