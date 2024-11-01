<script setup lang="ts">
import { mdiAccountEdit, mdiClose, mdiCog, mdiRadar, mdiGithub, mdiLogout, mdiSearchWeb, mdiBookSearch, mdiTabSearch, mdiMagnify } from '@mdi/js'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import placeholderUrl from '@/assets/placeholder.png'
import { useUserStore } from '@/store/user'
import type { Account } from '@/types'
const { t } = useI18n()
const userStore = useUserStore()
const router = useRouter()
const { account } = storeToRefs(userStore)

const profile = computed((): Account['profile'] | undefined => {
  return account.value?.profile
})

const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue'])

const show = computed<boolean>({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  },
})

const state = ref({
  radar: {
    id: 0,
    title: '',
    picUrl: '',
  },
})
import { getPlaylistDetail } from '@/api/playlist'
import { specialType } from '@/util/metadata'

onMounted(async () => {
  const { playlist: radarPlaylist } = await getPlaylistDetail(specialType.radar.id)
  state.value.radar.id = radarPlaylist.id
  state.value.radar.picUrl = radarPlaylist.coverImgUrl
  state.value.radar.title = t('main.discover.radar')
})

function dispatch(type: string) {
  switch (type) {
    case 'sign_out':
      signOut()
      show.value = false
      break
    case 'search':
      show.value = false
      router.push('/search')
      break
    case 'recent':
      show.value = false
      router.push('/recent')
      break
    case 'podcast':
      show.value = false
      router.push(`/playlist/${state.value.radar.id}`)
      break
  }
}
const signOut = () => {
  userStore.signOut()
}

</script>
<template>
  <v-dialog v-model="show">
    <v-card flat color="surface" width="50vw" max-width="420" rounded="xl" class="align-self-center">
      <div class="mt-auto py-5"></div>

      <!-- 头像 -->
      <div class="mx-6 position-relative mb-8">
        <v-card v-if="profile" variant="tonal" height="86" class="rounded-xl d-flex justify-start align-center px-4">
          <v-avatar size="54">
            <v-img :aspect-ratio="1" contain :src="profile.avatarUrl" :lazy-src="placeholderUrl" />
          </v-avatar>
          <div class="d-flex flex-column text-start ml-3">
            <div class="d-flex gap-1 w-full">
              <span class="font-weight-medium line-clamp-1">{{ profile.nickname }} </span>
            </div>
          </div>
        </v-card>
      </div>

      <!-- 私人雷达 -->
      <v-list-item height="64" class="mx-6 px-3 bg-surfaceVariant rounded-lg" @click="dispatch('podcast')">
        <template #prepend>
          <v-btn variant="tonal" icon color="secondary">
            <v-icon size="small">{{ mdiRadar }}</v-icon>
          </v-btn>
        </template>
        <v-list-item-title class="ml-2"> 私人雷达 </v-list-item-title>
      </v-list-item>

      <div class="mt-auto py-1"></div>

      <!-- 搜索音乐 -->
      <v-list-item height="64" class="mx-6 px-3 bg-surfaceVariant rounded-lg" @click="dispatch('search')">
        <template #prepend>
          <v-btn variant="tonal" icon color="secondary">
            <v-icon size="small">{{ mdiMagnify }}</v-icon>
          </v-btn>
        </template>
        <v-list-item-title class="ml-2"> 搜索音乐 </v-list-item-title>
      </v-list-item>

      <!-- 退出登录 -->
      <v-list-item height="64" class="mx-6 px-3 mt-2 bg-surfaceVariant rounded-lg" @click="dispatch('sign_out')">
        <template #prepend>
          <v-btn variant="tonal" icon color="tertiary">
            <v-icon size="small">{{ mdiLogout }}</v-icon>
          </v-btn>
        </template>
        <v-list-item-title class="ml-2">{{ $t('message.logout') }}</v-list-item-title>
      </v-list-item>

      <div class="mt-auto py-4"></div>
    </v-card>
  </v-dialog>
</template>
