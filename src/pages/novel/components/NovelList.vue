<template>
  <div class="novel-list d-flex flex-column gap-1">
    <!-- 小说列表 -->
    <div
      v-for="novel in novels"
      :key="novel.id"
      class="novel-item d-flex align-center rounded px-2 py-1 cursor-pointer"
      :class="{ 'novel-active': currentNovelId === novel.id }"
      @click="emit('select', novel)"
    >
      <v-icon :icon="mdiBookOutline" size="16" class="mr-2 flex-shrink-0 text-medium-emphasis" />
      <div class="flex-1 min-width-0">
        <div class="text-body-2 text-truncate">{{ novel.title }}</div>
        <div class="text-caption text-medium-emphasis">{{ novel.chapters.length }} 章</div>
      </div>
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="error"
        class="delete-btn"
        @click.stop="emit('delete', novel.id)"
      >
        <v-icon :icon="mdiClose" size="14" />
      </v-btn>
    </div>

    <!-- 空状态 -->
    <div v-if="novels.length === 0" class="text-caption text-medium-emphasis px-2 py-2">
      还没有小说，创建一部吧
    </div>

    <!-- 新建小说 -->
    <v-btn
      size="small"
      variant="text"
      prepend-icon="mdi-plus"
      class="mt-1 justify-start"
      @click="showCreateInput = true"
    >
      新建小说
    </v-btn>

    <v-expand-transition>
      <div v-if="showCreateInput" class="px-1">
        <v-text-field
          v-model="newNovelTitle"
          label="小说标题"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          @keyup.enter="confirmCreate"
          @keyup.esc="cancelCreate"
        />
        <v-textarea
          v-model="newNovelSynopsis"
          label="故事简介（可选）"
          density="compact"
          variant="outlined"
          hide-details
          rows="2"
          class="mt-2"
        />
        <div class="d-flex gap-1 mt-1">
          <v-btn size="x-small" variant="text" @click="cancelCreate">取消</v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="tonal"
            :disabled="!newNovelTitle.trim()"
            @click="confirmCreate"
          >
            创建
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { mdiBookOutline, mdiClose } from '@mdi/js'
import type { Novel } from '@/types/novel'

const props = defineProps<{
  novels: Novel[]
  currentNovelId?: string
}>()

const emit = defineEmits<{
  select: [novel: Novel]
  delete: [novelId: string]
  create: [title: string, synopsis: string]
}>()

const showCreateInput = ref(false)
const newNovelTitle = ref('')
const newNovelSynopsis = ref('')

function confirmCreate() {
  const title = newNovelTitle.value.trim()
  if (!title) return
  emit('create', title, newNovelSynopsis.value.trim())
  cancelCreate()
}

function cancelCreate() {
  showCreateInput.value = false
  newNovelTitle.value = ''
  newNovelSynopsis.value = ''
}
</script>

<style scoped>
.novel-item {
  transition: background 0.15s;
  user-select: none;
  cursor: pointer;
}

.novel-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.novel-active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.novel-item .delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.novel-item:hover .delete-btn {
  opacity: 1;
}

.min-width-0 {
  min-width: 0;
}
</style>
