<template>
  <div>
    <div :class="[lgAndUp ? 'mt-[4vh] h-[90vh]' : 'h-[94vh]']" class="flex justify-center items-center w-full">
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
      <v-sheet class="rounded-t-2xl overflow-hidden h-full">
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

// 防止在 85~100% 区间内重复触发加载，章节切换后自动重置
const chapterLoadingGuard = ref(false);

const docRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  // 章节切换（page/anchor）时重置 guard
  if (detail.reason !== 'scroll') {
    if (detail.reason === 'page' || detail.reason === 'anchor') {
      chapterLoadingGuard.value = false;
    }
    return;
  }

  const viewSettings = getViewSettings(bookId.value)!;
  if (!viewSettings.continuousScroll) return;

  const renderer = viewRef.value?.renderer;
  if (!renderer) return;

  // detail.fraction = start / viewSize，最大值是 (viewSize-size)/viewSize（非 1.0）
  // 需用「在可滚动范围内的进度」才能得到真正的 0-1 标准化值
  const scrollableRange = renderer.viewSize - renderer.size;
  if (scrollableRange <= 0) return; // 内容比视口短，无需滚动

  const scrollProgress = renderer.start / scrollableRange; // 真正的 0-1 进度

  if (scrollProgress <= 0.05) {
    // 接近顶部：加载上一章，同时重置 guard
    chapterLoadingGuard.value = false;
    viewRef.value?.prev(1);
  } else if (scrollProgress >= 0.85 && !chapterLoadingGuard.value) {
    // 滑到 85% 时提前触发，guard 防止重复调用
    chapterLoadingGuard.value = true;
    viewRef.value?.next(1);
  } else if (scrollProgress < 0.6) {
    // 用户往回滚超过 40%，允许重新触发
    chapterLoadingGuard.value = false;
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

// 实时 scroll 监听：比防抖 250ms 的 relocate 更早触发
// paginator 在每次原生 scroll 时都会 dispatch 一个无细节的 'scroll' event
const prevGuard = ref(false);
const checkScrollProgress = () => {
  const viewSettings = getViewSettings(bookId.value);
  if (!viewSettings?.continuousScroll) return;

  const renderer = viewRef.value?.renderer;
  if (!renderer) return;

  const scrollableRange = renderer.viewSize - renderer.size;
  if (scrollableRange <= 0) return;

  const scrollProgress = renderer.start / scrollableRange;

  // 滑到 85% 时提前加载下一章
  if (scrollProgress >= 0.85 && !chapterLoadingGuard.value) {
    chapterLoadingGuard.value = true;
    viewRef.value?.next(1);
  }
  // 滑回 5% 以内时加载上一章
  else if (scrollProgress <= 0.05 && !prevGuard.value) {
    prevGuard.value = true;
    viewRef.value?.prev(1);
  }
  // 重置 guard
  else if (scrollProgress > 0.1) {
    prevGuard.value = false;
  }
  if (scrollProgress < 0.6) {
    chapterLoadingGuard.value = false;
  }
};

// 当 viewRef 就绪时注册 renderer 的实时 scroll 事件
watch(viewRef, (newView, oldView) => {
  oldView?.renderer.removeEventListener('scroll', checkScrollProgress);
  newView?.renderer.addEventListener('scroll', checkScrollProgress);
}, { immediate: true });

onUnmounted(() => {
  viewRef.value?.renderer.removeEventListener('scroll', checkScrollProgress);
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
