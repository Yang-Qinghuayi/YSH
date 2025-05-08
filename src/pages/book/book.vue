<template>
  <div>
    <div :class="[lgAndUp ? 'mt-[4vh] h-[90vh]' : 'h-[94vh]']" class="flex justify-center items-center w-full">
      <v-btn v-if="lgAndUp" class="fixed right-5 top-5" icon color="secondary" variant="tonal"
        @click="showBigCatalog = !showBigCatalog">
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <div @click="handlePageFlip" class="relative w-full h-full" ref="containerRef">
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 font-semibold text-sm text-gray-500">{{ pageInfo }}</div>
      </div>

      <!-- 目录部分 -->
      <transition name="fade" enter-active-class="transition ease-out duration-300"
        leave-active-class="transition ease-in duration-300">
        <TOCView v-if="bookDoc && showBigCatalog && lgAndUp" :bookId :doc="bookDoc" class="theme-border">
        </TOCView>
      </transition>

    </div>

    <Menu v-model:showMenu="showMenu" />
  </div>
</template>

<script setup lang="ts">
import Menu from "./components/Menu.vue";
import TOCView from "./components/TOCView.vue"
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
const { lgAndUp, smAndUp } = useDisplay();
import { useAppService, initLibrary, libraryLoaded } from "@/hooks/useEnv";
import { useClickEvent, useTouchEvent } from '@/hooks/useIframeEvents';
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";
const { showBigCatalog } = storeToRefs(useSettingStore()) as any

import { useBookDataStore } from '@/store/bookDataStore';
const bookDataStore = useBookDataStore()
const { getConfig, getBookData } = bookDataStore;

import { useBookIdStore } from '@/store/bookIdStore';
const { bookId } = storeToRefs(useBookIdStore())

import { useProgressAutoSave } from '@/hooks/useProgressAutoSave';

import { mdiBookOpenVariantOutline } from "@mdi/js";
import { useFoliateEvents } from "@/hooks/useFoliateEvents";

import { useReaderStore } from '@/store/readerStore';
const readerStore = useReaderStore()
const { viewStates, getProgress, getViewState, initViewState, getViewSettings, hoveredBookKey, switchShowMenu } = readerStore
const { setView: setFoliateView, setProgress } = readerStore;
const { showMenu } = storeToRefs(readerStore);

import { useSidebarStore } from '@/store/sidebarStore';
import { BookDoc } from "@/libs/document";
import { AppService } from "@/types/system";
import { usePageFlip } from "@/hooks/usePageFlip";
import useBookShortcuts from "./hooks/useBookShortcuts";
const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
const containerRef = ref<HTMLDivElement | null>(null);
const viewRef = ref<FoliateView | null>(null);

const bookDoc = ref<BookDoc | null>()

const appService = ref<AppService | null>(null)

const pageInfo = ref("")

const { handlePageFlip } = usePageFlip(viewRef, containerRef, appService);
useProgressAutoSave(bookId.value);
useBookShortcuts(bookId.value)
useTouchEvent(viewRef);
useClickEvent(handlePageFlip);

const progressRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  setProgress(bookId.value, detail.cfi, detail.tocItem, detail.section, detail.location, detail.range);
};

const docLoadHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  console.log('doc index loaded:', detail.index);
  if (detail.doc) {
    // const writingDir = viewRef.value?.renderer.setStyles && getDirection(detail.doc);
    mountAdditionalFonts(detail.doc);

    if (!detail.doc.isEventListenersAdded) {
      detail.doc.isEventListenersAdded = true;
      detail.doc.addEventListener('keydown', handleKeydown.bind(null, bookId.value));
      detail.doc.addEventListener('mousedown', handleMousedown.bind(null, bookId.value));
      detail.doc.addEventListener('mouseup', handleMouseup.bind(null, bookId.value));
      detail.doc.addEventListener('click', handleClick.bind(null, bookId.value));
      detail.doc.addEventListener('wheel', handleWheel.bind(null, bookId.value));
      detail.doc.addEventListener('touchstart', handleTouchStart.bind(null, bookId.value));
      detail.doc.addEventListener('touchmove', handleTouchMove.bind(null, bookId.value));
      detail.doc.addEventListener('touchend', handleTouchEnd.bind(null, bookId.value));
    }
  }
};

const docRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail.reason !== 'scroll' && detail.reason !== 'page') return;

  if (detail.reason === 'scroll') {
    const renderer = viewRef.value?.renderer;
    const viewSettings = getViewSettings(bookId.value)!;
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
      const viewSettings = getViewSettings(bookId.value);
      if (detail.type === 'text/css') return transformStylesheet(data);
      if (viewSettings && detail.type === 'application/xhtml+xml') {
        const ctx = {
          bookKey: bookId.value,
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

onActivated(() => {
  initBook()
})

useAppService().then(res => {
  appService.value = res
})


watch(viewStates, () => {
  const progress = getProgress(bookId.value);
  const { section, pageinfo, sectionLabel } = progress || {};
  const sectionInfo = section ? `${section.current + 1} / ${section.total}` : '';
  const pageInfoLoc = pageinfo ? ` ${pageinfo.next ?? pageinfo.current} / ${pageinfo.total}` : '';
  pageInfo.value = pageInfoLoc ? pageInfoLoc : sectionInfo;
})


onMounted(() => {
  const view = wrappedFoliateView(document.createElement('foliate-view') as FoliateView);
  containerRef.value && containerRef.value.appendChild(view);
  viewRef.value = view
})


const initBook = async () => {
  const view = viewRef.value;
  if (!view) return;
  if (!bookId.value) return;

  await initLibrary()

  if (!getViewState(bookId.value)) {
    try {
      await initViewState(bookId.value, true);
    } catch (error) {
      console.log('Error initializing book', bookId.value, error);
      throw error; // 重新抛出错误以阻止后续代码执行
    }
    setSideBarBookKey(bookId.value);
  }

  const bookData = getBookData(bookId.value);
  const config = getConfig(bookId.value);
  const viewSettings = getViewSettings(bookId.value);
  bookDoc.value = bookData?.bookDoc

  view.close()
  bookDoc.value && await view.open(bookDoc.value);

  setFoliateView(bookId.value, view)
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
    view.renderer.setAttribute('animated', '');
  } else {
    view.renderer.removeAttribute('animated');
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
}
</script>

<style >
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 10px;
}
</style>
