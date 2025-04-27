<template>
  <div>
    <div :class="[lgAndUp ? 'mt-[4vh] h-[90vh]' : 'h-[94vh]']" class="flex justify-center items-center w-full">
      <v-btn v-if="lgAndUp" class="fixed right-5 top-5" icon color="secondary" variant="tonal"
        @click="showBigCatalog = !showBigCatalog">
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <div @click="handleTurnPage" class="w-full h-full" ref="containerRef"></div>

      <!-- 目录部分 -->
      <transition name="fade" enter-active-class="transition ease-out duration-300"
        leave-active-class="transition ease-in duration-300">
        <Directory class="w-[16vw] h-[70vh] mx-[2vw] px-2 py-4 overflow-auto theme-border"
          v-if="lgAndUp && showBigCatalog" />
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  handleKeydown,
  handleMousedown,
  handleMouseup,
  handleClick,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} from '@/utils/iframeEventHandlers';
import "@/foliate-js/view.js";
import { FoliateView } from "@/types/view"
import { useDisplay } from "vuetify";
const { lgAndUp, } = useDisplay();

import { useClickEvent, useTouchEvent } from '@/hooks/useIframeEvents';
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { showBigCatalog } = storeToRefs(useSettingStore()) as any

import localforage from "localforage";
localforage.config({
  name: "epubBooks",
});
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore() as any

import { useBookStore } from "@/store/book";
import { mdiBookOpenVariantOutline } from "@mdi/js";
import { useFoliateEvents } from "@/hooks/useFoliateEvents";
const bookStore = useBookStore();

const containerRef = ref<HTMLDivElement | null>(null);
const viewRef = ref<FoliateView | null>(null);

useTouchEvent(viewRef);
const { handleTurnPage } = useClickEvent(viewRef, containerRef);
const progressRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  // setProgress(bookKey, detail.cfi, detail.tocItem, detail.section, detail.location, detail.range);
};

const docLoadHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  console.log('doc index loaded:', detail.index);
  if (detail.doc) {
    // const writingDir = viewRef.value?.renderer.setStyles && getDirection(detail.doc);
    // mountAdditionalFonts(detail.doc);

    const bookKey = "kiss"
    if (!detail.doc.isEventListenersAdded) {
      detail.doc.isEventListenersAdded = true;
      detail.doc.addEventListener('keydown', handleKeydown.bind(null, bookKey));
      detail.doc.addEventListener('mousedown', handleMousedown.bind(null, bookKey));
      detail.doc.addEventListener('mouseup', handleMouseup.bind(null, bookKey));
      detail.doc.addEventListener('click', handleClick.bind(null, bookKey));
      detail.doc.addEventListener('wheel', handleWheel.bind(null, bookKey));
      detail.doc.addEventListener('touchstart', handleTouchStart.bind(null, bookKey));
      detail.doc.addEventListener('touchmove', handleTouchMove.bind(null, bookKey));
      detail.doc.addEventListener('touchend', handleTouchEnd.bind(null, bookKey));
    }
  }
};

const docRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail.reason !== 'scroll' && detail.reason !== 'page') return;

  if (detail.reason === 'scroll') {
    const renderer = viewRef.value?.renderer;
    // const viewSettings = getViewSettings(bookKey)!;
    // if (renderer && viewSettings.continuousScroll) {
    //   if (renderer.start <= 0) {
    //     viewRef.current?.prev(1);
    //     // sometimes viewSize has subpixel value that the end never reaches
    //   } else if (renderer.end + 1 >= renderer.viewSize) {
    //     viewRef.current?.next(1);
    //   }
    // }
  }
};

useFoliateEvents(viewRef, {
  onLoad: docLoadHandler,
  onRelocate: progressRelocateHandler,
  onRendererRelocate: docRelocateHandler,
});

onMounted(async () => {
  const view = document.createElement("foliate-view") as FoliateView
  containerRef.value && containerRef.value.appendChild(view);

  let blob: Blob | null = null
  if (!bookStore.book) {
    const bookInForage = await localforage.getItem(
      BSstore.metadata.title.replace(/\(.*?\) |（.*?）/g, "")
    ) as any
    if (bookInForage) {
      blob = new Blob([bookInForage.book]);
    }
  } else {
    blob = new Blob(bookStore.book)
  }
  blob && await view.open(blob); // 可以替换为 File 对象或实际路径
  viewRef.value = view

  view.goToFraction(0)
});
</script>

<style>
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 6px;
}
</style>
