<template>
  <div class="info-section">
    <h4 class="section-title">{{ title }}</h4>
    <div class="info-grid">
      <div v-for="(item, index) in items" :key="item.label" class="info-item">
        <span class="label">{{ item.label }}</span>
        <span :class="['value', { highlight: highlightIndex === index }]">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface InfoItem {
  label: string
  value: string
}

defineProps<{
  title: string
  items: InfoItem[]
  highlightIndex?: number
}>()
</script>

<style scoped>
.info-section {
  flex: 1;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 10px 12px;
  min-width: 0;
  overflow: hidden;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.info-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.label {
  font-size: 11px;
  color: #888;
  flex-shrink: 0;
}

.value {
  font-size: 12px;
  color: #333;
  font-weight: 500;
  text-align: right;
  flex-shrink: 0;
}

.value.highlight {
  color: #4caf50;
}
</style>
