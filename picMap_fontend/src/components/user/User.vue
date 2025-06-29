<template>
  <div class="user">
    <div class="img">
      <img :src="getAvatarUrl(props.avatar)" width="100%" alt="">
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
        <el-button class="button" type="" title="放大地图" @click="" :icon="User" round>
          账号管理
        </el-button>
        <el-button class="button" type="" title="缩小地图" @click="" :icon="Operation" round>
          设置
        </el-button>
      </el-button-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/store/appInfo'
import { useSchemaStore } from '@/store/schema'
import type { IUserInfo } from '@/type/appInfo'
import { User, Operation } from '@element-plus/icons-vue'
import img1 from '@/assets/avatar/三明治.png'
import img2 from '@/assets/avatar/冰淇淋.png'
import img3 from '@/assets/avatar/咖啡.png'
import img4 from '@/assets/avatar/寿司2.png'
import img5 from '@/assets/avatar/汉堡.png'
import img6 from '@/assets/avatar/煎蛋.png'
import img7 from '@/assets/avatar/面包.png'
import img8 from '@/assets/avatar/鸡腿.png'

const props = defineProps({
  avatar: {
    type: String,
    default: 'default_1'
  }
})

const DEFAULT_AVATAR: any = {
  "default_1": img1,
  "default_2": img2,
  "default_3": img3,
  "default_4": img4,
  "default_5": img5,
  "default_6": img6,
  "default_7": img7,
  "default_8": img8,
}

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

function getAvatarUrl(avatar: string) {
  let url = DEFAULT_AVATAR[avatar]
  if (!url) {
    // 请求实际的图片
  }
  return url
}
const currentUserInfo = ref<IUserInfo>({} as IUserInfo)

function initUserInfo() {
  const appStore = useAppStore()
  currentUserInfo.value = appStore.getCurrentUserInfo
}

initUserInfo()

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
</style>