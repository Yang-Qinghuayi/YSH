<template>
  <div class="reader-page">
    <div class="flex justify-center items-center w-full h-full">
      <!-- 桌面端目录按钮 -->
      <v-btn
        v-if="hasToc && lgAndUp"
        class="fixed top-5 right-5 z-[1000]"
        icon
        color="secondary"
        variant="tonal"
        @click="showBigCatalog = !showBigCatalog"
      >
        <v-icon color="secondary">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <!-- 移动端目录按钮（浮于内容上方，避开底部 Tab 栏） -->
      <v-btn
        v-if="hasToc && isMobile"
        class="fixed bottom-20 right-4 z-[1000]"
        icon
        color="secondary"
        variant="tonal"
        size="small"
        @click="showMobileTOC = !showMobileTOC"
      >
        <v-icon color="secondary" size="small">
          {{ mdiBookOpenVariantOutline }}
        </v-icon>
      </v-btn>

      <!-- 正文吃掉目录之外的全部宽度：min-w-0 不可省，否则阅读器内部尺寸会顶住收缩 -->
      <div ref="containerRef" class="relative w-full h-full grow min-w-0" @click="handlePageFlip">
        <div
          class="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-semibold leading-5 text-on-surface-variant"
        >
          {{ pageInfo }}
        </div>
      </div>

      <!-- 桌面端：侧边目录面板 -->
      <transition name="toc-fade">
        <TOCView
          v-if="bookDoc && hasToc && showBigCatalog && lgAndUp"
          :book-id
          :doc="bookDoc"
          class="mr-4 border-[3px] border-primary/20 rounded-[10px]"
        >
        </TOCView>
      </transition>
    </div>

    <!-- 移动端：底部抽屉目录 -->
    <v-bottom-sheet v-if="hasToc && isMobile" v-model="showMobileTOC" max-height="75vh">
      <v-sheet class="rounded-t-xl overflow-hidden">
        <div class="flex justify-center pt-2 pb-1">
          <div class="h-1 w-10 rounded-full bg-outline/40"></div>
        </div>
        <TOCView v-if="bookDoc" :book-id :doc="bookDoc" :in-sheet="true" class="pb-4" />
      </v-sheet>
    </v-bottom-sheet>

    <Menu v-model:show-menu="showMenu" />
  </div>
</template>

<script setup lang="ts">
import '@/foliate-js/view.js';

import { useMediaQuery } from '@vueuse/core';
import { useDisplay, useTheme } from 'vuetify';

import { transformContent } from '@/services/transformService';
import type { FoliateView } from '@/types/view';
import { wrappedFoliateView } from '@/types/view';
import {
  handleClick,
  handleKeydown,
  handleMousedown,
  handleMouseup,
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
  handleWheel,
} from '@/utils/iframeEventHandlers';
import { getStyles, mountAdditionalFonts, transformStylesheet } from '@/utils/style';
import { applyRendererSettings } from '@/utils/viewSettingsHelper';

import Menu from './components/Menu.vue';
import TOCView from './components/TOCView.vue';
const { lgAndUp } = useDisplay();
const theme = useTheme();
const isMobile = useMediaQuery('(max-width: 960px)');
const showMobileTOC = ref(false);
import { storeToRefs } from 'pinia';

import { initLibrary, libraryLoaded, useAppService } from '@/hooks/useEnv';
import { useClickEvent, useTouchEvent } from '@/hooks/useIframeEvents';
import { useSettingStore } from '@/store/setting';
const { showBigCatalog } = storeToRefs(useSettingStore()) as any;

import { useBookDataStore } from '@/store/bookDataStore';
const bookDataStore = useBookDataStore();
const { getConfig, getBookData } = bookDataStore;

import { useBookIdStore } from '@/store/bookIdStore';
const { bookId } = storeToRefs(useBookIdStore());

import { mdiBookOpenVariantOutline } from '@mdi/js';

import { useFoliateEvents } from '@/hooks/useFoliateEvents';
import { useProgressAutoSave } from '@/hooks/useProgressAutoSave';
import { useReaderStore } from '@/store/readerStore';
const readerStore = useReaderStore();
const { viewStates, getProgress, getViewState, initViewState, getViewSettings, closeMenu } =
  readerStore;
