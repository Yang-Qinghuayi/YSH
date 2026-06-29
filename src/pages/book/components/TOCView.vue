<template>
  <div role="tree" ref="viewRef"
    :class="inSheet
      ? 'w-full p-3 overflow-auto h-full'
      : 'w-64 p-3 mx-9 overflow-auto h-[60vh]'"
  >
    <div class="text-lg truncate m-3 mb-0 text-center">
      {{ doc.metadata.title }}
    </div>
    <div class="truncate text-center m-2">
      {{ doc.metadata.author?.name }}
    </div>
    <TOCItemView v-for="(item, index) in doc?.toc" :key="`${index}-${item.href}`" :bookId="bookId" :item="item"
      :depth="0" :expandedItems="expandedItems" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import TOCItemView from './TOCItemView.vue';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { getContentMd5 } from '@/utils/misc';
import { eventDispatcher } from '@/utils/event';
import { findParentPath } from '@/utils/toc';
import type { BookDoc, TOCItem } from '@/libs/document';
import type { BookProgress } from '@/types/book';

const { bookId, doc, inSheet = false } = defineProps<{
  bookId: string
  doc: BookDoc
  inSheet?: boolean
}>()


const viewRef = ref<HTMLElement | null>(null);
const expandedItems = ref<string[]>([]);

const readerStore = useReaderStore();
const sidebarStore = useSidebarStore();

const progress = readerStore.getProgress(bookId);

function expandParents(toc: TOCItem[], href: string) {
  const parentPath = findParentPath(toc, href).map((item) => item.href);
  expandedItems.value = parentPath.filter(Boolean) as string[];
}

function scrollToProgress(progress: BookProgress) {
  const currentHref = progress.sectionHref;
  const hrefMd5 = currentHref ? getContentMd5(currentHref) : '';
  const currentItem = viewRef.value?.querySelector(`[data-href="${hrefMd5}"]`) as HTMLElement | null;

  if (currentItem) {
    const rect = currentItem.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!isVisible) {
      currentItem.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
    currentItem.setAttribute('aria-current', 'page');
  }

  if (currentHref) {
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

watch(
  () => [doc, progress, sidebarStore.sideBarBookKey],
  async () => {
    if (!progress || eventDispatcher.dispatchSync('tts-is-speaking')) return;
    await nextTick();
    scrollToProgress(progress);
  }
);
</script>
