<template>
  <div class="w-full" style="padding-top: 1px">
    <v-list-item :class="[
      'rounded-pill',
      item.subitems ? 'p-0' : '',
    ]" @click="handleClickItem as any" :aria-expanded="isExpanded" :aria-selected="isActive"
      :data-href="getContentMd5(item.href)" :active="isActive" active-class="text-primary">

      <div class="flex items-center">
        <v-btn size="small" icon variant='text' v-if="item.subitems" @click.stop="toggleExpand">
          <svg viewBox="0 0 8 10" width="8" height="10" class="text-base-content transform transition-transform"
            :class="isExpanded ? 'rotate-90' : 'rotate-0'" style="transform-origin: center" fill="currentColor">
            <polygon points="0 0, 8 5, 0 10" />
          </svg>
        </v-btn>
        <span class="truncate" :class="item.subitems ? 'ml-0' : 'ml-2'"
          style="max-width: calc(100% - 24px); white-space: nowrap; text-overflow: ellipsis">
          {{ item.label }}
        </span>
      </div>
    </v-list-item>
    <ol v-if="item.subitems && isExpanded" role="group">
      <TOCItemView v-for="(  subitem, index  ) in   item.subitems  " :key="`${index}-${subitem.href}`" :bookId="bookId"
        :item="subitem" :depth="depth + 1" :expandedItems="expandedItems" />
    </ol>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import TOCItemView from './TOCItemView.vue';
import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';
import { getContentMd5 } from '@/utils/misc';
import type { TOCItem } from '@/libs/document';

const props = defineProps<{
  bookId: string;
  item: TOCItem;
  depth: number;
  expandedItems: string[];
}>();

const isExpanded = ref(props.expandedItems.includes(props.item.href || ''));
const readerStore = useReaderStore();

const progress = readerStore.getProgress(props.bookId);
const isActive = progress?.sectionHref === props.item.href;

function toggleExpand(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  isExpanded.value = !isExpanded.value;
}

function handleClickItem(event: MouseEvent) {
  event.preventDefault();
  eventDispatcher.dispatch('navigate', { bookKey: props.bookId, href: props.item.href });

  if (props.item.href) {
    readerStore.getView(props.bookId)?.goTo(props.item.href);
  }
}

watch(
  () => props.expandedItems,
  (newVal) => {
    isExpanded.value = newVal.includes(props.item.href || '');
  }
);
</script>