const { setView: setFoliateView, setProgress } = readerStore;
const { showMenu } = storeToRefs(readerStore);

import { useCopyParagraph } from '@/hooks/useCopyParagraph';
import { usePageFlip } from '@/hooks/usePageFlip';
import type { BookDoc } from '@/libs/document';
import { useSidebarStore } from '@/store/sidebarStore';
import type { AppService } from '@/types/system';

import useBookShortcuts from './hooks/useBookShortcuts';
const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
const containerRef = ref<HTMLDivElement | null>(null);
const viewRef = ref<FoliateView | null>(null);

const bookDoc = ref<BookDoc | null>();
const hasToc = computed(() => Boolean(bookDoc.value?.toc?.length));

// 切到无目录书籍时关闭移动抽屉；桌面端的 showBigCatalog 是用户偏好，不覆写。
watch(hasToc, (available) => {
  if (!available) showMobileTOC.value = false;
});

const appService = ref<AppService | null>(null);

const pageInfo = ref('');

// EPUB 文档在 iframe 内，应用主题变化时需要重新注入样式。
watch(
  () => [
    theme.current.value.dark,
    theme.current.value.colors.background,
    theme.current.value.colors['on-background'],
    theme.current.value.colors.primary,
  ],
  async () => {
    await nextTick();
    const settings = getViewSettings(bookId.value);
    if (settings && viewRef.value?.renderer)
      viewRef.value.renderer.setStyles?.(getStyles(settings));
  }
);

const { copyParagraph } = useCopyParagraph();
const { handlePageFlip } = usePageFlip(viewRef, containerRef, appService, copyParagraph);
useProgressAutoSave(bookId); // 传入 Ref<string> 而非快照，支持书籍切换后仍能正确保存
useBookShortcuts(bookId.value);
useTouchEvent(viewRef);
useClickEvent(handlePageFlip);

const progressRelocateHandler = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  setProgress(
    bookId.value,
    detail.cfi,
    detail.tocItem,
    detail.section,
    detail.location,
    detail.range
  );
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
  initBook();
});

// 离开书籍页时收起菜单：菜单状态存在 readerStore，若不清理，
// 下次进入书籍页会直接弹出，导致「再次点击『书籍』弹菜单」的交互错乱。
// 同时覆盖被 keep-alive 缓存（deactivated）与直接销毁（unmounted）两种情况。
onDeactivated(() => {
  closeMenu();
});
onUnmounted(() => {
  closeMenu();
});

useAppService().then((res) => {
  appService.value = res;
});

watch(viewStates, () => {
  const progress = getProgress(bookId.value);
  const { section, pageinfo, sectionLabel } = progress || {};
  const sectionInfo = section ? `${section.current + 1} / ${section.total}` : '';
  const pageInfoLoc = pageinfo ? ` ${pageinfo.next ?? pageinfo.current} / ${pageinfo.total}` : '';
  pageInfo.value = pageInfoLoc ? pageInfoLoc : sectionInfo;
});

onMounted(async () => {
  const view = wrappedFoliateView(document.createElement('foliate-view') as FoliateView);
  if (containerRef.value) containerRef.value.appendChild(view);
  viewRef.value = view;
  await initBook();
});

const initBook = async () => {
  const view = viewRef.value;
  if (!view) return;
  if (!bookId.value) return;

  await initLibrary();

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
  bookDoc.value = bookData?.bookDoc;

  view.close();
  if (bookDoc.value) await view.open(bookDoc.value);

  setFoliateView(bookId.value, view);
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
};
</script>

<style scoped>
.reader-page {
  flex: 1 1 0;
  min-height: 0;
  background: var(--color-background);
}

/* 独立的动画名避免继承全局 fade-enter-active 的 position:absolute。 */
.toc-fade-enter-active,
.toc-fade-leave-active {
  transition: opacity 0.3s ease;
}
.toc-fade-enter-from,
.toc-fade-leave-to {
  opacity: 0;
}
</style>
