<template>
  <div
    ref="viewRef"
    role="tree"
    :class="['toc-panel pa-3', inSheet ? 'toc-panel--sheet' : 'toc-panel--side']"
    :style="inSheet ? { maxHeight: 'calc(75dvh - 40px)' } : { height: '80vh' }"
  >
    <div class="toc-panel__title text-truncate ma-3 mb-0 text-center">
      {{ doc.metadata.title }}
    </div>
    <div class="text-truncate text-center ma-2">
      {{ authorName }}
    </div>
    <TOCItemView
      v-for="(item, index) in doc?.toc"
      :key="`${index}-${item.href}`"
      :book-id="bookId"
      :item="item"
      :depth="0"
      :expanded-items="expandedItems"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import type { BookDoc, TOCItem } from '@/libs/document';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import type { BookProgress } from '@/types/book';
import { getContentMd5 } from '@/utils/misc';
import { findParentPath } from '@/utils/toc';

import TOCItemView from './TOCItemView.vue';

const {
  bookId,
  doc,
  inSheet = false,
} = defineProps<{
  bookId: string;
  doc: BookDoc;
  inSheet?: boolean;
}>();

const viewRef = ref<HTMLElement | null>(null);
const expandedItems = ref<string[]>([]);

const readerStore = useReaderStore();
const sidebarStore = useSidebarStore();

// 用 computed 包裹，确保 watch 能响应翻页后的 progress 变化（原来是快照）
const progress = computed(() => readerStore.getProgress(bookId));

// foliate 的 metadata.author 可能是字符串，也可能是 Contributor 对象/数组
const authorName = computed(() => {
  const author = doc.metadata.author;
  if (!author) return '';
  const first = Array.isArray(author) ? author[0] : author;
  return typeof first === 'string' ? first : (first?.name ?? '');
});

function expandParents(toc: TOCItem[], href: string) {
  const parentPath = findParentPath(toc, href).map((item) => item.href);
  expandedItems.value = parentPath.filter(Boolean) as string[];
}

function scrollToProgress(progress: BookProgress) {
  const currentHref = progress.sectionHref;
  const hrefMd5 = currentHref ? getContentMd5(currentHref) : '';
  const currentItem = viewRef.value?.querySelector(
    `[data-href="${hrefMd5}"]`
  ) as HTMLElement | null;

  if (currentItem) {
    const rect = currentItem.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!isVisible) {
      currentItem.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
    currentItem.setAttribute('aria-current', 'page');
  }

  if (currentHref && doc.toc) {
    expandParents(doc.toc, currentHref);
  }
}

onMounted(() => {
  const observer = new MutationObserver(() => {
    const progress = readerStore.getProgress(bookId);
    if (progress && viewRef.value) {
      scrollToProgress(progress);
      observer.disconnect();
    }
  });

  if (viewRef.value) {
    observer.observe(viewRef.value, { childList: true, subtree: true });
  }

  return () => observer.disconnect();
});

watch([progress, () => doc, () => sidebarStore.sideBarBookKey], async ([newProgress]) => {
  if (!newProgress) return;
  await nextTick();
  scrollToProgress(newProgress);
});
</script>

<style scoped>
/* 目录面板宽度固定，不再被最长的一条标题撑开。
   原先模板上挂的是 w-64 —— 那是 Tailwind 的类名，本项目用的是 Vuetify 工具类
   （只有 w-25/33/50/66/75/100），所以 w-64 实际不生效：面板没有宽度，作为
   flex item 时 flex-basis:auto 会按 max-content 取宽，而条目文字是 nowrap，
   最长的一条标题就成了面板宽度；又因为它带 flex-shrink-0 不会收缩，正文被挤窄。
   这里直接给死宽度，超长标题交给条目内部做 ellipsis 截断。 */
.toc-panel {
  /* 想调整侧栏宽度，只改这一个变量即可 */
  --toc-panel-width: 18rem;

  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

/* 桌面端：贴着正文右侧的固定宽度侧栏 */
.toc-panel--side {
  position: relative;
  z-index: 200;
  flex: 0 0 var(--toc-panel-width);
  width: var(--toc-panel-width);
  max-width: var(--toc-panel-width);
}

/* 移动端底部抽屉：横向占满 */
.toc-panel--sheet {
  flex: 0 0 auto;
  width: 100%;
  max-width: 100%;
}

/* 书名（模板里原来用的 text-lg 同样是 Tailwind 类名，Vuetify 没有，故在此声明） */
.toc-panel__title {
  font-size: 1.125rem;
  line-height: 1.75rem;
  font-weight: 500;
}
</style>
