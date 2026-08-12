<!--
 * @Author: Do not edit
 * @Date: 2025-05-02 09:27:09
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-09-13 18:29:19
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\component\GroupItem.vue
 * @Description: 
-->
<template>
  <div ref="itemRef" :class="['flex-box', { 'flex-box-fold-up': !expand }]" @click="markerService.setViewByMarkerId(groupInfo.id)">
    <div class="left-area">
      <img v-show="expand" src="@/assets/icon/三横线.png" width="15px" height="10px" alt="">
      <el-icon v-show="expand" class="visibility-icon" @click.stop="handleVisibleChange" :size="16">
        <View v-if="groupInfo.visible !== false" />
        <Hide v-else />
      </el-icon>
      <el-tooltip :content="groupInfo.name" placement="top">
        <span :class="['group-name', { 'group-name-fold-up': !expand }]">
          {{ GPSInfoLegality(groupInfo?.GPSInfo) ?
            groupInfo.name : expand ? `(${$t('unlocated')})${groupInfo.name}` : groupInfo.name
          }}
        </span>
      </el-tooltip>
    </div>
    <div class="right-area">
      <el-popover popper-style="padding: 0px" width="fit-content">
        <GroupContentMenu :group-id="groupInfo.id">
        </GroupContentMenu>
        <template #reference>
          <div class="right-box" :style="{ opacity: expand && showEdit ? 1 : 0 }">
            <img class="edit-image" src="@/assets/icon/三点.png" width="15px" height="15pxx" alt="">
          </div>
        </template>
      </el-popover>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { IGroupInfo } from '@/type/schema';
import type { PropType } from 'vue';
import { onMounted, ref } from 'vue';
import { computed } from 'vue';
import { GPSInfoLegality } from '@/utils/map';
import GroupContentMenu from '@/components/contentMenu/component/GroupContentMenu.vue'
import markerService from '@/services/marker'
import { useSchemaStore } from '@/store/schema';
import { saveSchema } from '@/utils/schema';
import { View, Hide } from '@element-plus/icons-vue';
const props = defineProps({
  groupInfo: {
    type: Object as PropType<IGroupInfo>,
    default: () => { }
  },
  expand: {
    type: Boolean,
    default: true
  }
})

const groupNumbersNumber = computed(() => {
  return props.groupInfo?.groupNumbers?.length ?? 0
})

const showEdit = ref(false)
const itemRef = ref()
const schemaStore = useSchemaStore()

function handleVisibleChange() {
  const visible = props.groupInfo.visible !== false
  const groupList = schemaStore.getGroupInfo
  const group = groupList.find(g => g.id === props.groupInfo.id)
  if (group) {
    group.visible = !visible
    schemaStore.setGroupInfo(groupList)
    saveSchema()
    
    if (!visible) {
      markerService.showMarkerById(props.groupInfo.id)
    } else {
      markerService.hiddenMarkerById(props.groupInfo.id)
    }
  }
}

onMounted(() => {
  itemRef.value.addEventListener('mouseover', () => {
    showEdit.value = true
  })
  itemRef.value.addEventListener('mouseleave', () => {
    showEdit.value = false
  })
})


</script>

<style lang="scss" scoped>
.flex-box {
  width: 180px;
  padding: 5px 10px 5px 5px;
  border-radius: 5px;
  display: flex;
  cursor: pointer;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(236, 237, 238, 1);
  }

  img {
    opacity: 0.8;
    cursor: move;
  }

  .number {
    font-size: 14px;
    color: rgb(148, 153, 160);
    margin-right: 2px;
  }
}

.left-area {
  display: flex;
  align-items: center;
  gap: 6px;
}

.visibility-icon {
  cursor: pointer;
  color: #909399;
  transition: color 0.2s;
  
  &:hover {
    color: #409eff;
  }
}

.right-area {
  display: flex;
  align-items: center;
}

.right-box {
  display: flex;
  align-items: center;
  width: 20px;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.group-name {
  font-size: 14px;
  display: inline-block;
  max-width: 70px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.group-name-fold-up {
  max-width: 60px;
}

.edit-image {
  transform: translateX(9px);
}
</style>