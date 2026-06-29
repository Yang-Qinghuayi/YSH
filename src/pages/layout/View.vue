<template>
  <v-main ref="mainRef" class="overflow-y-auto" style="height: calc(100vh - 16px)">
    <v-container class="px-4 py-4 drag-area" fluid>
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

// Vuetify 的 v-main ref 是组件实例，通过 $el 拿底层 <main> DOM
const mainRef = ref<{ $el: HTMLElement } | null>(null);
const mainEl = ref<HTMLElement | null>(null);

onMounted(() => {
  mainEl.value = mainRef.value?.$el ?? null;
});

useLenis(mainEl);
</script>
