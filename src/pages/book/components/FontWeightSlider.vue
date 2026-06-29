<template>
  <Slider class="mx-auto" v-model="fontWeight" :min="200" :max="600" :color="currentTheme.colors.primary" :height="32"
    :handle-scale="0" width="96%" rainbow trackColor="#e2e2e2" @drag-start="dragStart" @drag-end="">
  </Slider>
</template>

<script lang="ts" setup>

import Slider from "vue3-slider";
import { useTheme } from "vuetify";
import { useViewSettings } from '@/hooks/useViewSettings';
import { DEFAULT_BOOK_FONT } from "@/services/constants";

const { viewSettings, updateSetting } = useViewSettings();
const fontWeight = ref(DEFAULT_BOOK_FONT.fontWeight);

// 当 viewSettings 就绪（或被外部更新）时同步到本地 ref
watchEffect(() => {
  if (viewSettings.value) {
    fontWeight.value = viewSettings.value.fontWeight ?? DEFAULT_BOOK_FONT.fontWeight;
  }
});

watch(fontWeight, async () => {
  await updateSetting('fontWeight', fontWeight.value);
});

const vuetifyTheme = useTheme();
const currentTheme = computed(() => {
  return vuetifyTheme.current.value;
});

// 进度条拖拽
async function dragStart() {
  await nextTick();
}

</script>
