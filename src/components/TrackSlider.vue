<template>
  <Slider
    class="mx-auto"
    :model-value="currentTime"
    :min="0"
    :max="trackDt / 1000"
    :color="currentTheme.colors.secondary"
    :height="32"
    :handle-scale="0"
    :tooltip="tooltip"
    width="96%"
    rainbow
    trackColor="#e2e2e2"
    :format-tooltip="(v: number) => formatDuring(v * 1000)"
    @drag-start="dragStart"
    @drag-end="dragEnd"
  ></Slider>
</template>

<script lang="ts" setup>
import { storeToRefs } from "pinia";
import Slider from "vue3-slider";
import { useTheme } from "vuetify";

import { usePlayer } from "@/player/player";
import { usePlayerStore } from "@/store/player";
import { formatDuring } from "@/util/fn";

const props = defineProps<{
  tooltip?: boolean;
  dark?: boolean;
}>();

const player = usePlayer();
const playerStore = usePlayerStore();
const { currentTime, track } = storeToRefs(playerStore);

const trackDt = computed(() => track.value?.dt ?? 0);
const vuetifyTheme = useTheme();
const currentTheme = computed(() => {
  return vuetifyTheme.current.value;
});

// 进度条拖拽
async function dragStart() {
  await nextTick();
  player.pauseProgress();
}

async function dragEnd(value: number) {
  player.setSeek(value);
  // 恢复
  await nextTick();
  player.restoreProgress();
  // state.displayTime = playerTime
}
</script>
