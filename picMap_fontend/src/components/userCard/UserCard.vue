<!--
 * @Author: Do not edit
 * @Date: 2025-07-04 19:36:39
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-06 11:23:39
 * @FilePath: \Code\picMap_fontend\src\components\userCard\UserCard.vue
 * @Description: 
-->
<template>
  <div @click="emits('cardClick', userId)" v-if="!isAddCard"
    :class="['card', 'div-gradient-border', { 'active': active }]">
    <div class="content">
      <div class="user-img">
        <img width="60" :src="getAvatarUrl(userInfo?.userAvatar as string)" alt="">
      </div>
      <div class="user-info">
        <el-tooltip class="box-item" :content="userInfo?.userName || '未设置'" placement="top-start">
          <span class="user-name">{{ userInfo?.userName || '未设置' }}</span>
        </el-tooltip>
        <span class="create-time">{{ `${formatDate(userInfo?.createTime, 'YYYY-MM-DD') || '2000-01-01'}` }}</span>
      </div>
    </div>
  </div>
  <!-- 添加 -->
  <div @click="emits('cardClick')" v-if="isAddCard" class="add-card card" title="添加用户">
    <AddUserIcon class="img" width="40px" height="40px"></AddUserIcon>
    <!-- <span>添加用户</span> -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/appSchema';
import { getAvatarUrl } from '@/utils/user'
import { formatDate } from '@/utils/date'
import AddUserIcon from '@/assets/icon/添加用户.svg?component'
const props = defineProps({
  userId: {
    default: '',
    type: String
  },
  active: {
    defalut: false,
    type: Boolean
  },
  isAddCard: {
    default: false,
    type: Boolean
  }
})
const appStore = useAppStore()
const emits = defineEmits(['cardClick'])

const userInfo = computed(() => {
  return appStore.getUserInfos.find(item => {
    return item.userId === props.userId
  })
})
</script>

<style scoped lang="scss">
$border-radius: 10px;
$border-width: 3px;

.card {
  cursor: pointer;
  flex-shrink: 0;
  width: 240px;
  height: calc(89px + $border-width);
  transition: all 0.3s;
  position: relative;
  border-radius: $border-radius;
  box-shadow: 0 0 4px gray;
}

.div-gradient-border {
  padding: calc($border-width);
  padding-top: calc($border-width + 7px);
  background: linear-gradient(-45deg, #a497d4 30%, #96b3da);
  /* 可选 */
  /* 边框渐变色 */
}

.card:hover {
  transform: translateY(-3px);
  background: linear-gradient(-45deg, #9684d4 30%, #79a2d6);
  box-shadow: 0 0 5px rgb(83, 83, 83);
}

.active {
  background: linear-gradient(-45deg, #542de2 30%, #0061e0) !important;
}

.card>.content {
  background: #fff;
  /* 内部内容背景色 */
  border-radius: calc($border-radius - 2px);
  /* 内部圆角要略小于外部 */
  padding: 15px;
  // margin: -8px;
  /* 负值等于边框宽度 */
}

.content {
  color: black;
  display: flex;
  align-items: flex-end;

  .user-img {
    position: relative;
    display: block;
    width: 60px;
    height: 60px;
    transition: all 0.2s;
    border: 1px solid rgb(102, 149, 252);
    border-radius: 50%;
    background-color: rgb(240, 253, 255);
  }

  .user-info {
    // width: 150px;
    margin-left: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .user-name {
      max-width: 130px;
      width: fit-content;
      color: rgb(73, 73, 73);
      font-size: 18px;
      margin-bottom: 10px;
      word-wrap: none;
      word-break: keep-all;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .create-time {
      color: rgba(73, 73, 73, 0.733);
      font-size: 14px;
    }
  }
}

.add-card {
  z-index: 999;
  position: sticky;
  right: 0;
  cursor: pointer;
  height: calc(97px + $border-width);
  width: 100px;
  color: #ffffff;
  background: linear-gradient(to right, #5780fa, #5870fa);
  border: $border-width #7da4d8 solid;
  // background: unset !important;
  display: flex;
  align-items: center;

  // justify-content: center;
  .img {
    margin-left: 30px;
  }

  span {
    margin-left: 15px;
  }
}

.add-card:hover {
  background: linear-gradient(to right, #396afc, #2948ff)
}
</style>