<template>
  <div>
    <!-- 账户所在 -->
    <account-extended-fab class="mb-4" />
    <!--    我的每日推荐-->
    <component
      :is="component.component"
      v-for="component in shortcutComponents"
      :key="component.type"
      :data="component.data"
      :type="component.type"
      :flag="component.flag"
    />
    <!-- 主界面 -->
    <v-window :model-value="current" class="mt-4">
      <v-window-item :value="TYPES.PLAYLIST">
        <Col :title="$t('common.created_playlist')" class="mb-4">
          <template #more>
            <v-btn rounded="pill" variant="outlined" color="primary" @click="handleCreatePlaylist">
              <span class="d-flex align-center">
                <v-icon>{{ mdiPlus }}</v-icon>
                {{ $t('main.playlist.new') }}
              </span>
            </v-btn>
          </template>
          <!-- 我创建的歌单 -->
          <card-row>
            <cover v-for="item in filteredPlaylist.create" :key="item.id" :data="item" type="playlist" />
          </card-row>
        </Col>
        <Col :title="$t('common.sub_playlist')">
          <card-row>
            <cover v-for="item in filteredPlaylist.sub" :key="item.id" :data="item" type="playlist" />
          </card-row>
        </Col>
      </v-window-item>
    </v-window>

    <v-dialog v-model="createState.show">
      <v-card width="90vw" max-width="450" rounded="xl" class="py-2 align-self-center">
        <v-card-title>{{ $t('main.playlist.new') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="createState.playlistName"
            :label="$t('main.playlist.name')"
            maxlength="45"
            variant="outlined"
            density="compact"
            hide-details
          ></v-text-field>
          <v-checkbox
            v-model="createState.playlistPrivate"
            :label="$t('main.playlist.privacy')"
            hide-details
          ></v-checkbox>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="plain" @click="createState.show = false"> {{ $t('common.cancel') }} </v-btn>
          <v-btn variant="plain" color="primary" @click="createNewPlaylist"> {{ $t('common.confirm') }} </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
// 这个部分是每日推荐的组件
import Shortcut from '@/pages/components/Shortcut.vue'
import { computed } from 'vue'
const shortcutComponents = computed(() => {
  const components: any[] = []
  components.push({
    component: Shortcut,
    data: {
      title: '每日推荐',
      subTitle: '',
      picUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Features124/v4/7b/1d/f0/7b1df048-0017-8ac0-98c9-735f14849606/mza_7507996640781423701.png/600x600bb.webp',
    },
    type: 'daily',
    flag: { color: 'secondary', icon: mdiCalendarToday },
  })
  return components
})

import { mdiCalendarToday, mdiPlus } from '@mdi/js'
import { groupBy } from 'lodash-es'
import { storeToRefs } from 'pinia'

import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'

import { createPlaylist } from '@/api/playlist'
import { favAlbums, favArtists, favMVs, favPodcast } from '@/api/user'
import useAjaxReloadHook from '@/hooks/useAjaxReload'
import { usePlayer } from '@/player/player'
import { useUserStore } from '@/store/user'
import type { Album, Artist, MV, Podcast } from '@/types'

const { t } = useI18n()

const route = useRoute()
const userStore = useUserStore()
const toast = useToast()
useScrollToTop()
const { playlists, uid } = storeToRefs(userStore)

const filteredPlaylist = computed(() => {
  return groupBy(playlists.value, (i) => {
    return i.userId === uid.value ? 'create' : 'sub'
  })
})

enum TYPES {
  PLAYLIST = 'playlist',
  ALBUM = 'album',
  ARTIST = 'artist',
  MV = 'mv',
  CLOUD = 'cloud',
  RANKING = 'listen-ranking',
  PODCAST = 'podcast',
}

const current = ref(TYPES.PLAYLIST)
const data: {
  albums: Album[]
  artists: Artist[]
  mvs: MV[]
  podcasts: Podcast[]
} = reactive({
  albums: [],
  artists: [],
  mvs: [],
  podcasts: [],
})
const pagination = reactive({
  album: {
    list: [],
    more: false,
    start: 0,
  },
  artist: {
    list: [],
    more: false,
    start: 0,
  },
  mv: {
    list: [],
    more: false,
    start: 0,
  },
  podcast: {
    list: [],
    more: false,
    start: 0,
  },
})
const loading = ref(true)
// 取数据
await fetch()
useAjaxReloadHook('library', () => {
  // reload
  fetch()
  // reload playlist
  userStore.fetch()
})

async function fetch() {
  current.value = TYPES.PLAYLIST
  await loadData('album')
  loading.value = false
}
async function loadData(type: 'album' | 'mv' | 'podcast' | 'artist') {
  const start = pagination[type].start
  const fn = {
    artist: favArtists,
    album: favAlbums,
    podcast: favPodcast,
    mv: favMVs,
  }[type]
  const moreData = (await fn(start)) as any
  switch (type) {
    case 'album': {
      if (moreData.data?.length) {
        data.albums.push(...moreData.data)
        if (moreData.hasMore) {
          pagination.album.start = data.albums.length
        }
      }

      pagination.album.more = moreData.hasMore
      break
    }
    case 'artist': {
      if (moreData.data?.length) {
        data.artists.push(...moreData.data)
        if (moreData.hasMore) {
          pagination.artist.start = data.artists.length
        }
      }
      pagination.artist.more = moreData.hasMore
      break
    }
  }
}
onActivated(() => {
  const tab = route.params.tab as TYPES
  if (tab) {
    current.value = tab
  }
})
const createState = reactive({
  show: false,
  playlistName: '',
  playlistPrivate: false,
})
function handleCreatePlaylist() {
  createState.show = true
  createState.playlistName = ''
  createState.playlistPrivate = false
}

async function createNewPlaylist() {
  try {
    await createPlaylist({
      name: createState.playlistName,
      privacy: createState.playlistPrivate ? 10 : 0,
    })
    toast.success('创建成功')
    createState.show = false
    await userStore.flushPlaylist()
  } catch (e) {
    toast.error(t('message.something_wrong'))
  }
}
</script>
