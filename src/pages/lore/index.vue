<template>
  <div class="lore-root">
  <WorkspaceInit v-if="!workspaceReady" @done="workspaceReady = true" class="h-100" />

  <div v-else class="lore-page d-flex h-100">
    <!-- ===== 左侧栏 ===== -->
    <div class="lore-sidebar d-flex flex-column pa-2 gap-2">

      <!-- 小说选择区 -->
      <div>
        <div class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis px-2 mb-1">
          所属小说
        </div>
        <v-select
          :model-value="currentNovel?.id ?? ''"
          :items="novelOptions"
          item-title="title"
          item-value="id"
          density="compact"
          variant="outlined"
          hide-details
          placeholder="选择小说"
          @update:model-value="handleSelectNovel"
        />
      </div>

      <v-divider />

      <!-- 类型筛选 -->
      <div v-if="lore">
        <div class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis px-2 mb-1">
          分类筛选
        </div>
        <div class="d-flex flex-column gap-1 px-1">
          <!-- 全部 -->
          <div
            class="filter-item d-flex align-center justify-space-between rounded px-2 py-1 cursor-pointer"
            :class="{ 'filter-active': filterType === 'all' }"
            @click="filterType = 'all'"
          >
            <span class="text-body-2">全部</span>
            <v-chip size="x-small" variant="tonal">{{ typeCounts['all'] ?? 0 }}</v-chip>
          </div>
          <!-- 各类型 -->
          <div
            v-for="(label, type) in ENTRY_TYPE_LABELS"
            :key="type"
            class="filter-item d-flex align-center justify-space-between rounded px-2 py-1 cursor-pointer"
            :class="{ 'filter-active': filterType === type }"
            @click="filterType = type as EntryType"
          >
            <span class="text-body-2">{{ label }}</span>
            <v-chip size="x-small" variant="tonal" v-if="typeCounts[type]">
              {{ typeCounts[type] }}
            </v-chip>
          </div>
        </div>
      </div>

      <v-divider v-if="lore" />

      <!-- 条目列表 -->
      <div v-if="lore" class="flex-1 overflow-y-auto">
        <div class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis px-2 mb-1">
          条目
        </div>
        <EntryList
          :entries="filteredEntries"
          :current-entry-id="currentEntry?.id"
          :filter-type="filterType"
          @select="handleSelectEntry"
          @delete="handleDeleteEntry"
          @create="handleCreateEntry"
        />
      </div>
    </div>

    <!-- ===== 主内容区 ===== -->
    <div class="lore-main flex-1 d-flex flex-column overflow-hidden">
      <!-- 未选择时的占位 -->
      <div
        v-if="!currentEntry"
        class="d-flex flex-column align-center justify-center h-100 gap-3 text-medium-emphasis"
      >
        <v-icon :icon="mdiBookmarkMultipleOutline" size="56" />
        <div v-if="!currentNovel">请从左侧选择一部小说</div>
        <div v-else-if="!lore || lore.entries.length === 0">从左侧「新增条目」开始构建资料库</div>
        <div v-else>从左侧选择一个条目进行编辑</div>
      </div>

      <!-- 条目编辑器 -->
      <EntryEditor
        v-else
        :entry="currentEntry"
        :content="currentEntryContent"
        :is-dirty="isDirty"
        @update:content="handleContentChange"
        @update:meta="handleMetaChange"
        @save="handleSave"
      />
    </div>

    <!-- 错误提示 -->
    <v-snackbar v-model="showError" color="error" timeout="4000" location="top">
      {{ errorMessage }}
    </v-snackbar>
  </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { mdiBookmarkMultipleOutline } from '@mdi/js'
import { isWorkspaceInitialized } from '@/services/workspaceService'
import WorkspaceInit from '@/components/WorkspaceInit.vue'
import { useLoreStore } from '@/store/loreStore'
import { useNovelStore } from '@/store/novelStore'
import { loadAllNovels } from '@/services/novelService'
import {
  loadOrCreateLore,
  loadEntryContent,
  saveEntryContent,
  createEntry,
  updateEntryMeta,
  deleteEntry,
} from '@/services/loreService'
import type { EntryMeta, EntryType } from '@/types/lore'
import { ENTRY_TYPE_LABELS } from '@/types/lore'
import type { Novel } from '@/types/novel'
import EntryList from './components/EntryList.vue'
import EntryEditor from './components/EntryEditor.vue'

