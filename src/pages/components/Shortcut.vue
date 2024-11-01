<template>
  <v-hover v-slot="{ isHovering, props: hoverProps }">
    <v-card
      rounded="md"
      color="surfaceVariant text-decoration-none"
      class="d-flex quick-card align-center"
      flat
      :height="height"
      :to="to"
      v-bind="hoverProps"
    >
      <div
        v-if="smAndUp"
        :class="`bg-${flag.color}`"
        class="rounded-circle d-flex align-center justify-center ml-4"
        style="height: 45px; width: 45px; min-width: 45px"
      >
        <v-icon v-if="flag.icon" size="small">
          {{ flag.icon }}
        </v-icon>
        <span v-if="flag.label">
          {{ flag.label }}
        </span>
      </div>
      <div class="d-flex align-start justify-space-between flex-fill px-4 flex-column text-onSurfaceVariant">
        <span :title="data.title" class="text-subtitle-1 line-clamp-1">
          {{ data.title }}
        </span>
        <span :title="data.subTitle" class="text-subtitle-2 line-clamp-1">
          {{ data.subTitle }}
        </span>
      </div>

      <div v-if="canPlay" class="button">
        <v-btn icon="true" variant="flat" size="small" :color="flag.color" :loading="loading" @click.prevent="play">
          <v-icon color="onPrimary">{{ coverPlaying ? mdiPause : mdiPlay }} </v-icon>
        </v-btn>
      </div>
    </v-card>
  </v-hover>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/store/player'
const playQueue = usePlayQueueStore()
const { isActive: isInDetail } = useInForeground(['playlist', 'album'])

const playStore = usePlayerStore()

const { playing } = storeToRefs(playStore)
const coverPlaying = computed(() => {
  return playing.value && inActive.value
})
const inActive = computed(() => {
  return props.data.id === playQueue.queue.id && !isInDetail.value
})

import { mdiPlay, mdiPause } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'

import { getTrackList } from '@/api/music'
import { getDailyRecommend, recent } from '@/api/user'
import placeholderUrl from '@/assets/placeholder.png'
import { usePlayer } from '@/player/player'
import { usePlayQueueStore } from '@/store/playQueue'
import type { Track } from '@/types'
import { sizeOfImage } from '@/util/fn'
const { t } = useI18n()
const { smAndUp } = useDisplay()

const height = computed(() => {
  return smAndUp.value ? 76 : 64
})
const player = usePlayer()
const playQueueStore = usePlayQueueStore()
const props = defineProps<{
  data: {
    id?: number
    title: string
    subTitle?: string
    picUrl: string
  }
  type: 'album' | 'playlist' | 'artist' | 'daily' | 'recent' | 'program'
  flag: {
    color: string
    label?: string
    icon?: string
  }
}>()

const loading = ref<boolean>(false)

const coverImgUrl = computed(() => {
  if (props.data.picUrl) {
    return sizeOfImage(props.data.picUrl, 256)
  } else {
    return placeholderUrl
  }
})

const to = computed(() => {
  return {
    album: `/album/${props.data.id}`,
    playlist: `/playlist/${props.data.id}`,
    artist: `/artist/${props.data.id}`,
    daily: `/daily`,
    recent: '/recent',
    program: `/podcast/${props.data.id}`,
  }[props.type]
})

const canPlay = computed(() => {
  return ['daily', 'album', 'playlist', 'artist', 'recent', 'program'].includes(props.type)
})
async function play() {
  try {
    loading.value = true
    let info: {
      id?: number
      list: Track[]
    }
    if (props.type === 'daily') {
      const { data } = await getDailyRecommend()
      info = {
        list: data['dailySongs'],
      }
      playQueueStore.updatePlayQueue(0, 'daily', t('main.discover.daily'), info.list)
    } else if (props.type === 'recent') {
      const { data } = await recent()
      info = {
        list: data.list.map((i) => i['data']),
      }
      playQueueStore.updatePlayQueue(0, 'recent', t('common.recent'), info.list)
    } else {
      const data = await getTrackList(props.type, props.data.id as number)
      info = {
        id: data.id,
        list: data.tracks,
      }
      playQueueStore.updatePlayQueue(info.id!, props.type, data.name!, info.list)
    }
    player.next()
  } catch (e) {
    console.debug(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.button {
  margin-right: 18px;
}
</style>
