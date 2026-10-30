<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
  <ToastHost />
</template>
<script setup lang="ts">
import ToastHost from '@/components/ToastHost.vue';
</script>
