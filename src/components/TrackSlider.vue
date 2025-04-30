<template>
  <Slider class="mx-auto" :model-value="fontSize" :min="15" :max="30" :color="currentTheme.colors.secondary" :height="32"
    :handle-scale="0" width="96%" rainbow trackColor="#e2e2e2" @drag-start="dragStart" @drag-end="dragEnd"></Slider>
</template>

<script lang="ts" setup>

import Slider from "vue3-slider";
import { useTheme } from "vuetify";
const fontSize = ref(20)



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
  await nextTick();
  router.go(0);
}
</script>
