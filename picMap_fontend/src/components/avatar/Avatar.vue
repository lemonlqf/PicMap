<template>
  <div :style="{ width: width, height: height }" class="avatar-box">
    <img class="avatar-img" :src="getAvatarUrl(userInfo?.userAvatar)" alt="">
    <div class="upload-button" @click="editAvatar">
      <UploadIcon width="20px"></UploadIcon>
    </div>
  </div>
  <el-dialog class="select-avatar" width="770px" top="200px" :append-to-body="true" v-model="avatarDialog">
    <h3 class="title">{{ $t("defaultAvatar") }}</h3>
    <!-- 默认头像 -->
    <div class="avatar-list">
      <template v-for="(item, name) of DEFAULT_AVATAR" :key="name">
        <div class="img-card" v-if="name !== 'default_0'" @click="selectAvatar(userId, name)">
          <img :src="item" alt="name">
        </div>
      </template>
    </div>
    <!-- 自定义头像 -->
    <div class="avatar-list">

    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getUserInfoById, getAvatarUrl, DEFAULT_AVATAR, changeUsreAvatar } from '@/utils/user'

import UploadIcon from '@/assets/icon/更新.svg?component'

const props = defineProps({
  userId: {
    type: String,
    default: ''
  },
  width: {
    type: String,
    default: '100px'
  },
  height: {
    type: String,
    default: '100px'
  }
})

const avatarDialog = ref()

const userInfo = computed(() => {
  return getUserInfoById(props.userId)
})


function selectAvatar(userId: string, imgId: string) {
  changeUsreAvatar(userId, imgId)
  avatarDialog.value = false
}



function editAvatar() {
  avatarDialog.value = true
}
</script>

<style scoped lang="scss">
.avatar-box {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0fdff;
  border-radius: 50%;

  .avatar-img {
    width: 100%;
  }

  .upload-button {
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    color: #798ef8;
    left: 0;
    right: 0;
    height: 40px;
    transform: translateY(70px);
    background-color: rgba(0, 0, 0, 0.288);
  }
}

.avatar-box:hover {
  .upload-button {
    transform: translateY(30px);

  }

  .upload-button:hover {
    color: #ffffff;
    background-color: rgba(0, 0, 0, 0.623);
  }
}

.select-avatar {

  .avatar-list {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
  }
  .title {
    font-size: 18px;
    margin-bottom: 10px;
    margin-top: 15px;
    font-weight: 600;
  }
}


.img-card {
  flex-shrink: 0;
  width: 70px;
  height: 70px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
  border: 2px solid rgba(0, 81, 255, 0.486);

  img {
    width: 100%;
    height: 100%;
  }
}
.img-card:hover {
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.295);
}
</style>
<style>
.select-avatar {
  border-radius: 30px !important;
  padding: 10px 40px 30px 40px !important;
}
</style>