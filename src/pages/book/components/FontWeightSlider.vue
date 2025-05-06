<template>
  <Slider class="mx-auto" v-model="fontWeight" :min="200" :max="600" :color="currentTheme.colors.primary" :height="32"
    :handle-scale="0" width="96%" rainbow trackColor="#e2e2e2" @drag-start="dragStart" @drag-end="">
  </Slider>
</template>

<script lang="ts" setup>

import Slider from "vue3-slider";
import { useTheme } from "vuetify";
import { saveViewSettings } from '@/utils/viewSettingsHelper';
import { useBookIdStore } from '@/store/bookIdStore';
import { storeToRefs } from "pinia";
const { bookId } = storeToRefs(useBookIdStore())
import { useReaderStore } from '@/store/readerStore';
import { DEFAULT_BOOK_FONT } from "@/services/constants";
const readerStore = useReaderStore()
const { getProgress, getViewState, initViewState, getViewSettings, hoveredBookKey, switchShowMenu } = readerStore
const viewSettings = getViewSettings(bookId.value);
const fontWeight = ref(DEFAULT_BOOK_FONT.fontWeight);

const init = async () => {
  await initLibrary()
  fontWeight.value = viewSettings?.fontWeight ?? DEFAULT_BOOK_FONT.fontWeight;
}
init()

watch(fontWeight, async () => {
  await saveViewSettings(bookId.value, 'fontWeight', fontWeight.value);
})

const vuetifyTheme = useTheme();
const currentTheme = computed(() => {
  return vuetifyTheme.current.value;
});

// 进度条拖拽
async function dragStart() {
  await nextTick();
}

</script>
