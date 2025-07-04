<template>
  <div class="user">
    <div class="img">
      <img :src="getAvatarUrl(currentUserInfo.avatar)" width="100%" alt="">
    </div>
    <div class="hover-info">
      <div class="user-name">
        <span>{{ currentUserInfo.userName }}</span>
      </div>
      <div class="data">
        <template v-for="item in dataList">
          <div class="data-item">
            <span class="value">{{ item.value() }}</span>
            <span class="key">{{ item.key }}</span>
          </div>
        </template>
      </div>
      <el-button-group class="button-group">
        <el-button class="button" type="" @click="userDialog = true" :icon="User" round>
          切换用户
        </el-button>
        <el-button class="button" type="" @click="toSettingPage" :icon="Operation" round>
          设置
        </el-button>
      </el-button-group>
    </div>
    <el-dialog class="el-dialog-change" width="fit-content" top="300px" :append-to-body="true" v-model="userDialog">
      <div class="user-dialog">
        <template v-for="item in userInfos">
          <div @click="changeUser(item.userId)"
            :class="['users-item', { 'active': item.userId === currentUserInfo.userId }]">
            <div class="user-img">
              <img width="60" :src="getAvatarUrl(item.userAvatar as string)" alt="">
            </div>
            <span>{{ item.userName }}</span>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>

</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '@/store/appInfo'
import { useSchemaStore } from '@/store/schema'
import type { IUserInfo } from '@/type/appInfo'
import { User, Operation } from '@element-plus/icons-vue'
import { getUserInfos } from '@/utils/appInfo'
import { useRouter } from 'vue-router'
import { changeCurrentUser, getAvatarUrl } from '@/utils/user'

// const props = defineProps({
//   avatar: {
//     type: String,
//     default: 'default_1'
//   },
// })
const router = useRouter()
const emits = defineEmits(['changeUser'])
const userDialog = ref(false)

const dataList = ref([
  {
    key: '图片',
    value: () => {
      const schemaStore = useSchemaStore()
      return schemaStore?.getSchema?.imageInfo?.length ?? 0
    }
  },
  {
    key: '分组',
    value: () => {
      const schemaStore = useSchemaStore()
      return schemaStore?.getSchema?.groupInfo?.length ?? 0
    }
  },
])

const currentUserInfo = ref<IUserInfo>({} as IUserInfo)

const userInfos = ref<IUserInfo[]>([] as IUserInfo[])

function changeUser(userId: string) {
  if (userId !== currentUserInfo.value.userId) {
    changeCurrentUser(userId)
    emits('changeUser', userId)
  }
}

const appStore = useAppStore()

watch(() => appStore.getCurrentUserInfo, (newValue) => {
  currentUserInfo.value = newValue
}, { immediate: true })

watch(() => appStore.getUserInfos, (newValue) => {
  userInfos.value = newValue
}, { immediate: true })

function toSettingPage() {
  router.push('/setting')
}

</script>

<style scoped lang="scss">
.user {
  width: 37px;
  height: 37px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  // cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  padding: 2px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, .9);

  >* {
    display: none;
  }

  .img {
    display: block;
    width: 35px;
    height: 35px;
    transition: all 0.2s;
    border: 1px solid rgb(102, 149, 252);
    border-radius: 50%;
    background-color: rgb(240, 253, 255);

    img {
      display: block;
    }

  }

  .hover-info {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;

    .user-name {
      width: fit-content;
      font-size: 19px;
      margin-top: 10px;
      font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;
      font-weight: 600;
      color: rgb(64, 158, 255);

      span {
        display: inline-block;
      }
    }

    .data {
      margin-top: 10px;
      display: flex;
      height: 50px;
      width: 100%;
      justify-content: space-around;

      .data-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;

        .key {
          color: rgb(148, 153, 160);
          font-weight: 400;
          font-size: 12px;
        }

        .value {
          font-size: 18px;
          font-weight: 500;
        }
      }
    }

    .button-group {
      margin-top: 15px;
      display: flex;

      .button {
        min-width: 100px;
      }
    }
  }

}

.user:hover {
  border-radius: 30px;
  width: 230px;
  height: 215px;

  >* {
    display: flex;
  }

  .img {
    margin-top: 10px;
    width: 50px;
    height: 50px;
  }

}

.user-dialog {
  padding: 10px 40px 0px 40px;
  display: flex;

  .users-item {
    position: relative;
    transition: all 0.2s;
    width: fit-content;
    margin: 10px 20px;
    display: flex;
    padding-bottom: 5px;
    flex-direction: column;
    align-items: center;
    opacity: 0.5;
    cursor: pointer;

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
  }

  .users-item.active::before {
    cursor: unset;
    content: '当前用户';
    display: block;
    position: absolute;
    top: -28px;
    font-weight: 500;
    color: rgba(4, 90, 151, 0.815);
  }

  .users-item:hover {
    opacity: 0.7;

    .user-img {
      box-shadow: 0 0 2px rgb(102, 222, 252);
    }
  }

  .active {
    opacity: 1 !important;

    .user-img {
      box-shadow: 0 0 5px rgb(102, 149, 252) !important;
    }
  }

  span {
    margin-top: 10px;
    font-size: 13px;
    max-width: 60px;
  }
}
</style>

<style>
.el-dialog-change {
  border-radius: 30px !important;
  background-color: rgba(255, 255, 255, 0.95) !important;
}
</style>