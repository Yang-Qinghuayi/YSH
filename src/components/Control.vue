<template>
  <div class="d-flex justify-center align-center control-buttons no-drag-area">
    <v-btn icon :disabled="isCurrentFm" variant="text" @click="prev">
      <v-img :src="midPre" width="60" height="34"> </v-img>
    </v-btn>
    <v-btn :loading="loadingTrack" icon variant="text" @click="toggle">
      <v-img width="40" height="34" :src="playIcon"> </v-img>
    </v-btn>
    <v-btn icon variant="text" @click="next">
      <v-img :src="mdiNext" width="40" height="34"> </v-img>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import usePlayerControl from "@/hooks/usePlayerControl";
import { PLAY_MODE } from "@/store/player";
const { prev, next, playMode, playing, isCurrentFm, toggle, loadingTrack } =
  usePlayerControl();

import { midPre, mdiNext, mdiPlay, mdiPause } from "@/util/icons";

const playIcon = ref(mdiPlay);

onMounted(() => {
  if (playing.value) {
    playIcon.value = mdiPause;
  } else {
    playIcon.value = mdiPlay;
  }
});

watch(playing, (val) => {
  if (val) {
    playIcon.value = mdiPause;
  } else {
    playIcon.value = mdiPlay;
  }
});

defineProps({
  simple: {
    type: Boolean,
    default: false,
  },
});

const repeatOn = computed(() => {
  return [PLAY_MODE.REPEAT, PLAY_MODE.REPEAT_ONCE].includes(playMode.value);
});
</script>
