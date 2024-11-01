<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
<script setup lang="ts">
import { useAppStore } from '@/store/app'


const appStore = useAppStore()
appStore.init()
</script>
