<template>
  <div class="novel-list">
    <!-- 小说列表 -->
    <div
      v-for="novel in novels"
      :key="novel.id"
      class="list-item"
      :class="{ 'list-item--active': currentNovelId === novel.id }"
      @click="emit('select', novel)"
    >
      <!-- 选中条 -->
      <span class="list-item__indicator" />

      <div class="list-item__content">
        <div class="list-item__title">{{ novel.title }}</div>
        <div class="list-item__meta">{{ novel.chapters.length }} 章</div>
      </div>

      <button
        class="list-item__del"
        @click.stop="emit('delete', novel.id)"
        tabindex="-1"
      >
        <v-icon :icon="mdiClose" size="13" />
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="novels.length === 0" class="list-empty">
      还没有小说，新建一部吧
    </div>

    <!-- 新建按钮 -->
    <button class="add-btn lg-pill" @click="showCreateInput = true">
      <v-icon :icon="mdiPlus" size="15" />
      新建小说
    </button>

    <!-- 新建输入区 -->
    <v-expand-transition>
      <div v-if="showCreateInput" class="create-form">
        <v-text-field
          v-model="newNovelTitle"
          label="小说标题"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          rounded="xl"
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
          rounded="xl"
          class="mt-2"
        />
        <div class="d-flex gap-1 mt-2">
          <v-btn size="x-small" variant="text" rounded="pill" @click="cancelCreate">取消</v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="tonal"
            rounded="pill"
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
import { mdiClose, mdiPlus } from '@mdi/js'
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

function openCreate() {
  showCreateInput.value = true
}
defineExpose({ openCreate })

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
.novel-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ---- 列表项 ---- */
.list-item {
  display: flex;
  align-items: center;
  border-radius: 14px;
  padding: 7px 10px 7px 8px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  gap: 6px;
}

.list-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.055);
}

.list-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.2);
}

/* 选中左侧小亮条 */
.list-item__indicator {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.18s ease;
}
.list-item--active .list-item__indicator {
  background: rgb(var(--v-theme-primary));
}

.list-item__content {
  flex: 1;
  min-width: 0;
}

.list-item__title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), 0.87);
  transition: color 0.18s ease;
}
.list-item--active .list-item__title {
  color: rgb(var(--v-theme-primary));
}

.list-item__meta {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.38);
  margin-top: 1px;
}

/* 删除按钮：平时隐藏，hover 出现 */
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

/* 新建按钮 */
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
