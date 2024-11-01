<template>
  <div>
    <div class="text-lg line-clamp-1 text-center">
      {{ BSstore.metadata?.title }}
    </div>
    <div class="line-clamp-1 text-center">
      {{ BSstore.metadata?.creator }}
    </div>
    <DirectoryItem
      v-for="item in BSstore.navItems"
      :key="item.id"
      :item="item"
    ></DirectoryItem>
  </div>
</template>

<script setup>
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore();
</script>
