<template>
  <div @contextmenu="handleContextMenu" v-if="track?.id">
    <div id="head">
      <!-- 专辑封面 -->
      <img @click.stop="showPlayingPage" id="myCover" :src="coverUrl" />
      <!-- 歌曲名称 -->
      <div class="text-h6">
        <router-Link
          v-if="track.al"
          :to="`/album/${track.al.id}`"
          class="text-onSurface line-clamp-1"
          >{{ track?.name }}
        </router-Link>
        <span v-else class="line-clamp-1"> {{ track?.name }} </span>
      </div>
      <!-- 艺术家 -->
      <artists-link :artists="track?.ar" class="text-caption line-clamp-1" />

      <!-- 控制单元 -->
      <Control />
    </div>

    <!-- 这是进度条 -->
    <TrackSlider />

    <!-- 这是我的按钮 -->
    <!-- <div class="my-buttons">
      <v-btn variant="text" icon :disabled="isCurrentFm" @click="toQueue">
        <v-icon ref="playlistBtn" size="small">
          {{ mdiPlaylistMusic }}
        </v-icon>
      </v-btn>

      <v-btn icon :disabled="isCurrentFm" variant="text" @click="toggleMode">
        <v-icon size="x-small">
          {{ modeIcon }}
        </v-icon>
      </v-btn>

      <v-btn variant="text" v-if="showHeartBeat" icon :loading="heartbeatLoading" @click="generateHeartBeatList">
        <v-icon size="x-small">
          {{ mdiHeartPulse }}
        </v-icon>
        <v-tooltip activator="parent" location="top" open-delay="100"> {{ t('common.heart_beat') }} </v-tooltip>
      </v-btn>
      <like-toggle :id="track?.id" />
      <v-btn v-if="!isProgram" icon variant="text" @click="openContextMenu">
        <v-icon size="small">{{ mdiDotsHorizontal }}</v-icon>
        <v-tooltip activator="parent" location="top" open-delay="100"> {{ t('common.add_playlist') }} </v-tooltip>
      </v-btn>
    </div> -->

    <!-- 音量条 -->
    <!-- <VolumeSlider orientation="horizontal" /> -->
  </div>
</template>
<script setup lang="ts">
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

const {
  prev,
  next,
  toggleShuffle,
  toggleMode,
  playMode,
  shuffle,
  modeIcon,
  shuffleIcon,
} = usePlayerControl();

import { mdiDotsHorizontal, mdiHeartPulse, mdiPlaylistMusic } from "@mdi/js";
import { useEventBus } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useContextMenu } from "vuetify-ctx-menu/lib/main";

import { getHeartBeatList } from "@/api/user";
import TrackSlider from "@/components/TrackSlider.vue";
import { useEmojiAnimation } from "@/hooks/useEmojiAnimation";
import useInForeground from "@/hooks/useInForeground";
import usePlayerControl from "@/hooks/usePlayerControl";
import { useCurrentTheme } from "@/hooks/useTheme";
import { useTrackOperation } from "@/hooks/useTrackOperation";
import { usePlayer } from "@/player/player";
import { useAppStore } from "@/store/app";
import { usePlayQueueStore } from "@/store/playQueue";
import { useUserStore } from "@/store/user";
import type { PlayNowEvent } from "@/types";
import { RESOURCE_TYPE } from "@/utils/enum";
import { sizeOfImage } from "@/utils/fn";
import { specialType } from "@/utils/metadata";
const playQueueStore = usePlayQueueStore();
const appStore = useAppStore();
const userStore = useUserStore();
const router = useRouter();
const player = usePlayer();
const toast = useToast();
const { t } = useI18n();

const contextMenu = useContextMenu();

const { themeName } = useCurrentTheme();

const heartbeatLoading = ref(false);

// store state
const { track, showPipLyric, isCurrentFm, isProgram } = usePlayerControl();
const coverUrl = computed(() =>
  sizeOfImage(track.value?.coverUrl ?? track.value?.al?.picUrl ?? "", 1024)
);

const showHeartBeat = computed(() => {
  return (
    userStore.logged &&
    !isProgram.value &&
    !isCurrentFm.value &&
    track.value &&
    userStore.likes.includes(track.value.id)
  );
});
// 播放并开启飞越小动画
const playlistBtn = ref<HTMLButtonElement>();
const { playAnimation } = useEmojiAnimation(playlistBtn);
const eventBus = useEventBus<PlayNowEvent>("playNow");
eventBus.on((payload) => {
  const { id, from, setQueue } = payload;
  player.updatePlayerTrack(id, true, true, false, from);
  playAnimation("🎉");
  if (setQueue) {
    playQueueStore.setQueue(id);
  }
});

// 跳转播放列表

const { isActive: isQueue } = useInForeground("queue");
function toQueue() {
  if (isQueue.value) {
    router.back();
  } else {
    router.push("/queue");
  }
}

// 桌面歌词
function togglePipLyric() {
  if (!showPipLyric.value) {
    player.pipLyric?.enter();
  } else {
    player.pipLyric?.leave();
  }
}
player.pipLyric!.onLeave = function () {
  console.log("on leave");
  showPipLyric.value = false;
};
player.pipLyric!.onEnter = function () {
  console.log("on enter");
  showPipLyric.value = true;
};

async function showPlayingPage() {
  appStore.showLyric = true;
}

function openContextMenu(event: MouseEvent) {
  if (track.value) {
    const { toPlaylistMenuItems } = useTrackOperation(track.value);
    const { x, y } = event;
    const option = {
      theme: themeName.value,
      x,
      y,
      items: toPlaylistMenuItems.value,
      offsetFooter: 48,
      customClass: "bg-surfaceVariant",
    };
    contextMenu(option);
  }
}

async function generateHeartBeatList() {
  heartbeatLoading.value = true;
  try {
    if (track.value?.id) {
      const id = track.value?.id;
      const list = await getHeartBeatList(id);
      if (list.length) {
        playQueueStore.updatePlayQueue(0, "intelligence", "心动智能列表", list);
        toast.success(t("message.heartbeat_success"));
      } else {
        toast.warning(t("common.no_more"));
      }
    }
  } catch (e) {
    toast.error(t("message.something_wrong"));
  } finally {
    heartbeatLoading.value = false;
  }
}
</script>
<style lang="scss" scoped>
#myCover {
  border-radius: 10px;
  width: 200px;
  height: 200px;
}
.my-buttons {
  background-color: #ffdad9;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 10px;
}
#track-slider {
  // background-color: #f5f7f6;
  border-radius: 5px;
  padding: 20px 10px;
  width: 90%;
  margin: 10px;
}

#head {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 10px;
  // background-color: #f5f7f6;
  border: 2px solid #e7ebda;

  border-radius: 10px;
  padding: 10px;
}
</style>
