<template>
  <Slider
    class="mx-auto"
    :model-value="tabHeight"
    :min="15"
    :max="30"
    :color="currentTheme.colors.secondary"
    :height="32"
    :handle-scale="0"
    width="96%"
    rainbow
    trackColor="#e2e2e2"
    @drag-start="dragStart"
    @drag-end="dragEnd"
  ></Slider>
</template>

<script lang="ts" setup>
import { storeToRefs } from "pinia";

const {
  createBook,
  render,
  display,
  getRendition,
  setFontSize,
  next,
  prev,
  setFontFamily,
} = useEpub();

import Slider from "vue3-slider";
import { useTheme } from "vuetify";

import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore();
const { tabHeight } = storeToRefs(BSstore);

const vuetifyTheme = useTheme();
const currentTheme = computed(() => {
  return vuetifyTheme.current.value;
});

// 进度条拖拽
async function dragStart() {
  await nextTick();
}

const router = useRouter();

async function dragEnd(value: number) {
  console.log("dragEnd", value);
  await nextTick();
  tabHeight.value = value;
  router.go(0);
}
</script>
