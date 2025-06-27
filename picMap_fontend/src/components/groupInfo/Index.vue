<!--
 * @Author: Do not edit
 * @Date: 2025-02-25 21:35:02
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-27 19:21:10
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\Index.vue
 * @Description: 分组信息组件，位于页面右侧
  -->
-->
<template>
  <div :class="['group-fix-box', { 'group-fix-box-fold-up': !isExpand }]">
    <div class="title-box">
      <div class="title">
        <el-icon :class="['expand-button', { 'fold-up': !isExpand }]">
          <DArrowRight @click="changeIsExpand" />
        </el-icon>
        <h3>{{ '分组信息' }}</h3>
      </div>
      <!-- 添加分组 -->
      <el-button v-show="isExpand" title="添加分组" type="primary" :icon="Plus"
        @click="showCreateDialog"></el-button>
    </div>
    <el-scrollbar max-height="308px">
      <Draggable v-model="groupInfo" class="group-items" @start="dragStart" @end="dragEnd">
        <template #item="{ element }">
          <GroupItem :expand="isExpand" :group-info="element"></GroupItem>
        </template>
      </Draggable>
    </el-scrollbar>
  </div>
  <CreateGroup v-model="showCreateGroupDialog"></CreateGroup>
</template>

<script lang="ts" setup>
import { onBeforeMount, onMounted, ref, watch, nextTick } from 'vue'
import { useSchemaStore } from '../../store/schema';
import { ElMessage } from 'element-plus';
import { DArrowRight } from '@element-plus/icons-vue';
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

const isExpand = ref(true)

function changeIsExpand() {
  isExpand.value = !isExpand.value
}
</script>

<style lang="scss" scoped>
.group-fix-box {
  transition: all 0.3s ease-in-out;
  width: 200px;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  padding: 10px 10px 10px 10px;

  .title-box {
    display: flex;
    align-items: center;

    .title {
      position: relative;
      display: flex;
      align-items: center;

      .expand-button {
        padding: 2px;
        cursor: pointer;
        transition: all 0.3s;
      }

      .expand-button:hover {
        color: rgb(64, 158, 255)
      }

      .fold-up {
        transform: rotate(180deg);
      }

      h3 {
        margin-left: 5px;
      }
    }

    .el-button {
      position: absolute;
      padding: 1px;
      width: 20px;
      height: 20px;
      top: 10px;
      right: 17px;
    }
  }

  .group-items-box {
    max-height: 660px;
    overflow: auto;
  }
}

.group-items {
  display: flex;
  flex-direction: column;
}

.group-fix-box-fold-up {
  width: 100px
}
</style>