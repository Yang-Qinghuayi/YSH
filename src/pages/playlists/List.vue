<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDisplay } from 'vuetify'

import { getPlaylistDetail, getPlaylistTrackAll, getRelatedPlayList } from '@/api/playlist'
import useAjaxReloadHook from '@/hooks/useAjaxReload'
import { useSettingStore } from '@/store/setting'
import { useUserStore } from '@/store/user'
import type { Playlist } from '@/types'
import { specialType } from '@/util/metadata'

import PlaylistHeader from '../components/PlaylistHeader.vue'
const userStore = useUserStore()
const settingStore = useSettingStore()
const props = defineProps<{
  id: number | string
}>()

// 这是用于刚进新的歌单滑动到顶部使用的
useScrollToTop(0, () => props.id)
const { smAndUp } = useDisplay()
const loading = ref(false)

interface RootState {
  playlist: Playlist
  relatedPlaylists: Playlist[]
}
const state: RootState = reactive({
  playlist: {} as any,
  relatedPlaylists: [],
})

const createdBySelf = computed(() => {
  return userStore.account?.profile.userId === state.playlist.creator?.userId
})

// 特殊歌单“喜欢的音乐”
const isMyFavPlayList = computed(() => {
  return state.playlist.specialType === specialType.fav.type
})

watchEffect(() => {
  props.id && fetch(+props.id)
})

async function fetch(id: number, flush = false) {
  loading.value = true
  const { playlist } = await getPlaylistDetail(id, flush)
  state.playlist = playlist
  loading.value = false
  // ”我喜欢的音乐“ 歌单能够返回完整的tracks, 所以不用重新请求完整列表
  await nextTick()
  if (!isMyFavPlayList.value && state.playlist.trackIds?.length) {
    const { songs } = await getPlaylistTrackAll(playlist)
    state.playlist.tracks = songs
  }
  if (playlist.id) {
    const { playlists } = await getRelatedPlayList(playlist.id)
    state.relatedPlaylists = playlists
  }
}

useAjaxReloadHook('playlist', () => {
  fetch(+props.id, true)
})
</script>
<template>
  <section>
    <PlaylistHeader :playlist="state.playlist" />
    <list-loader class="mt-6" v-if="loading" />
    <div v-else class="mt-6 list d-flex flex-column gap-4">
      <track-list
        :id="state.playlist.id"
        :type="smAndUp ? (isMyFavPlayList ? 'fav' : 'playlist') : 'album'"
        :tracks="state.playlist.tracks"
        :own="createdBySelf"
        virtual-scroll-optimization
        :header="smAndUp"
        @update-list="(list) => (state.playlist.tracks = [...list])"
      />
    </div>
  </section>
</template>
