<template>
  <v-card class="text-onSurfaceVariant" :theme="currentTheme">
    <v-layout>
      <v-main class="frame" @contextmenu="handleContextMenu">
        <!-- 头部 -->
        <div class="" @click="close">
          <v-btn class="no-drag-area" icon variant="text" @click="close">
            <v-icon>
              {{ mdiClose }}
            </v-icon>
          </v-btn>
        </div>
        <!-- 中间的部分完成 -->
        <div class="h-[96%] flex">
          <div class="flex flex-col flex-[2.3] items-center justify-center">
            <img :src="coverUrl" class="w-[10vw] rounded-md" />
            <!-- 音乐控制 -->
            <control class="my-5" />

            <!-- 歌曲名称 -->
            <span class="text-xl max-w-[16vw] line-clamp-1"
              >{{ track?.name }}
            </span>
            <!-- 专辑艺术家 -->
            <template v-if="track?.['al']">
              <span @click="showLyric = false">
                <artists-link :artists="track['ar']"
              /></span>
            </template>

            <!-- 四个按钮 -->
            <div class="mt-2">
              <v-btn variant="text" icon @click="toQueue">
                <v-icon ref="playlistBtn" size="small">
                  {{ mdiPlaylistMusic }}
                </v-icon>
              </v-btn>
              <template v-if="!isProgram && track?.id">
                <like-toggle :id="track['id']" />
                <music-comment-toggle :id="track['id']" />
              </template>
              <v-btn icon variant="text" @click="toggleMode">
                <v-icon size="small">
                  {{ modeIcon }}
                </v-icon>
              </v-btn>
              <!-- 更多 -->
              <v-btn icon variant="text" @click="handleContextMenu">
                <v-icon size="small">{{ mdiDotsHorizontal }}</v-icon>
              </v-btn>
            </div>
            <div class="w-[52%] mt-3">
              <TrackSlider />
            </div>
          </div>
          <div class="flex-[6]">
            <scroll-lyric v-if="displayLyric" />
          </div>
        </div>
      </v-main>
    </v-layout>
  </v-card>
</template>

<script lang="ts" setup>
const { isActive: isQueue } = useInForeground("queue");
const router = useRouter();

function toQueue() {
  if (isQueue.value) {
    router.back();
  } else {
    router.push("/queue");
  }
  showLyric.value = false;
}

const { track, isProgram, toggleMode, modeIcon } = usePlayerControl();

import { mdiPlaylistMusic, mdiClose, mdiDotsHorizontal } from "@mdi/js";
import { storeToRefs } from "pinia";
import { useContextMenu } from "vuetify-ctx-menu/lib/main";

import { useDownloadMusic } from "@/hooks/useDownload";
import usePlayerControl from "@/hooks/usePlayerControl";
import { useTrackOperation } from "@/hooks/useTrackOperation";
import ScrollLyric from "@/pages/mode/components/ScrollLyric.vue";
import { useAppStore } from "@/store/app";
import { usePlayerStore } from "@/store/player";
import { useSettingStore } from "@/store/setting";
import { formatDuring, sizeOfImage, sleep } from "@/util/fn";

const playerStore = usePlayerStore();
const appStore = useAppStore();
const settingStore = useSettingStore();
const contextMenu = useContextMenu();
const loading = ref(false);
const { showLyric } = storeToRefs(appStore);
const { themeName } = useCurrentTheme();

const coverUrl = computed(() =>
  sizeOfImage(track.value?.coverUrl ?? track.value?.al?.picUrl ?? "", 1024)
);

const currentTheme = computed(() => {
  return settingStore.wallpaperColor + "Light";
});

const displayLyric = ref(true);

async function close() {
  showLyric.value = false;
}

async function loadPrev() {
  loading.value = true;
  await nextTick();
  await sleep(350);
}
async function loadNext() {
  loading.value = true;
  await nextTick();
  await sleep(350);
}

function toggleLyricDisplay() {
  displayLyric.value = !displayLyric.value;
}

async function onLoad() {
  await nextTick();
  loading.value = false;
}
function onError() {
  loading.value = false;
}

function handleContextMenu(event: MouseEvent) {
  // 劫持系统默认行为
  event.preventDefault();
  if (!track.value) {
    return;
  }
  const { toPlaylistMenuItems } = useTrackOperation(track.value);
  const { x, y } = event;
  const option = {
    theme: themeName.value,
    x,
    y,
    items: [
      {
        label: "加入歌单",
        children: toPlaylistMenuItems.value,
      },
      {
        divided: true,
      },
      {
        label: "下载当前歌曲",
        onClick: () => {
          if (track?.value?.id) {
            useDownloadMusic(track.value);
          }
        },
      },
    ],
    offsetFooter: 64,
    customClass: "bg-surfaceVariant",
  };
  contextMenu(option);
}
</script>
