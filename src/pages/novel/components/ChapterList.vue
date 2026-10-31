<template>
  <div class="chapter-list">
    <!-- 章节列表 -->
    <div
      v-for="chapter in sortedChapters"
      :key="chapter.id"
      class="list-item"
      :class="{ 'list-item--active': currentChapterId === chapter.id }"
      @click="emit('select', chapter)"
    >
      <span class="list-item__order">{{ String(chapter.order).padStart(2, '0') }}</span>
      <span class="list-item__title">{{ chapter.title }}</span>
      <span class="list-item__wc">{{ formatWC(chapter.wordCount) }}</span>
      <button class="list-item__del" tabindex="-1" @click.stop="emit('delete', chapter.id)">
        <v-icon :icon="mdiClose" size="13" />
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="sortedChapters.length === 0" class="list-empty">暂无章节</div>

    <!-- 新增按钮 -->
    <button class="add-btn lg-pill" @click="showNewChapterInput = true">
      <v-icon :icon="mdiPlus" size="15" />
      新增章节
    </button>

    <!-- 新章节名称输入 -->
    <v-expand-transition>
      <div v-if="showNewChapterInput" class="create-form">
        <v-text-field
          ref="newChapterInput"
          v-model="newChapterTitle"
          placeholder="章节标题"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          rounded="xl"
          class="create-input"
          @keyup.enter="confirmNewChapter"
          @keyup.esc="cancelNewChapter"
        />
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { mdiClose, mdiPlus } from '@mdi/js';

import { formatWordCount as formatWC } from '@/services/novelService';
import type { ChapterMeta } from '@/types/novel';

const props = defineProps<{
  chapters: ChapterMeta[];
  currentChapterId?: string;
}>();

const emit = defineEmits<{
  select: [chapter: ChapterMeta];
  delete: [chapterId: string];
  create: [title: string];
}>();

const sortedChapters = computed(() => [...props.chapters].sort((a, b) => a.order - b.order));

const showNewChapterInput = ref(false);
const newChapterTitle = ref('');

function openCreate() {
  showNewChapterInput.value = true;
}
defineExpose({ openCreate });

function confirmNewChapter() {
  const title = newChapterTitle.value.trim();
  if (!title) return;
  emit('create', title);
  cancelNewChapter();
}

function cancelNewChapter() {
  showNewChapterInput.value = false;
  newChapterTitle.value = '';
}
</script>

<style scoped>
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ---- 列表项 ---- */
.list-item {
  display: flex;
  align-items: center;
  border-radius: 14px;
  padding: 6px 10px 6px 8px;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;
  gap: 7px;
}

.list-item:hover {
  background: color-mix(in srgb, var(--color-on-surface) 5.5%, transparent);
}

.list-item--active {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

/* 章节序号 */
.list-item__order {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--color-on-surface) 32%, transparent);
  width: 18px;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  text-align: center;
  border-radius: 6px;
  padding: 2px 0;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}
.list-item--active .list-item__order {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.list-item__title {
  flex: 1;
  font-size: 13px;
  font-weight: 450;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: color-mix(in srgb, var(--color-on-surface) 82%, transparent);
  transition: color 0.18s ease;
}
.list-item--active .list-item__title {
  color: var(--color-primary);
  font-weight: 500;
}

/* 章节字数 */
.list-item__wc {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--color-on-surface) 30%, transparent);
  flex-shrink: 0;
  letter-spacing: 0.01em;
  transition: color 0.18s ease;
  /* 删除按钮 hover 时隐藏字数，腾出空间 */
}
.list-item:hover .list-item__wc {
  opacity: 0;
}

/* 全书总字数已上移到顶部概览栏，此处移除 */

/* 删除按钮 */
.list-item__del {
  opacity: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: color-mix(in srgb, var(--color-error) 70%, transparent);
  transition:
    opacity 0.18s ease,
    background 0.15s ease;
  flex-shrink: 0;
}
.list-item:hover .list-item__del {
  opacity: 1;
  pointer-events: auto;
}
.list-item__del:hover {
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
}

/* 空状态 */
.list-empty {
  font-size: 12px;
  color: color-mix(in srgb, var(--color-on-surface) 35%, transparent);
  padding: 4px 8px;
}

/* 新增按钮 */
.add-btn {
  width: 100%;
  justify-content: flex-start;
  padding: 7px 12px;
  margin-top: 4px;
}

/* 新建表单 */
.create-form {
  padding: 4px 2px 2px;
}

/* 输入框颜色与主题一致 */
.create-input :deep(.v-field__outline__start),
.create-input :deep(.v-field__outline__end),
.create-input :deep(.v-field__outline__notch) {
  border-color: color-mix(in srgb, var(--color-on-surface) 18%, transparent) !important;
}
.create-input :deep(.v-field--focused .v-field__outline__start),
.create-input :deep(.v-field--focused .v-field__outline__end),
.create-input :deep(.v-field--focused .v-field__outline__notch) {
  border-color: var(--color-primary) !important;
}
.create-input :deep(input::placeholder) {
  color: color-mix(in srgb, var(--color-on-surface) 38%, transparent);
}
</style>
