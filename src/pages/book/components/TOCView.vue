<template>
  <div
    ref="viewRef"
    role="tree"
    :class="inSheet ? 'w-100 pa-3' : 'w-64 pa-3 flex-shrink-0'"
    :style="
      inSheet
        ? { maxHeight: 'calc(75dvh - 40px)', overflowY: 'auto' }
        : { position: 'relative', zIndex: 200, height: '80vh', overflowY: 'auto' }
    "
  >
    <div class="text-lg text-truncate ma-3 mb-0 text-center">
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
.toc-panel {
  width: 16rem;
}

.toc-title {
  font-size: 1.125rem;
  line-height: 1.75rem;
}
</style>
