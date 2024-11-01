<style scoped>
.head {
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  /* background-color: #f2f3ed; */
  height: 60px;
  margin: 0 16px;
  border: 2px solid #e5ebc9;
}

.account {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  margin: 0 16px;
  align-items: center;
}

.head:hover {
  background-color: #f4f3eb;
}
</style>

<template>
  <div>
    <div v-if="logged" @click="toPage('/music')" class="head">
      <button class="account">
        <v-avatar size="40">
          <v-img :aspect-ratio="1" contain :src="avatarUrl" :lazy-src="placeholderUrl" />
        </v-avatar>
          <div class="ml-10" v-show="!rail">
            <div>{{ username }}</div>
          </div>
      </button>
    </div>
    <div class="head" v-else icon flat @click="showLogin = !showLogin">
      <v-icon>
        {{ mdiNetEase }}
      </v-icon>
    </div>
  </div>
</template>
<script setup lang="ts">
// 接受参数
const props = defineProps<{ rail: string }>()
const { rail } = toRefs(props)

import { storeToRefs } from 'pinia'
import { mdiNetEase } from '@/util/icons'
import placeholderUrl from '@/assets/placeholder.png'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { toHttps } from '@/util/fn'

const appStore = useAppStore()
const userStore = useUserStore()
const { showLogin } = storeToRefs(appStore)
const { logged, account } = storeToRefs(userStore)

const avatarUrl = computed(() => toHttps(account.value?.profile.avatarUrl ?? ''))
const username = computed(() => account.value?.profile.nickname ?? '')

import { useRouter } from 'vue-router'
// 点击跳转函数,使用router
const router = useRouter()
const toPage = (path: string) => {
  router.push(path)
}
</script>
