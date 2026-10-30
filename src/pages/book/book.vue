<template>
  <div>
    <div class="book-viewport d-flex justify-center align-center w-100">
      <!-- 桌面端目录按钮 -->
      <v-btn
        v-if="lgAndUp"
        class="toc-toggle toc-toggle--desktop"
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
        v-if="isMobile"
        class="toc-toggle toc-toggle--mobile"
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

      <div
        ref="containerRef"
        class="book-content position-relative w-100 h-100"
        @click="handlePageFlip"
      >
        <div class="page-info">{{ pageInfo }}</div>
      </div>

      <!-- 桌面端：侧边目录面板 -->
      <transition
        name="fade"
        enter-active-class="fade-enter-active"
        leave-active-class="fade-leave-active"
      >
        <TOCView
          v-if="bookDoc && showBigCatalog && lgAndUp"
          :book-id
          :doc="bookDoc"
          class="theme-border"
        >
        </TOCView>
      </transition>
    </div>

    <!-- 移动端：底部抽屉目录 -->
    <v-bottom-sheet v-if="isMobile" v-model="showMobileTOC" max-height="75vh">
      <v-sheet class="rounded-t-xl overflow-hidden">
        <div class="d-flex justify-center pt-2 pb-1">
          <div class="sheet-grabber"></div>
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
import { useDisplay } from 'vuetify';

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
import { mountAdditionalFonts, transformStylesheet } from '@/utils/style';
import { applyRendererSettings } from '@/utils/viewSettingsHelper';

import Menu from './components/Menu.vue';
import TOCView from './components/TOCView.vue';
const { lgAndUp, smAndUp } = useDisplay();
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

const appService = ref<AppService | null>(null);

const pageInfo = ref('');

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

<style>
.theme-border {
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 10px;
}

/* 目录悬浮按钮定位修复：
   Tailwind v4 把 .fixed 放进 @layer utilities，而 Vuetify 4 的样式层
   （@layer vuetify-components，声明在后）里存在 .v-btn { position: relative }，
   按 CSS 级联层规则「后声明的层赢得同优先级冲突」，.fixed 会被压制。
   这里改用未分层的更高优先级规则恢复 fixed 定位（right/top 等
   偏移量与 Vuetify 无冲突，仍由 Tailwind 的 right-5/top-5 等类提供）。 */
.v-btn.toc-toggle {
  position: fixed;
  z-index: 1000;
}

.book-viewport {
  height: 94vh;
}

/* 正文区吃掉目录之外的全部宽度。
   min-width: 0 是必须的：flex item 的自动最小尺寸默认是 min-content，
   阅读器内部的渲染尺寸会顶住这里，导致目录挤不进来 / 正文被无限压缩。
   目录面板自身是固定宽度（见 TOCView.vue 的 --toc-panel-width）。 */
.book-content {
  flex: 1 1 auto;
  min-width: 0;
}

/* 悬浮目录按钮定位：
   Tailwind 已移除，这里用未分层规则，避免被 Vuetify 的 .v-btn 组件层覆盖。 */
.toc-toggle--desktop {
  top: 20px;
  right: 20px;
}

.toc-toggle--mobile {
  bottom: 80px;
  right: 16px;
}

/* 右下角页码 */
.page-info {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 600;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* 底部抽屉的拖拽指示条 */
.sheet-grabber {
  width: 40px;
  height: 4px;
  border-radius: 9999px;
  background: rgb(var(--v-theme-outline) / 40%);
}

/* 目录面板淡入淡出 */
.fade-enter-active {
  transition: opacity 0.3s ease-out;
}

.fade-leave-active {
  transition: opacity 0.3s ease-in;
}
</style>
