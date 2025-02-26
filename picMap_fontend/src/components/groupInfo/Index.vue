<!--
 * @Author: Do not edit
 * @Date: 2025-02-25 21:35:02
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-25 21:41:01
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\Index.vue
 * @Description: 分组信息组件，位于页面右侧
  -->
-->
<template>
  <div>
    分组信息
    <div>
      <template v-for="item in groupInfo">
        <span>{{ item.name }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onBeforeMount, onMounted, ref, watch, nextTick } from 'vue'
import { useSchemaStore } from '../../store/schema';
import { ElMessage } from 'element-plus';

const props = defineProps({
  map: Object
})
const schemaStore = useSchemaStore()
const groupInfo = ref([])
watch(() => schemaStore.getGroupInfo, (newVal) => {
  groupInfo.value = newVal
}, { immediate: true, deep: true })

</script>

<style lang="scss" scoped></style>