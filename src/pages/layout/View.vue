<template>
  <v-main class="overflow-y-auto" :class="{ 'reader-main': isBook }">
    <v-container
      class="pl-0 pb-4 pt-0"
      :class="{ 'viewport-container': isBook || isNovel, 'reader-container': isBook }"
      style="height: 100%"
      fluid
    >
      <!-- 全宽拖拽区域：替代 pt-4 padding，高度与 macOS 标题栏对齐（28px）。
           空元素确保点击时 target 就是本身，可靠触发窗口拖拽，
           同时不遮挡下方任何交互内容。 -->
      <div data-tauri-drag-region class="view-drag-region" />
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
const route = useRoute();
const isBook = computed(() => route.name === 'book');
const isNovel = computed(() => route.name === 'novel');
</script>

<style scoped>
.v-main {
  height: 100dvh;
}

.reader-main {
  overflow: hidden !important;
}

.viewport-container {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.reader-container {
  padding-right: 0;
  padding-bottom: 0 !important;
}

.view-drag-region {
  height: 28px;
  width: 100%;
  flex-shrink: 0;
}
</style>
