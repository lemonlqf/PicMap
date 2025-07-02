<!--
 * @Author: Do not edit
 * @Date: 2025-07-01 20:47:54
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-02 22:38:50
 * @FilePath: \Code\picMap_fontend\src\views\setting\Index.vue
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
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import UserSvg from '@/assets/icon/用户.svg?component'
import MapSvg from '@/assets/icon/地图.svg?component'
import ImgSvg from '@/assets/icon/图片.svg?component'
import MapLogo from '@/assets/icon/mapLogo.svg?component'
const router = useRouter()
const menuList = [
  {
    label: '用户',
    router: 'user',
    img: UserSvg
  },
  {
    label: '地图',
    router: 'map',
    img: MapSvg
  },
  {
    label: '图片',
    router: 'img',
    img: ImgSvg
  }
]
const activeRouter = ref(menuList[0].router)


function goRouter(value: string) {
  activeRouter.value = value
  router.push(`/setting/${value}`)
}

function goToPicMap() {
  router.push(`/picMap`)
}


</script>

<style scoped lang="scss">
$backgroud: #1cd786e4;
$activeColor: $backgroud;
$color: #ffffff;
$activeBackgroud: $color;
$noActiveBackground: #02c26f;

.setting-page {
  background-color: #f3f6f8;
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
  padding-left: 260px;
}
</style>