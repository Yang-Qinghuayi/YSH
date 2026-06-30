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
      <button
        class="list-item__del"
        @click.stop="emit('delete', chapter.id)"
        tabindex="-1"
      >
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
          label="章节标题"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          rounded="xl"
          @keyup.enter="confirmNewChapter"
          @keyup.esc="cancelNewChapter"
        />
        <div class="d-flex gap-1 mt-2">
          <v-btn size="x-small" variant="text" rounded="pill" @click="cancelNewChapter">取消</v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="tonal"
            rounded="pill"
            :disabled="!newChapterTitle.trim()"
            @click="confirmNewChapter"
          >
            确定
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { mdiClose, mdiPlus } from '@mdi/js'
import { formatWordCount as formatWC } from '@/services/novelService'
import type { ChapterMeta } from '@/types/novel'

const props = defineProps<{
  chapters: ChapterMeta[]
  currentChapterId?: string
}>()

const emit = defineEmits<{
  select: [chapter: ChapterMeta]
  delete: [chapterId: string]
  create: [title: string]
}>()

const sortedChapters = computed(() =>
  [...props.chapters].sort((a, b) => a.order - b.order),
)

const showNewChapterInput = ref(false)
const newChapterTitle = ref('')

function openCreate() {
  showNewChapterInput.value = true
}
defineExpose({ openCreate })

function confirmNewChapter() {
  const title = newChapterTitle.value.trim()
  if (!title) return
  emit('create', title)
  cancelNewChapter()
}

function cancelNewChapter() {
  showNewChapterInput.value = false
  newChapterTitle.value = ''
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
  transition: background 0.2s ease, box-shadow 0.2s ease;
  gap: 7px;
}

.list-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.055);
}

.list-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.2);
}

/* 章节序号 */
.list-item__order {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.32);
  width: 18px;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  text-align: center;
  border-radius: 6px;
  padding: 2px 0;
  transition: color 0.18s ease, background 0.18s ease;
}
.list-item--active .list-item__order {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.16);
}

.list-item__title {
  flex: 1;
  font-size: 13px;
  font-weight: 450;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), 0.82);
  transition: color 0.18s ease;
}
.list-item--active .list-item__title {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

/* 章节字数 */
.list-item__wc {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.3);
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
  color: rgba(var(--v-theme-error), 0.7);
  transition: opacity 0.18s ease, background 0.15s ease;
  flex-shrink: 0;
}
.list-item:hover .list-item__del {
  opacity: 1;
  pointer-events: auto;
}
.list-item__del:hover {
  background: rgba(var(--v-theme-error), 0.1);
}

/* 空状态 */
.list-empty {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.35);
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
</style>
