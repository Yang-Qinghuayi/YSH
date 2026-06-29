<template>
  <Teleport to="body">
    <Transition name="search-modal">
      <div v-if="visible" class="search-backdrop" @click.self="close">
        <div class="search-panel" @keydown="handleKeydown">

          <!-- 搜索框 -->
          <div class="search-input-row">
            <v-icon :icon="mdiMagnify" size="17" class="search-icon" />
            <input
              ref="inputRef"
              v-model="query"
              class="search-input"
              placeholder="搜索全文..."
              autocomplete="off"
              spellcheck="false"
            />
            <span v-if="results.length" class="result-count">{{ results.length }} 个结果</span>
          </div>

          <div class="search-divider" />

          <!-- 结果列表 -->
          <div ref="listRef" class="search-results">
            <!-- 有结果 -->
            <template v-if="query.trim() && !isSearching">
              <template v-if="results.length">
                <div
                  v-for="(result, index) in results"
                  :key="`${result.chapterId}-${result.lineIndex}-${result.matchStart}`"
                  class="result-item"
                  :class="{ 'result-item--active': selectedIndex === index }"
                  @click="selectResult(result)"
                  @mouseenter="selectedIndex = index"
                >
                  <div class="result-meta">
                    <span class="result-chapter">{{ result.chapterTitle }}</span>
                    <span class="result-line-no">第 {{ result.lineIndex + 1 }} 行</span>
                  </div>
                  <div class="result-line" v-html="highlightMatch(result)" />
                </div>
              </template>
              <div v-else class="search-hint">未找到匹配结果</div>
            </template>

            <!-- 搜索中 -->
            <div v-else-if="isSearching" class="search-hint">
              <v-progress-circular size="14" width="2" indeterminate class="mr-2" />
              搜索中…
            </div>

            <!-- 空状态 -->
            <div v-else class="search-hint">输入关键词搜索全书内容</div>
          </div>

          <!-- 底部提示 -->
          <div class="search-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
            <span><kbd>Enter</kbd> 跳转</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { mdiMagnify } from '@mdi/js'
import type { ChapterMeta, SearchResult } from '@/types/novel'

const props = defineProps<{
  visible: boolean
  novelId: string
  chapters: ChapterMeta[]
  searchFn: (novelId: string, chapters: ChapterMeta[], query: string) => Promise<SearchResult[]>
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  jump: [result: SearchResult]
}>()

const query = ref('')
const results = ref<SearchResult[]>([])
const selectedIndex = ref(0)
const isSearching = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 搜索（带 debounce）
watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!q.trim()) {
    results.value = []
    selectedIndex.value = 0
    return
  }
  debounceTimer = setTimeout(() => doSearch(q), 300)
})

async function doSearch(q: string) {
  isSearching.value = true
  try {
    const res = await props.searchFn(props.novelId, props.chapters, q)
    results.value = res
    selectedIndex.value = 0
  } catch {
    results.value = []
  } finally {
    isSearching.value = false
  }
}

// 打开时自动聚焦输入框，关闭时清空状态
watch(
  () => props.visible,
  (v) => {
    if (v) {
      query.value = ''
      results.value = []
      selectedIndex.value = 0
      nextTick(() => inputRef.value?.focus())
    }
  },
)

function close() {
  emit('update:visible', false)
}

function selectResult(result: SearchResult) {
  emit('jump', result)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1)
    scrollSelectedIntoView()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollSelectedIntoView()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const r = results.value[selectedIndex.value]
    if (r) selectResult(r)
  }
}

function scrollSelectedIntoView() {
  nextTick(() => {
    const el = listRef.value?.querySelector('.result-item--active')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

// 高亮匹配词
function highlightMatch(result: SearchResult): string {
  const { lineContent, matchStart, matchEnd } = result
  const pre = escapeHtml(lineContent.slice(0, matchStart))
  const match = escapeHtml(lineContent.slice(matchStart, matchEnd))
  const post = escapeHtml(lineContent.slice(matchEnd))
  return `${pre}<mark>${match}</mark>${post}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
</script>

<style scoped>
/* ====== 遮罩 ====== */
.search-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

/* ====== 面板 ====== */
.search-panel {
  width: 640px;
  max-width: calc(100vw - 48px);
  max-height: 480px;
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.94);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ====== 搜索框行 ====== */
.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.search-icon {
  color: rgba(var(--v-theme-on-surface), 0.4);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.9);
  font-family: inherit;
  caret-color: rgb(var(--v-theme-primary));
}

.search-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.3);
}

.result-count {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  flex-shrink: 0;
  white-space: nowrap;
}

/* ====== 分割线 ====== */
.search-divider {
  height: 1px;
  background: rgba(var(--v-theme-on-surface), 0.07);
  flex-shrink: 0;
}

/* ====== 结果列表 ====== */
.search-results {
  flex: 1;
  overflow-y: auto;
  min-height: 120px;
  max-height: 340px;
}

/* 结果项 */
.result-item {
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 0;
  transition: background 0.1s ease;
}

.result-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.result-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.result-chapter {
  font-size: 11px;
  font-weight: 600;
  color: rgba(var(--v-theme-primary), 0.85);
}

.result-line-no {
  font-size: 10.5px;
  color: rgba(var(--v-theme-on-surface), 0.35);
}

.result-line {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Noto Serif SC", "Source Han Serif", "Georgia", serif;
}

/* 高亮匹配词 */
.result-line :deep(mark) {
  background: rgba(var(--v-theme-warning), 0.35);
  color: rgba(var(--v-theme-on-surface), 0.9);
  border-radius: 2px;
  padding: 0 1px;
}

/* 提示/空状态 */
.search-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.35);
}

/* ====== 底部提示 ====== */
.search-footer {
  flex-shrink: 0;
  padding: 8px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.3);
}

kbd {
  display: inline-block;
  background: rgba(var(--v-theme-on-surface), 0.07);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0 4px;
  font-size: 10px;
  font-family: ui-monospace, 'SF Mono', 'Menlo', monospace;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.6;
  margin-right: 1px;
}

/* ====== 过渡动画 ====== */
.search-modal-enter-active,
.search-modal-leave-active {
  transition: opacity 0.18s ease;
}

.search-modal-enter-active .search-panel,
.search-modal-leave-active .search-panel {
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
}

.search-modal-enter-from,
.search-modal-leave-to {
  opacity: 0;
}

.search-modal-enter-from .search-panel,
.search-modal-leave-to .search-panel {
  transform: translateY(-12px) scale(0.97);
  opacity: 0;
}
</style>
