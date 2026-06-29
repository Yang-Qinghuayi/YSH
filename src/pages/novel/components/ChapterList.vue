<template>
  <div class="chapter-list d-flex flex-column gap-1">
    <!-- 章节列表 -->
    <div
      v-for="chapter in sortedChapters"
      :key="chapter.id"
      class="chapter-item d-flex align-center rounded px-2 py-1 cursor-pointer"
      :class="{ 'chapter-active': currentChapterId === chapter.id }"
      @click="emit('select', chapter)"
    >
      <v-icon :icon="mdiFileDocumentOutline" size="16" class="mr-2 flex-shrink-0 text-medium-emphasis" />
      <span class="flex-1 text-body-2 text-truncate">{{ chapter.title }}</span>
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="error"
        class="delete-btn"
        @click.stop="emit('delete', chapter.id)"
      >
        <v-icon :icon="mdiClose" size="14" />
      </v-btn>
    </div>

    <!-- 空状态 -->
    <div v-if="sortedChapters.length === 0" class="text-caption text-medium-emphasis px-2 py-2">
      暂无章节
    </div>

    <!-- 新增章节按钮 -->
    <v-btn
      size="small"
      variant="text"
      prepend-icon="mdi-plus"
      class="mt-1 justify-start"
      @click="showNewChapterInput = true"
    >
      新增章节
    </v-btn>

    <!-- 新章节名称输入 -->
    <v-expand-transition>
      <div v-if="showNewChapterInput" class="px-1">
        <v-text-field
          ref="newChapterInput"
          v-model="newChapterTitle"
          label="章节标题"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          @keyup.enter="confirmNewChapter"
          @keyup.esc="cancelNewChapter"
        />
        <div class="d-flex gap-1 mt-1">
          <v-btn size="x-small" variant="text" @click="cancelNewChapter">取消</v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="tonal"
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
import { mdiFileDocumentOutline, mdiClose } from '@mdi/js'
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
.chapter-item {
  transition: background 0.15s;
  user-select: none;
}

.chapter-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.chapter-active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.chapter-item .delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.chapter-item:hover .delete-btn {
  opacity: 1;
}
</style>
