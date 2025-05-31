<!--
 * @Author: Do not edit
 * @Date: 2025-02-25 21:35:02
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-06 20:58:02
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\Index.vue
 * @Description: 分组信息组件，位于页面右侧
  -->
-->
<template>
  <div class="group-fix-box">
    <div class="title-box">
      <h3>分组信息</h3>
      <!-- 添加分组 -->
      <el-button type="primary" style="width: 18px; height: 18px" :icon="Plus"
        @click="showCreateDialog"></el-button>
    </div>
    <Draggable v-model="groupInfo" class="group-items" @start="dragStart" @end="dragEnd">
      <template #item="{element}">
        <GroupItem :group-info="element"></GroupItem>
      </template>
    </Draggable>
  </div>
  <CreateGroup v-model="showCreateGroupDialog"></CreateGroup>
</template>

<script lang="ts" setup>
import { onBeforeMount, onMounted, ref, watch, nextTick } from 'vue'
import { useSchemaStore } from '../../store/schema';
import { ElMessage } from 'element-plus';
import GroupItem from './component/GroupItem.vue';
import Draggable from 'vuedraggable';
import { saveSchema } from '@/utils/schema';
import { Plus } from '@element-plus/icons-vue'
import type { IGroupInfo } from '@/type/schema';
import CreateGroup from './createGroup/CreateGroup.vue';

const props = defineProps({
  map: Object
})
const showCreateGroupDialog = ref(false)
const schemaStore = useSchemaStore()
const groupInfo = ref<IGroupInfo[]>([])
watch(() => schemaStore.getGroupInfo, (newVal) => {
  groupInfo.value = newVal
}, { immediate: true, deep: true })

function dragStart(...args) {
  // const getGroupInfo = useSchemaStore().getGroupInfo
  // console.log('start---args:', args, getGroupInfo)
}

function dragEnd(...args) {
  const groupInfo = useSchemaStore().getGroupInfo
  const { oldIndex, newIndex } = args[0]
  // 改变位置
  if (oldIndex !== newIndex) {
    [groupInfo[oldIndex], groupInfo[newIndex]] = [groupInfo[newIndex], groupInfo[oldIndex]]
    console.log('end---args:', oldIndex, newIndex, groupInfo)
    saveSchema()
  }
}

/**
 * @description: 打开创建分组的弹框
 * @return {*}
 */
function showCreateDialog() {
  showCreateGroupDialog.value = true
}
</script>

<style lang="scss" scoped>
.group-fix-box {
  width: 210px;
  background-color: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    padding: 10px 10px 10px 10px;
    .title-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h3 {
        margin-bottom: 5px;
      }
      .el-button {
        padding: 8px 8px;
      }
    }
}

.group-items{
  display: flex;
  flex-direction: column;
}
</style>