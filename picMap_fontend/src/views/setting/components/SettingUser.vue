<!--
 * @Author: Do not edit
 * @Date: 2025-07-01 21:16:03
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-04 22:45:26
 * @FilePath: \Code\picMap_fontend\src\views\setting\components\SettingUser.vue
 * @Description: 
-->
<template>
  <div class="">
    <!-- 用户选择 -->
    <el-scrollbar class="el-scroll-bar">
      <div class="user-list">
        <template v-for="userInfo in userInfos">
          <UserCard @card-click="(value) => changeCurrentUser(value)"
            :active="currentUserInfo.userId === userInfo.userId" :user-id="userInfo.userId"></UserCard>
        </template>
        <UserCard :is-add-card="true"></UserCard>
      </div>
    </el-scrollbar>
    <!-- 具体信息 -->
    <div class="user-detail"></div>
    <div></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import UserCard from '@/components/userCard/UserCard.vue';
import { useAppStore } from '@/store/appInfo';
import type { IUserInfo } from '@/type/appInfo';
import { computed } from 'vue';
import { changeCurrentUser } from '@/utils/user'
const appStore = useAppStore()

const userInfos = computed<IUserInfo[]>(() => {
  return appStore.getUserInfos
})

const currentUserInfo = computed({
  get: () => {
    return appStore.getCurrentUserInfo
  },
  set: (value: IUserInfo) => {
    changeCurrentUser(value.userId)
  }
})

function changeUser() {
  console.log(111)
}

onMounted(() => {

})

</script>

<style scoped lang="scss">
.user-list {
  width: fit-content;
  display: flex;
  position: relative;
  align-items: flex-end;
  gap: 10px;
}

.el-scroll-bar {
  position: relative;
  width: 96%;
  margin-top: 20px;
}

// .el-scroll-bar::after {
//   content: '';
//   display: inline-block;
//   position: absolute;
//   overflow: hidden;
//   right: 0;
//   top: 0;
//   bottom: 0;
//   width: 130px;
//   background: #bdc3c7;
//   /* fallback for old browsers */
//   background: -webkit-linear-gradient(to left,#f6f8fb 20%, #ffffff 80%, #bdc3c700);
//   /* Chrome 10-25, Safari 5.1-6 */
//   background: linear-gradient(to left,#f6f8fb 20%, #2c3e50 80%, #bdc3c700);
//   /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
// }

// .el-scroll-bar::before {
//   content: '';
//   display: inline-block;
//   position: absolute;
//   overflow: hidden;
//   border-radius: 5px;
//   left: 0;
//   top: 0;
//   bottom: 0;
//   width: 50px;
//   background: #bdc3c7;
//   /* fallback for old browsers */
//   background: -webkit-linear-gradient(to right, #2c3e50, #bdc3c700);
//   /* Chrome 10-25, Safari 5.1-6 */
//   background: linear-gradient(to right, #2c3e50, #bdc3c700);
//   /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
//   z-index: 999;
// }

:deep() {
  .el-scrollbar {
    height: 120px;

    .el-scrollbar__wrap {
      padding-top: 5px;
    }
  }
}
</style>