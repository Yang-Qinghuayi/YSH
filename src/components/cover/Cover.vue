<template>
  <v-hover v-slot="{ isHovering, props: hoverProps }">
    <v-card
      class="cover-container"
      :rounded="rounded"
      :flat="true"
      v-bind="{ ...hoverProps, ...$attrs }"
      :to="to"
    >
      <v-img
        class="cover-image"
        :cover="true"
        :src="coverBgUrl"
        style="aspect-ratio: 1"
        :aspect-ratio="1"
        :lazy-src="placeholderUrl"
      >
        <!-- 封面中的按钮 -->
        <div class="d-flex flex-fill fill-height align-end  p-2">
          <transition>
            <div v-if="(isHovering || inActive) && showHover" >
              <v-btn
                size="small"
                variant="flat"
                :icon="true"
                color="primary"
                :loading="loading"
                @click.prevent="toggle"
              >
                <v-icon color="onPrimary">{{ coverPlaying ? mdiPause : mdiPlay }} </v-icon>
              </v-btn>
              <slot name="action" />
            </div>
          </transition>
        </div>
      </v-img>



      <div v-if="shadow && noInfo" class="cover-shadow" :style="`background-image: url('${coverBgUrl}')`" />
      
      <!-- 名称 -->
      <v-card-title v-if="!noInfo" :class="`line-clamp-${titleLine}`" style="white-space: initial">
        <router-link :to="`/playlist/${data.id}`" class="text-subtitle-1 text-onSurfaceVariant ">
          {{ data.name }}
        </router-link>
      </v-card-title>
      <span v-if="!noInfo && subTitle" class="line-clamp-1 text-subtitle-2 text-disabled mb-4 px-4">
        {{ subTitle }}
      </span>
      <slot />
    </v-card>
  </v-hover>
</template>
<script setup lang="ts">
import { mdiPause, mdiPlay } from '@mdi/js'
import { storeToRefs } from 'pinia'

import { getTrackList } from '@/api/music'
import placeholderUrl from '@/assets/placeholder.png'
import useInForeground from '@/hooks/useInForeground'
import { usePlayer } from '@/player/player'
import { usePlayerStore } from '@/store/player'
import { usePlayQueueStore } from '@/store/playQueue'
import { sizeOfImage, toHttps } from '@/util/fn'
const player = usePlayer()
const playStore = usePlayerStore()
const playQueue = usePlayQueueStore()
const loading = ref<boolean>(false)
const { playing } = storeToRefs(playStore)
const loaded = ref(false)
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  rounded: {
    type: [String, Boolean],
    default: 'md',
  },
  type: {
    type: String,
    default: 'album',
    require: true,
  },
  titleLine: {
    type: Number,
    default: 1,
  },
  subTitle: {
    type: String,
    default: '',
  },
  noInfo: {
    type: Boolean,
    default: false,
  },
  showHover: {
    type: Boolean,
    default: true,
  },
  extra: {
    type: String,
    default: null,
  },
  shadow: {
    type: Boolean,
    default: false,
  },
})
const { isActive: isInDetail } = useInForeground(['playlist', 'album'])

const coverBgUrl = computed(() => {
  return sizeOfImage(toHttps(props.data.picUrl ?? props.data.coverImgUrl))
})
const subTitle = computed(() => {
  return props.extra ?? props.data.copywriter
})

const to = computed(() => {
  return {
    album: `/album/${props.data.id}`,
    playlist: `/playlist/${props.data.id}`,
    artist: `/artist/${props.data.id}`,
  }[props.type]
})
const inActive = computed(() => {
  return props.data.id === playQueue.queue.id && !isInDetail.value
})
const coverPlaying = computed(() => {
  return playing.value && inActive.value
})

async function toggle() {
  if (coverPlaying.value) {
    player.pause()
  } else {
    if (loaded.value && inActive.value) {
      player.play()
    } else {
      loading.value = true
      try {
        const info = await getTrackList(<'album' | 'playlist'>props.type, props.data.id)
        playQueue.updatePlayQueue(info.id, <'album' | 'playlist'>props.type, props.data.name, info.tracks)
        player.next()
        loaded.value = true
      } catch (e) {
        console.log(e)
      } finally {
        loading.value = false
      }
    }
  }
}
</script>
<style scoped lang="scss">
.cover-container {
  border-radius: 12px;
  .cover-image {
    border-radius: 12px;
  }
}
</style>
