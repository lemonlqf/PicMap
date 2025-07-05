<!--
 * @Author: Do not edit
 * @Date: 2025-07-01 21:16:03
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-05 22:16:43
 * @FilePath: \Code\picMap_fontend\src\views\setting\components\SettingUser.vue
 * @Description: 
-->
<template>
  <div class="">
    <h2 class="user-nums">用户数量：{{ userInfos.length }}</h2>
    <!-- 用户选择 -->
    <el-scrollbar class="el-scroll-bar">
      <div class="user-list">
        <template v-for="userInfo in userInfos">
          <UserCard @card-click="(value) => changeCurrentUser(value)"
            :active="currentUserInfo.userId === userInfo.userId" :user-id="userInfo.userId"></UserCard>
        </template>
        <UserCard :is-add-card="true" @card-click="showAddCreateUserDialog = true"></UserCard>
      </div>
    </el-scrollbar>
    <!-- 具体信息 -->
    <div class="user-detail">
      <div class="top">
        <div class="top-left">
          <Avatar :user-id="currentUserInfo.userId"></Avatar>
          <div class="user-info">
            <span class="user-name">{{ currentUserInfo?.userName || '未设置' }}</span>
            <span class="create-time">{{ `创建时间：${formatDate(currentUserInfo?.createTime, 'YYYY-MM-DD HH:mm:ss') ||
              '2000-01-01 00:00:00'}`
              }}</span>
          </div>
        </div>
      </div>
      <div class="info">
        <div class="info-edit"></div>
        <div class="info-footer">
          <el-popconfirm @confirm="deleteUser(currentUserInfo)" width="259" title="确定要删除用户吗？该用户的所有的图片也会被删除，不可恢复！"
            placement="top">
            <template #reference>
              <el-button type="danger" :icon="Delete">删除</el-button>
            </template>
            <template #actions="{ confirm, cancel }">
              <el-button @click="cancel">取消</el-button>
              <el-button type="danger" @click="confirm">
                确定
              </el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>
  </div>
  <CreateUser v-model="showAddCreateUserDialog"></CreateUser>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import UserCard from '@/components/userCard/UserCard.vue';
import { useAppStore } from '@/store/appSchema';
import type { IUserInfo } from '@/type/appSchema';
import { computed } from 'vue';
import { changeCurrentUser, deleteUser } from '@/utils/user'
import Avatar from '@/components/avatar/Avatar.vue';
import CreateUser from '@/components/createUser/CreateUser.vue';
import { formatDate } from '@/utils/date'
import { Delete } from '@element-plus/icons-vue'

const appStore = useAppStore()

const userInfos = computed<IUserInfo[]>(() => {
  return appStore.getUserInfos
})

const showAddCreateUserDialog = ref(false)

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
.user-nums {
  height: 15px;
  line-height: 20px;
  font-size: 22px;
  color: #542de2;
}

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

.user-detail {
  height: calc(100vh - 300px);
  width: 96%;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.63);

  .top {
    display: flex;
    align-items: center;
    padding: 0 40px;
    height: 170px;
    background: linear-gradient(-45deg, #542de2 30%, #0061e0) !important;

    .top-left {
      display: flex;

      .user-info {
        // width: 150px;
        margin-left: 20px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;

        .user-name {
          color: rgb(255, 255, 255);
          font-size: 25px;
          margin-bottom: 10px;
        }

        .create-time {
          color: rgba(202, 202, 202, 0.733);
          font-size: 20px;
        }
      }
    }
  }

  .info {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;

    .info-footer {
      padding: 30px;
    }
  }
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

  .delete-confirm {
    padding: 10px !important;
  }
}
</style>