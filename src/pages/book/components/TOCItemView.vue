<template>
  <div class="toc-item w-100" style="padding-top: 1px">
    <v-list-item
      :class="['rounded-pill', item.subitems ? 'pa-0' : '']"
      :aria-expanded="isExpanded"
      :aria-selected="isActive"
      :data-href="getContentMd5(item.href)"
      :active="isActive"
      active-class="text-primary"
      @click="handleClickItem as any"
    >
      <div class="toc-item__row d-flex align-center">
        <v-btn
          v-if="item.subitems"
          class="toc-item__toggle"
          size="small"
          icon
          variant="text"
          @click.stop="toggleExpand"
        >
          <svg
            viewBox="0 0 8 10"
            width="8"
            height="10"
            class="toc-caret"
            :class="isExpanded ? 'toc-caret--open' : ''"
            style="transform-origin: center"
            fill="currentColor"
          >
            <polygon points="0 0, 8 5, 0 10" />
          </svg>
        </v-btn>
        <span
          class="toc-item__label text-truncate"
          :class="item.subitems ? 'ml-0' : 'ml-2'"
          :title="item.label"
        >
          {{ item.label }}
        </span>
      </div>
    </v-list-item>
    <ol v-if="item.subitems && isExpanded" role="group">
      <TOCItemView
        v-for="(subitem, index) in item.subitems"
        :key="`${index}-${subitem.href}`"
        :book-id="bookId"
        :item="subitem"
        :depth="depth + 1"
        :expanded-items="expandedItems"
      />
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { TOCItem } from '@/libs/document';
import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';
import { getContentMd5 } from '@/utils/misc';

import TOCItemView from './TOCItemView.vue';

const props = defineProps<{
  bookId: string;
  item: TOCItem;
  depth: number;
  expandedItems: string[];
}>();

const isExpanded = ref(props.expandedItems.includes(props.item.href || ''));
const readerStore = useReaderStore();

// 用 computed 保证翻页后实时高亮更新（原来是快照，永不响应变化）
const isActive = computed(
  () => readerStore.getProgress(props.bookId)?.sectionHref === props.item.href
);

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

<style scoped>
/* 目录条目：宽度由外部面板决定，条目自身只负责把超长标题截断，
   绝不反向把面板撑宽。
   关键点是 min-width: 0 —— flex item 的自动最小尺寸默认取 min-content，
   nowrap 的标题会把这一路祖先全顶开；配合 label 的 flex: 1 1 auto，
   剩余空间归标题、多余部分走 ellipsis。
   （原来用 max-width: calc(100% - 24px) 限制，但百分比宽度在父级宽度
     尚未确定时等价于 none，撑宽照样发生。） */
.toc-item,
.toc-item__row {
  min-width: 0;
}

.toc-item__row {
  width: 100%;
}

.toc-item__toggle {
  flex: none;
}

.toc-item__label {
  flex: 1 1 auto;
  min-width: 0;
}

/* 展开箭头：旋转动画 + 继承文字颜色 */
.toc-caret {
  color: rgb(var(--v-theme-on-surface));
  transition: transform 0.15s ease;
  transform: rotate(0deg);
}

.toc-caret--open {
  transform: rotate(90deg);
}
</style>
