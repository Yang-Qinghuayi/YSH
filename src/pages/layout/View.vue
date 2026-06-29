<template>
  <v-main ref="mainRef" class="overflow-y-auto" style="height: calc(100vh - 16px)">
    <v-container class="px-4 py-4 drag-area" style="height: 100%" fluid>
      <router-view v-slot="{ Component }">
        <transition name="route-animation" mode="out-in">
          <keep-alive exclude="book">
            <component :is="Component" class="no-drag-area" />
          </keep-alive>
        </transition>
      </router-view>
    </v-container>
  </v-main>
</template>

<script setup lang="ts">
import { useLenis } from '@/hooks/useLenis';

const mainRef = ref<{ $el: HTMLElement } | null>(null);
const mainEl = ref<HTMLElement | null>(null);

onMounted(() => {
  mainEl.value = mainRef.value?.$el ?? null;
});

const { pause, resume } = useLenis(mainEl);

// 阅读页有自己的滚动逻辑，Lenis 会干扰 → 进入时暂停，离开时恢复
const route = useRoute();
watch(() => route.path, (path) => {
  path === '/book' ? pause() : resume();
}, { immediate: true });
</script>
