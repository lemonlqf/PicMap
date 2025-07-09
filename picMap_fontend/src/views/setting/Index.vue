<!--
 * @Author: Do not edit
 * @Date: 2025-07-01 20:47:54
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-09 21:32:42
 * @FilePath: \PicMap\Code\picMap_fontend\src\views\setting\Index.vue
 * @Description: 
-->
<template>
  <div class="setting-page">
    <!-- 单选菜单 -->
    <div class="menu">
      <div class="logo-box">
        <MapLogo class="logo" width="100px" height="100px" @click="goToPicMap" />
        <span class="logo-text">返回相册地图</span>
      </div>
      <template v-for="item in menuList">
        <div>
          <div :class="['option-item', { 'active': activeRouter === item.router }]" @click="goRouter(item.router)">
            <component :is="item.img" width="30px" height="30px" />
            <span>{{ item.label }}</span>
          </div>
        </div>
      </template>
    </div>
    <div class="content">
      <div class="header">
        <span class="title">{{ title }}</span>
        <div class="user-item">
          <span class="user-name">{{ currentUserInfo.userName }}</span>
          <div class="user-img">
            <img width="35" :src="getAvatarUrl(currentUserInfo.userAvatar as string)" alt="">
          </div>
        </div>
      </div>
      <router-view class="view" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/store/appSchema'
import { useSchemaStore } from '@/store/schema'
import UserSvg from '@/assets/icon/用户.svg?component'
import MapSvg from '@/assets/icon/地图.svg?component'
import ImgSvg from '@/assets/icon/图片.svg?component'
import MapLogo from '@/assets/icon/mapLogo.svg?component'
import type { IUserInfo } from '@/type/appSchema'
import { changeCurrentUser, getAvatarUrl } from '@/utils/user'
import { getUserSchema } from '@/utils/appSchema'
const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const schemaStore = useSchemaStore()
const menuList = [
  {
    title: '用户管理',
    label: '用户',
    router: 'user',
    img: UserSvg
  },
  {
    title: '地图管理',
    label: '地图',
    router: 'map',
    img: MapSvg
  },
  // {
  //   title: '图片信息管理',
  //   label: '图片',
  //   router: 'img',
  //   img: ImgSvg
  // }
]
const activeRouter = ref(menuList[0].router)

const title = computed(() => {
  return menuList.find(item => {
    return item.router === activeRouter.value
  })?.title
})

const currentUserInfo = computed({
  get: () => {
    return appStore.getCurrentUserInfo
  },
  set: (value: IUserInfo) => {
    changeCurrentUser(value.userId)
  }
})

const currentSchema = computed(() => {
  return schemaStore.getSchema
})

// 更新schema
watch(() => currentUserInfo.value.userId, async (newValue) => {
  const schema = await getUserSchema()
  schemaStore.setSchema(schema)
}, {deep: true})

function goRouter(value: string) {
  activeRouter.value = value
  router.push(`/setting/${value}`)
}

function goToPicMap() {
  router.push(`/picMap`)
}

function initActiveRouter() {
  activeRouter.value = route.path.split('/')[2]
}
initActiveRouter()

</script>

<style scoped lang="scss">
$backgroud: #3061d4;
$activeColor: $backgroud;
$color: #ffffff;
$activeBackgroud: $color;
$noActiveBackground: #325bca;

.setting-page {
  background-color: rgb(246, 248, 251);
 overflow: auto;
}


.menu {
  * {
    transition: all 0.2s;
  }

  position: absolute;
  top: 12vh;
  left: 30px;
  width: 120px;
  height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-radius: 30px;
  box-shadow: rgba(0, 0, 0, 0.214) 0px 4px 8px 0px,
  rgba(0, 0, 0, 0.043) 0px 2px 4px 0px;
  background: $backgroud;
  padding: 36px 24px 24px;


  .logo-box {
    margin-bottom: 70px;
    display: flex;
    flex-direction: column;
    align-items: center;

    .logo {
      cursor: pointer;
    }

    .logo:hover {
      transform: scale(1.1);
    }

    .logo-text {
      font-size: 14px;
      color: $color;
    }
  }

  .option-item {
    cursor: pointer;
    color: $color;
    background-color: $noActiveBackground;
    // background-color: rgb(255, 255, 255);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-around;
    padding: 10px 30px;
    height: 60px;
    border-radius: 20px;
    margin-bottom: 20px;

    span {
      margin-top: 5px;
    }
  }

  .active {
    color: $activeColor;
    background-color: $activeBackgroud;
    box-shadow: 0 0 10px #66666683;
  }
}

.content {
  height: 100vh;
  box-sizing: border-box;
  padding-left: 260px;
  padding-top: 30px;
  display: flex;
  flex-direction: column;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    margin-right: 40px;
    border-bottom: 1.5px solid rgb(127, 174, 228);

    .title {
      color: #3061d4;
      line-height: 50px;
      font-size: 30px;
      font-weight: 600;
    }

    .user-item {
      position: relative;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      // width: fit-content;
      margin: 10px 20px;

      .user-name {}

      .user-img {
        margin-left: 10px;
        position: relative;
        display: block;
        width: 35px;
        height: 35px;
        transition: all 0.2s;
        border: 1px solid rgb(102, 149, 252);
        border-radius: 50%;
        background-color: rgb(240, 253, 255);
      }
    }
  }

}
</style>