<template>
  <div>
    <div :class="[lgAndUp ? 'h-[94vh]' : 'h-[94vh]']" class="flex justify-center items-center w-full">
      <!-- 桌面端目录按钮 -->
      <v-btn v-if="lgAndUp" class="fixed right-5 top-5" icon color="secondary" variant="tonal"
        @click="showBigCatalog = !showBigCatalog">
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <!-- 移动端目录按钮（浮于内容上方，避开底部 Tab 栏） -->
      <v-btn v-if="isMobile" class="fixed right-4 bottom-20" icon color="secondary" variant="tonal" size="small"
        @click="showMobileTOC = !showMobileTOC">
        <v-icon color="secondary" size="small">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <div @click="handlePageFlip" class="relative w-full h-full" ref="containerRef">
        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 font-semibold text-sm text-gray-500">{{ pageInfo }}</div>
      </div>

      <!-- 桌面端：侧边目录面板 -->
      <transition name="fade" enter-active-class="transition ease-out duration-300"
        leave-active-class="transition ease-in duration-300">
        <TOCView v-if="bookDoc && showBigCatalog && lgAndUp" :bookId :doc="bookDoc" class="theme-border">
        </TOCView>
      </transition>

    </div>

    <!-- 移动端：底部抽屉目录 -->
    <v-bottom-sheet v-if="isMobile" v-model="showMobileTOC" max-height="75vh">
      <v-sheet class="rounded-t-2xl overflow-hidden">
        <div class="flex justify-center pt-2 pb-1">
          <div class="w-10 h-1 rounded-full bg-outline/40"></div>
        </div>
        <TOCView v-if="bookDoc" :bookId :doc="bookDoc" :inSheet="true" class="pb-4" />
      </v-sheet>
    </v-bottom-sheet>

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
import { mountAdditionalFonts, transformStylesheet } from '@/utils/style';
import { applyRendererSettings } from '@/utils/viewSettingsHelper';
import { FoliateView, wrappedFoliateView } from '@/types/view';
import { transformContent } from '@/services/transformService';
import "@/foliate-js/view.js";
import { useDisplay } from "vuetify";
import { useMediaQuery } from "@vueuse/core";
const { lgAndUp, smAndUp } = useDisplay();
const isMobile = useMediaQuery("(max-width: 960px)");
const showMobileTOC = ref(false);
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
import { useTTSStore } from '@/store/ttsStore';
const ttsStore = useTTSStore();
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
useProgressAutoSave(bookId); // 传入 Ref<string> 而非快照，支持书籍切换后仍能正确保存
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

// 连续滚动已由新版 paginator 内置（多视图 + #loadAdjacentSection 预加载相邻章节），
// 外层不再监听 scroll 触发跳章。relocate 仅用于更新进度，由 progressRelocateHandler 处理。

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


onMounted(async () => {
  const view = wrappedFoliateView(document.createElement('foliate-view') as FoliateView);
  containerRef.value && containerRef.value.appendChild(view);
  viewRef.value = view
  await initBook()
})

onUnmounted(() => {
  // 释放 TTS Controller，停止朗读并清理高亮。
  ttsStore.dispose(bookId.value);
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

  book?.transformTarget?.addEventListener('data', docTransformHandler);
  // 一次性应用所有渲染器属性（布局 + 样式）
  if (viewSettings) applyRendererSettings(view, viewSettings);

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
