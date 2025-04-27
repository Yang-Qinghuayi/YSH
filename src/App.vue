<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
<script setup lang="ts">
import { useAppStore } from "@/store/app";
import { provideEnv } from "@/hooks/useEnv";

provideEnv();

const appStore = useAppStore();
appStore.init();
</script>
