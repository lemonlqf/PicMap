<!--
 * @Author: Do not edit
 * @Date: 2025-02-25 21:35:02
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-04 12:45:14
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\Index.vue
 * @Description: 分组信息组件，位于页面右侧
  -->
-->
<template>
  <div class="group-fix-box">
    分组信息
    <div class="group-items">
      <template v-for="item in groupInfo">
        <GroupItem :group-info="item"></GroupItem>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, onMounted, ref, watch, nextTick } from 'vue'
import { useSchemaStore } from '../../store/schema';
import { ElMessage } from 'element-plus';
import GroupItem from './component/GroupItem.vue';

const props = defineProps({
  map: Object
})
const schemaStore = useSchemaStore()
const groupInfo = ref([])
watch(() => schemaStore.getGroupInfo, (newVal) => {
  groupInfo.value = newVal
}, { immediate: true, deep: true })

</script>

<style lang="scss" scoped>
.group-fix-box {
  background-color: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    padding: 10px 0 10px 10px;
}

.group-items{
  display: flex;
  flex-direction: column;
}
</style>