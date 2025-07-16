<!--
 * @Author: Do not edit
 * @Date: 2025-07-05 16:08:04
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-16 21:58:47
 * @FilePath: \Code\picMap_fontend\src\components\createUser\CreateUser.vue
 * @Description: 
-->
<template>
  <el-dialog :z-index="9999" v-model="show" title="创建新用户" style="width: 440px;">
    <el-form ref="userFormRef" :model="newUserInfo" style="width: 400px" label-width="auto" :rules="userEditRules">
      <el-form-item :label="$t('userName')" label-width="90px" prop="userName">
        <el-input v-model="newUserInfo.userName"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <!-- <el-button @click="addManualLocateGroupToMap" class="locate-button" type="primary">手动定位</el-button> -->
        <el-button @click="closeDialog" :disabled="loading">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="createNewUser" :loading="loading">
          {{ $t('confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, type Ref } from 'vue'
import type { IUserInfo } from '@/type/appSchema'
import { changeCurrentUser, createUser, createUserId, isUserNameExist } from '@/utils/user'

const show = defineModel({ default: false })

const loading = ref(false)

const userFormRef = ref()

const newUserInfo = ref<IUserInfo>({
  userName: '',
  userAvatar: '',
  userId: createUserId(),
  createTime: new Date().getTime()
})

const userEditRules = reactive({
  userName: [{
    validator: function (rule, value, callback) {
      if (newUserInfo?.value?.userName?.length < 1) {
        callback(new Error("请输入用户名！"));
      } else if (isUserNameExist(newUserInfo.value.userName)) {
        // 如果分组名称已经存在了校验则不通过
        callback(new Error("用户名已存在！"));
      } else {
        //校验通过
        callback();
      }
    }, trigger: 'blur'
  }],
})

/**
 * @description: 重置表单
 * @return {*}
 */
function resetUserForm() {
  newUserInfo.value.userName = ''
  newUserInfo.value.userAvatar = ''
}

function closeDialog() {
  resetUserForm()
  show.value = false
}

/**
 * @description: 创建新分组
 * @return {*}
 */
function createNewUser() {
  loading.value = true
  userFormRef.value.validate(async (valid, fields) => {
    if (valid) {
      newUserInfo.value.userId = createUserId()
      newUserInfo.value.createTime = new Date().getTime()
      // 将新分组信息添加到schema中
       await createUser({...newUserInfo.value})
       // 将新建用户作为激活用户
      changeCurrentUser(newUserInfo.value.userId)
      closeDialog()
      loading.value = false
    } else {
      loading.value = false
      console.log('error submit!', fields)
    }
  })
}


</script>

<style lang="scss" scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;

  .locate-button {
    flex: 1;
    margin-right: 50px;
    margin-left: 10px;
    justify-self: flex-start
  }
}
</style>