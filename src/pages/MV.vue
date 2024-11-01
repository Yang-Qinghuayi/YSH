<style scoped>
.mv {
  margin: auto;
  margin-top: 6vh;
  max-width: 70%;
}

.folder {
  background-color: #efe6dd;
  padding: 20px;
  margin: 10px;
  border-radius: 16px;
  transition: all 0.5s ease-in-out;
}

.folder:hover {
  background-color: #e2d6c9;
}

.movieList {
  width: 50vw;
  margin: auto;
  margin-left: 30vw;
  height: 50vh;
  overflow: scroll;
  background-color: #fdfcf4;
  padding: 0 10px;
  border-radius: 10px;
}
</style>

<template>
  <div >
    <div class="body">
      <div class="mv video-container">
        <div class="video">
          <video ref="video" />
        </div>
        <v-card @click="showMovieList = !showMovieList" rounded="md" color="surfaceVariant" class="pa-4 mt-4" flat>
          <span class="text-h7">
            {{ movieName }}
          </span>
        </v-card>
      </div>
    </div>

    <v-dialog v-model="showMovieList">
      <div class="movieList">
        <v-card
          @click="changeMovie(movie)"
          v-for="movie in movieAlbum"
          rounded="md"
          class="pa-3 mt-3"
          color="surfaceVariant"
          flat
        >
          <span class="text-h7">
            {{ movie.split('/').pop() }}
          </span>
        </v-card>
      </div>
    </v-dialog>
    <!-- <div class="table">
      <div @click="changeMovie(movie)" class="folder" v-for="movie in movieAlbum" :key="folder">
        {{ movie.split('/').pop() }}
      </div>
    </div> -->
  </div>
</template>

<script lang="ts" setup>
const showMovieList = ref(false)

import 'plyr/dist/plyr.css'
import { storeToRefs } from 'pinia'
import Plyr from 'plyr'
import { useSettingStore } from '@/store/setting'
import { fsMovie } from '@/api/alist'
const settingStore = useSettingStore()
const props = defineProps<{
  id: string
}>()
const playerInstance = ref<Plyr>()
const video = ref<HTMLMediaElement>()
import Hls from 'hls.js'
import { useMovieStore } from '@/store/movie'
const movieStore = useMovieStore()
const { moviePath, movieAlbum } = storeToRefs(movieStore)

let movieName = computed(() => moviePath.value.split('/').pop())

function changeMovie(movie: string) {
  showMovieList.value = false
  movieStore.SET_MoviePath(movie)
  fetch()
}

onMounted(() => {
  fetch()
})
async function fetch() {
  const source = await getMovieUrl()
  const player = new Plyr(video.value!, {
    captions: { active: true, update: true, language: 'en' },
  })
  if (!Hls.isSupported()) {
    video.value!.src = source
  } else {
    const hls = new Hls()

    hls.loadSource(source)
    hls.attachMedia(video.value!)
    window['hls'] = hls
    player.on('languagechange', () => {
      setTimeout(() => {
        hls.subtitleTrack = player.currentTrack
      }, 50)
    })
  }
  window['player'] = player
}

let getMovieUrl = async () => {
  let rst = await fsMovie(moviePath.value)
  const list = rst.data.video_preview_play_info.live_transcoding_task_list.filter((l) => l.url)
  return list[2].url
}
</script>
<style lang="scss" scoped>
.video-container {
  .video {
    overflow: hidden;
    --plyr-color-main: rgba(var(--v-theme-primary));
  }
}
</style>
