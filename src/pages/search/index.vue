<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue'
import { useToast } from 'vue-toastification'

import { multiMatchSearch, search } from '@/api/music'
import type { Album, Artist, Playlist, Track } from '@/types'
const toast = useToast()

const searchTypes = {
  song: { type: 1, limit: 24 },
  album: { type: 10, limit: 15 },
  artist: { type: 100, limit: 15 },
  playlist: { type: 1000, limit: 15 },
}

const loading = ref(false)
const state = reactive({
  artists: [] as Artist[],
  songs: [] as Track[],
  albums: [] as Album[],
  playlists: [] as Playlist[],
})
const props = defineProps({
  keywords: {
    type: String,
    default: '',
  },
})
const keyword = ref<null | string>(null)
watchEffect(() => {
  if (props.keywords) {
    keyword.value = props.keywords
    triggerSearch()
  }
})

async function triggerSearch() {
  if (keyword.value) {
    loading.value = true
    try {
      // 清空数据
      state.songs = []
      state.albums = []
      state.artists = []
      state.playlists = []

      const requests = Object.entries(searchTypes).map(([, val]) => {
        return search(keyword.value, {
          type: val.type,
          limit: val.limit,
        })
      })
      const [{ result: song }, { result: album }, { result: artist }, { result: playlist }] = await Promise.all(
        requests
      )
      state.songs = song.songs ?? []
      state.albums = album.albums ?? []
      state.artists = artist.artists ?? []
      state.playlists = playlist.playlists ?? []
    } catch (e) {
      toast.error('oops something wrong')
    } finally {
      loading.value = false
    }
  }
}
enum TYPES {
  MUSIC = 'music',
  ARTIST = 'artist',
  ALBUM = 'album',
  PLAYLIST = 'playlist',
}

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const current = ref(TYPES.MUSIC)
const tabs = computed(() => {
  return [
    { key: TYPES.MUSIC, name: '歌曲' },
    { key: TYPES.ARTIST, name: t('main.artists') },
    { key: TYPES.ALBUM, name: t('main.albums') },
    { key: TYPES.PLAYLIST, name: t('main.playlists') },
  ]
})
</script>
<template>
  <div class="d-flex flex-column">
    <div class="search-container">
      <input
        loading="loading"
        type="text"
        id="searchInput"
        v-model="keyword"
        placeholder="搜索"
        @keydown.enter="triggerSearch"
      />
    </div>
    <!-- 切换button -->
    <v-btn-toggle class="mx-auto" v-model="current" color="primary" variant="text">
      <v-btn v-for="tab in tabs" :key="tab.key" rounded="md" :value="tab.key" class="mx-1 px-6">
        {{ tab.name }}
      </v-btn>
    </v-btn-toggle>

    <v-window :model-value="current" class="mt-4">
      <v-window-item :value="TYPES.MUSIC">
        <Col v-if="state.songs.length" :title="$t('main.songs')">
          <track-list :tracks="state.songs" type="album" cover> </track-list>
        </Col>
        <ListSkeleton v-if="loading" />
      </v-window-item>
      <v-window-item :value="TYPES.ARTIST">
        <CardRow>
          <ArtistsCover v-for="artist in state.artists" :key="artist.id" :artist="artist"></ArtistsCover>
        </CardRow>
      </v-window-item>

      <v-window-item :value="TYPES.ALBUM">
        <CardRow>
          <Cover v-for="album in state.albums" :key="album.id" :data="album" type="album"></Cover>
        </CardRow>
      </v-window-item>
      <v-window-item :value="TYPES.PLAYLIST">
        <CardRow>
          <Cover v-for="playlist in state.playlists" :key="playlist.id" :data="playlist" type="playlist"></Cover>
        </CardRow>
      </v-window-item>
    </v-window>
  </div>
</template>
<style lang="scss" scoped>
.search-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 12vh;
  margin: 0 5vw;
}

#searchInput {
  padding-left: 50px;
  width: 100%;
  height: 62px;
  border: none;
  border-radius: 30px;
  outline: none;
  font-size: 20px;
  color: #15080b;
  background-color: #e8f0fe;
}

#searchInput::placeholder {
  color: #464848;
}

</style>
