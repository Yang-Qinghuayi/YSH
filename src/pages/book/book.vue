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
import { getStyles, mountAdditionalFonts, transformStylesheet } from '@/utils/style';
import { FoliateView, wrappedFoliateView } from '@/types/view';
import { transformContent } from '@/services/transformService';
import { getMaxInlineSize } from '@/utils/config';
import "@/foliate-js/view.js";
import { useDisplay } from "vuetify";
const { lgAndUp, } = useDisplay();
const { envConfig, appService } = useEnv();
import { useClickEvent, useTouchEvent } from '@/hooks/useIframeEvents';
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { showBigCatalog } = storeToRefs(useSettingStore()) as any

import { useBookDataStore } from '@/store/bookDataStore';
const { getConfig, getBookData } = useBookDataStore();
import { uniqueId } from '@/utils/misc';
import { useLibraryStore } from '@/store/libraryStore';
const { setLibrary } = useLibraryStore();
import { useSettingsStore } from '@/store/settingsStore';
const { settings, setSettings } = useSettingsStore();

import { useProgressAutoSave } from '@/hooks/useProgressAutoSave';
import { useBookSettingsStore } from "@/store/bookSettings";
const BSstore = useBookSettingsStore() as any

import { useBookStore } from "@/store/book";
import { mdiBookOpenVariantOutline } from "@mdi/js";
import { useFoliateEvents } from "@/hooks/useFoliateEvents";
const bookStore = useBookStore();

import { useReaderStore } from '@/store/readerStore';
const { getView, setBookKeys } = useReaderStore();
const { initViewState, clearViewState } = useReaderStore();
const { getProgress, getViewState, getViewSettings, hoveredBookKey } = useReaderStore();
const { setView: setFoliateView, setProgress } = useReaderStore();

import { useSidebarStore } from '@/store/sidebarStore';
const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
const containerRef = ref<HTMLDivElement | null>(null);
const viewRef = ref<FoliateView | null>(null);


const route = useRoute();
const bookIds = route.query.ids as string || ""
const initialIds = bookIds.split("+").filter(Boolean);
const initialBookKeys = initialIds.map((id) => `${id}-${uniqueId()}`);
const bookKey = initialBookKeys[0]

useProgressAutoSave(bookKey);
useTouchEvent(viewRef);
const { handleTurnPage } = useClickEvent(viewRef, containerRef);
const progressRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  setProgress(bookKey, detail.cfi, detail.tocItem, detail.section, detail.location, detail.range);
};

const docLoadHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  console.log('doc index loaded:', detail.index);
  if (detail.doc) {
    // const writingDir = viewRef.value?.renderer.setStyles && getDirection(detail.doc);
    mountAdditionalFonts(detail.doc);

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
    const viewSettings = getViewSettings(bookKey)!;
    if (renderer && viewSettings.continuousScroll) {
      if (renderer.start <= 0) {
        viewRef.value?.prev(1);
        // sometimes viewSize has subpixel value that the end never reaches
      } else if (renderer.end + 1 >= renderer.viewSize) {
        viewRef.value?.next(1);
      }
    }
  }
};

const docTransformHandler = (event: Event) => {
  const { detail } = event as CustomEvent;
  detail.data = Promise.resolve(detail.data)
    .then((data) => {
      const viewSettings = getViewSettings(bookKey);
      if (detail.type === 'text/css') return transformStylesheet(data);
      if (viewSettings && detail.type === 'application/xhtml+xml') {
        const ctx = {
          bookKey,
          viewSettings,
          content: data,
          transformers: ['punctuation'],
        };
        return Promise.resolve(transformContent(ctx));
      }
      return data;
    })
    .catch((e) => {
      console.error(new Error(`Failed to load ${detail.name}`, { cause: e }));
      return '';
    });
};
useFoliateEvents(viewRef, {
  onLoad: docLoadHandler,
  onRelocate: progressRelocateHandler,
  onRendererRelocate: docRelocateHandler,
});

const isInitiating = ref(false)
onMounted(async () => {

  if (isInitiating.value) return;
  isInitiating.value = true;
  const initLibrary = async () => {
    const appService = await envConfig.getAppService();
    const settings = await appService.loadSettings();
    setSettings(settings);
    setLibrary(await appService.loadLibraryBooks());
  };

  await initLibrary();


  setBookKeys(initialBookKeys);
  const uniqueIds = new Set<string>();
  console.log('Initialize books', initialBookKeys);
  const key = initialBookKeys[0]
  const id = key.split('-')[0]!;
  const isPrimary = !uniqueIds.has(id);
  uniqueIds.add(id);
  if (!getViewState(key)) {
    try {
      await initViewState(envConfig, id, key, isPrimary);
    } catch (error) {
      console.log('Error initializing book', key, error);
      throw error; // 重新抛出错误以阻止后续代码执行
    }
    setSideBarBookKey(key);
  }

  const bookData = getBookData(bookKey);
  const config = getConfig(bookKey);
  const progress = getProgress(bookKey);
  const viewSettings = getViewSettings(bookKey);
  const { bookDoc } = bookData || {};

  const view = wrappedFoliateView(document.createElement('foliate-view') as FoliateView);
  containerRef.value && containerRef.value.appendChild(view);

  bookDoc && await view.open(bookDoc);
  viewRef.value = view

  setFoliateView(bookKey, view);

  const { book } = view;

  book.transformTarget?.addEventListener('data', docTransformHandler);
  viewSettings && view.renderer.setStyles?.(getStyles(viewSettings));

  const isScrolled = viewSettings?.scrolled!;
  const marginPx = viewSettings?.marginPx!;
  const gapPercent = viewSettings?.gapPercent!;
  const animated = viewSettings?.animated!;
  const maxColumnCount = viewSettings?.maxColumnCount!;
  const maxInlineSize = getMaxInlineSize(viewSettings!);
  const maxBlockSize = viewSettings?.maxBlockSize!;
  if (animated) {
    view.renderer?.setAttribute('animated', '');
  } else {
    view.renderer?.removeAttribute('animated');
  }
  view.renderer.setAttribute('flow', isScrolled ? 'scrolled' : 'paginated');
  view.renderer.setAttribute('margin', `${marginPx}px`);
  view.renderer.setAttribute('gap', `${gapPercent}%`);
  view.renderer.setAttribute('max-column-count', maxColumnCount);
  view.renderer.setAttribute('max-inline-size', `${maxInlineSize}px`);
  view.renderer.setAttribute('max-block-size', `${maxBlockSize}px`);

  const lastLocation = config?.location;
  if (lastLocation) {
    view.init({ lastLocation });
  } else {
    view.goToFraction(0);
  }
});
</script>

<style>
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 6px;
}
</style>
