<!--
 * @Author: Do not edit
 * @Date: 2025-05-02 09:27:09
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-27 18:39:05
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\component\GroupItem.vue
 * @Description: 
-->
<template>
  <div ref="itemRef" :class="['flex-box', { 'flex-box-fold-up': !expand }]" @click="setViewById(groupInfo.id)">
    <div>
      <img v-show="expand" src="@/assets/icon/三横线.png" width="15px" height="10px" alt="">
      <el-tooltip :content="groupInfo.name" placement="top">
        <span :class="['group-name', { 'group-name-fold-up': !expand }]">{{ GPSInfoLegality(groupInfo?.GPSInfo) ?
          groupInfo.name : expand ? `(未定位)${groupInfo.name}` : groupInfo.name
          }}
        </span>
      </el-tooltip>
    </div>
    <el-popover width="fit-content">
      <GroupContentMenu :group-id="groupInfo.id">
      </GroupContentMenu>
      <template #reference>
        <div v-show="expand" class="right-box">
          <span v-if="!showEdit" class="number">{{ groupNumbersNumber }}</span>
          <img v-else class="edit-image" src="@/assets/icon/三点.png" width="15px" height="15pxx" alt="">
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import type { IGroupInfo } from '@/type/schema';
import type { PropType } from 'vue';
import { onMounted, ref } from 'vue'
import { computed } from 'vue';
import { GPSInfoLegality, setViewById } from '@/utils/map';
import GroupContentMenu from '@/components/contentMenu/component/GroupContentMenu.vue'

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

  &:hover {
    background-color: rgba(236, 237, 238, 1);

    // .right-box {
    //   .number {
    //     display: none;
    //   }

    //   .edit-image {
    //     display: inline-block;
    //   }
  }

  img {
    opacity: 0.8;
    margin-right: 8px;
  }

  .number {
    font-size: 14px;
    color: rgb(148, 153, 160);
    margin-right: 2px;
  }
}

.group-name {
  font-size: 14px;
  display: inline-block;
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.edit-image {
  // display: none;
  transform: translateX(9px);
}
</style>