// ===== Store =====
const loreStore = useLoreStore()
const novelStore = useNovelStore()

const { currentNovel, lore, currentEntry, currentEntryContent, isDirty, filterType, filteredEntries, typeCounts } =
  storeToRefs(loreStore)

// ===== 工作区状态 =====
const workspaceReady = ref(isWorkspaceInitialized())

// ===== 本地状态 =====
const allNovels = ref<Novel[]>([])
const showError = ref(false)
const errorMessage = ref('')

const novelOptions = computed(() =>
  allNovels.value.map((n) => ({ id: n.id, title: n.title })),
)

// 自动保存定时器
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// ===== 初始化：加载小说列表 =====
onMounted(async () => {
  try {
    const list = await loadAllNovels()
    allNovels.value = list
    // 如果 novel store 已有当前小说，自动切入
    if (novelStore.currentNovel) {
      await handleSelectNovelById(novelStore.currentNovel.id)
    }
  } catch (e) {
    showErrorMsg('加载小说列表失败：' + (e instanceof Error ? e.message : String(e)))
  }
})

// ===== 小说选择 =====
async function handleSelectNovel(novelId: string) {
  await handleSelectNovelById(novelId)
}

async function handleSelectNovelById(novelId: string) {
  const novel = allNovels.value.find((n) => n.id === novelId)
  if (!novel) return
  try {
    const loreMeta = await loadOrCreateLore(novel)
    loreStore.openNovel(novel, loreMeta)
  } catch (e) {
    showErrorMsg('加载资料库失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// ===== 条目操作 =====
async function handleSelectEntry(entry: EntryMeta) {
  if (currentEntry.value?.id === entry.id) return
  await trySaveCurrent()
  try {
    const content = await loadEntryContent(lore.value!.id, entry.filename)
    loreStore.openEntry(entry, content)
  } catch (e) {
    showErrorMsg('加载条目失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleCreateEntry(name: string, type: EntryType) {
  if (!lore.value) return
  try {
    const { lore: updatedLore, entry } = await createEntry(lore.value, { name, type })
    loreStore.updateLore(updatedLore)
    // 自动打开新条目
    loreStore.openEntry(entry, `# ${name}\n\n`)
  } catch (e) {
    showErrorMsg('创建条目失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleDeleteEntry(entryId: string) {
  if (!lore.value) return
  try {
    const updatedLore = await deleteEntry(lore.value, entryId)
    loreStore.updateLore(updatedLore)
    if (currentEntry.value?.id === entryId) {
      loreStore.openEntry(null as unknown as EntryMeta, '')
    }
  } catch (e) {
    showErrorMsg('删除条目失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// ===== 内容编辑 =====
function handleContentChange(content: string) {
  loreStore.updateContent(content)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => handleSave(), 2000)
}

async function handleMetaChange(patch: Partial<EntryMeta>) {
  if (!lore.value || !currentEntry.value) return
  loreStore.updateCurrentEntryMeta(patch)
  try {
    const updatedLore = await updateEntryMeta(lore.value, currentEntry.value.id, patch)
    loreStore.updateLore(updatedLore)
  } catch (e) {
    showErrorMsg('保存元数据失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleSave() {
  if (!lore.value || !currentEntry.value) return
  try {
    await saveEntryContent(lore.value.id, currentEntry.value.filename, currentEntryContent.value)
    loreStore.markSaved()
  } catch (e) {
    showErrorMsg('保存失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function trySaveCurrent() {
  if (isDirty.value && lore.value && currentEntry.value) {
    await handleSave()
  }
}

// ===== 工具 =====
function showErrorMsg(msg: string) {
  errorMessage.value = msg
  showError.value = true
}

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<style scoped>
.lore-root {
  height: calc(100vh - 48px); /* v-main: -16px, v-container py-4: -32px */
}

.lore-page {
  height: 100%;
  overflow: hidden;
}

.lore-sidebar {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.lore-main {
  min-width: 0;
}

.sidebar-section-title {
  letter-spacing: 0.05em;
}

.filter-item {
  transition: background 0.15s;
  user-select: none;
  cursor: pointer;
}

.filter-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.filter-active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
</style>
