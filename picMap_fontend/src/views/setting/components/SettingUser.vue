<!--
 * @Author: Do not edit
 * @Date: 2025-07-01 21:16:03
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-06 15:06:09
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
        <UserCard :is-add-card="true" @card-click="showAddDialog"></UserCard>
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
        <div class="info-content">
          <div class="info-card">
            <div class="info-title">
              <UserInfoIcon style="width: 25px; height: 25px"></UserInfoIcon>
              <div class="title">用户信息</div>
            </div>
            <!-- id -->
            <div class="info-item">
              <span class="label">ID</span>
              <div class="value-box">
                <span class="value">{{ currentUserInfo.userId }}</span>
              </div>
            </div>
            <!-- 姓名 -->
            <div class="info-item">
              <span class="label">姓名</span>
              <div class="value-box">
                <span v-if="!isEdit" class="value">{{ userName }}</span>
                <el-input size="" v-else :maxlength="20" show-word-limit v-model="userInputName"
                  @change="changeName"></el-input>
              </div>
            </div>
          </div>
          <div class="info-card">
            <div class="info-title">
              <ImgInfoIcon style="width: 25px; height: 25px"></ImgInfoIcon>
              <div class="title">图片信息</div>
            </div>
            <!-- id -->
            <div class="info-item">
              <span class="label">图片数量</span>
              <div class="value-box">
                <CountUp class="value" :duration="0.4" :end-val="imgNums" :start-val="imgStartValue"
                  @finished="setImgStartValue">
                </CountUp>
              </div>
            </div>
            <!-- 姓名 -->
            <div class="info-item">
              <span class="label">分组数量</span>
              <div class="value-box">
                <CountUp class="value" :duration="0.4" :end-val="groupNums" :start-val="groupStartValue"
                  @finished="setGroupStartValue">
                </CountUp>
              </div>
            </div>
          </div>
        </div>
        <div class="info-footer">
          <template v-if="!isEdit">
            <el-button type="primary" @click="isEdit = true" :icon="Edit">信息编辑</el-button>
            <el-popconfirm @confirm="confirm(currentUserInfo)" width="259" title="确定要删除用户吗？该用户的所有的图片也会被删除，不可恢复！" placement="top">
              <template #reference>
                <el-button type="danger" :icon="Delete">删除用户</el-button>
              </template>
              <template #actions="{ confirm, cancel }">
                <el-button @click="cancel">取消</el-button>
                <el-button type="danger" @click="confirm">
                  确定
                </el-button>
              </template>
            </el-popconfirm>
          </template>
          <template v-else>
            <el-button @click="isEdit = false" :icon="Back">退出编辑</el-button>
          </template>
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
import { changeCurrentUser, deleteUser, isUserNameExist } from '@/utils/user'
import Avatar from '@/components/avatar/Avatar.vue';
import CreateUser from '@/components/createUser/CreateUser.vue';
import { formatDate } from '@/utils/date'
import { Delete, Edit, Back } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import { editUserInfoAndSave } from '@/utils/appSchema';
import UserInfoIcon from '@/assets/icon/用户信息.svg?component'
import ImgInfoIcon from '@/assets/icon/图片信息.svg?component'
import { useSchemaStore } from '@/store/schema';
import CountUp from 'vue-countup-v3'

const appStore = useAppStore()
const schemaStore = useSchemaStore()
const imgNums = computed(() => {
  return schemaStore?.getSchema?.imageInfo?.length ?? 0
})

const groupNums = computed(() => {
  return schemaStore?.getSchema?.groupInfo?.length ?? 0
})

const userInfos = computed<IUserInfo[]>(() => {
  return appStore.getUserInfos
})

const showAddCreateUserDialog = ref(false)

const isEdit = ref(false)

const userInputName = ref('')
const userName = computed(() => {
  userInputName.value = appStore.getCurrentUserInfo.userName
  return appStore.getCurrentUserInfo.userName
})



const currentUserInfo = computed({
  get: () => {
    return appStore.getCurrentUserInfo
  },
  set: (value: IUserInfo) => {
    changeCurrentUser(value.userId)
  }
})

function changeName(value: string) {
  if (value.length < 1) {
    ElMessage.warning('姓名不能为空')
    userInputName.value = userName.value
  } else {
    if (isUserNameExist(value)) {
      ElMessage.warning('姓名已存在')
      userInputName.value = userName.value
    } else {
      editUserInfoAndSave(currentUserInfo.value.userId, 'userName', value)
    }
  }
}

function confirm(currentUserInfo: IUserInfo) {
  deleteUser(currentUserInfo)
  showAddCreateUserDialog.value = false
}

function changeUser() {
  console.log(111)
}

const imgStartValue = ref(0)

function setImgStartValue() {
  imgStartValue.value = imgNums.value
}

const groupStartValue = ref(0)

function setGroupStartValue() {
  groupStartValue.value = groupNums.value
}

function showAddDialog() {
  if (isEdit.value) {
    ElMessage.warning('请先退出编辑再新建用户！')
    return
  }
  showAddCreateUserDialog.value = true
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
    padding: 30px;

    .info-content {
      display: flex;
      gap: 40px;
      .info-card {
        width: 300px;
        padding: 20px;
        .info-title {
          display: flex;
          align-items: center;
          font-size: 22px;
          font-weight: 500;
          color: #542de29d;

          .title {
            margin-left: 10px;
          }
        }


        .info-item {
          max-width: 50%;
          min-width: 300px;
          width: fit-content;
          margin-top: 25px;

          .label {
            font-size: 16px;
            color: gray;
          }

          .value-box {
            height: 20px;
            padding-top: 5px;

            .value {
              font-weight: 500;
              font-size: 20px;
              color: rgb(56, 56, 56);
            }
          }

        }
      }
    }

    .info-footer {
      padding-top: 25px;
      border-top: 1px #542de265 solid;
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