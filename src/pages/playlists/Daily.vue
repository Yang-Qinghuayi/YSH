<style scoped lang="scss">
.playlistHead {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  #myCover {
    border-radius: 10px;
    width: 240px;
    height: 240px;
    margin: auto 10px;
  }
}
</style>

<template>
  <section>
    <!-- 头部 -->
    <div>
      <back-btn class="align-self-start mb-auto mx-4 mt-4" variant="tonal" color="primary" />
      <div class="no-drag-area">
        <div class="d-flex flex-column gap-2 mx-6 mb-2">
          <span
            class="text-h4 text-lg-h3 text-xl-h3 text-xxl-h2 font-weight-medium line-clamp-2 select-text text-seconday"
            >{{ t('main.daily.title') }}</span
          >

          <div class="d-flex py-2">
            {{ t('main.daily.sub') }}
          </div>
          <div class="d-flex align-center">
            <v-btn
              size="large"
              class="mr-4 px-10 rounded-pill"
              variant="tonal"
              color="primary"
              :loading="loading"
              @click="play"
            >
              <v-icon size="large">{{ mdiPlayOutline }}</v-icon>
            </v-btn>
            <v-btn icon variant="tonal" color="secondary" @click="fetch">
              <v-icon size="small">
                {{ mdiReload }}
              </v-icon>
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div class="mt-6">
      <list-loader v-if="fetchLoading" />
      <div v-else class="d-flex flex-column gap-6">
        <!-- 真正的列表 -->
        <track-list
          virtual-scroll-optimization
          :tracks="daily as Track[]"
          header
          type="daily"
          @update-list="(list) => (daily = [...list])"
        />
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { mdiPlay, mdiPlayOutline, mdiReload } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'

import { getDailyRecommend } from '@/api/user'
import useAjaxReloadHook from '@/hooks/useAjaxReload'
import { usePlayer } from '@/player/player'
import { usePlayQueueStore } from '@/store/playQueue'
import type { Track } from '@/types'

useScrollToTop()
const { smAndUp } = useDisplay()
const { t } = useI18n()
const player = usePlayer()
const playQueueStore = usePlayQueueStore()
const loading = ref(false)
const fetchLoading = ref(false)
const daily = ref<Track[]>([])
const coverUrl = computed(() => daily.value[0]?.al?.picUrl ?? daily.value[0]?.album?.picUrl)

fetch()
useAjaxReloadHook('daily', () => {
  fetch()
})
function fetch() {
  fetchLoading.value = true
  getDailyRecommend().then(({ data }) => {
    daily.value = data?.dailySongs ?? []
    fetchLoading.value = false
  })
}
async function play() {
  loading.value = true
  playQueueStore.updatePlayQueue(0, 'daily', '日推', daily.value)
  player.next()
  loading.value = false
}
</script>
