<template>
  <v-navigation-drawer :rail="rail" rail-width="102" width="212" color="background">
    <!-- macOS overlay 模式下的拖拽区域（红绿灯右侧空白） -->
    <div class="drag-region" data-tauri-drag-region />
    <div class="px-3 mt-2" :class="{ 'mb-1': rail }">
      <v-btn icon class="no-drag-area" variant="text" @click="rail = !rail">
        <v-icon size="small" :icon="rail ? mdiMenu : mdiMenuOpen" />
      </v-btn>
    </div>
    <div class="content-warp flex-fill mt-4">
      <div class="list-content d-flex flex-column justify-center">
        <v-list rounded :nav="true">
          <v-list-item
            v-for="item in nav"
            :key="item.val"
            class="drawer-item rounded-pill no-drag-area"
            :to="item.to"
            active-class="text-primary"
            :style="{ minHeight: '56px' }"
            @click="onNavItemClick(item)"
          >
            <template #prepend>
              <div
                class="d-flex justify-center align-center"
                :style="{ width: '40px', height: '40px' }"
              >
                <v-icon size="small" :icon="item.icon" color="primary"></v-icon>
              </div>
            </template>
            <v-list-item-title class="font-weight-bold">
              {{ item.title }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
      <!-- here is font setter -->
      <!-- <TrackSlider v-if="!rail" /> -->
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { mdiMenu, mdiMenuOpen } from '@mdi/js';
import { storeToRefs } from 'pinia';

import { useNavItems } from '@/hooks/useNavItems';
import { useSettingStore } from '@/store/setting';

const { rail } = storeToRefs(useSettingStore()) as any;
const { nav, onNavItemClick } = useNavItems();
</script>

<style scoped>
/* macOS overlay 标题栏拖拽区域：高度与红绿灯对齐（约 28px） */
.drag-region {
  height: 28px;
  width: 100%;
  flex-shrink: 0;
}
</style>
