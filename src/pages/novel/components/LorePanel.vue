<template>
  <v-dialog
    :model-value="visible"
    width="90vw"
    max-width="1200px"
    height="85vh"
    scrollable
    @update:model-value="(v) => emit('update:visible', v)"
  >
    <v-card class="lore-dialog-card d-flex flex-column h-100">
      <!-- 标题栏 -->
      <div class="lore-dialog-header d-flex align-center px-4 py-3 flex-shrink-0">
        <v-icon :icon="mdiBookmarkMultipleOutline" class="mr-2" />
        <span class="text-h6">设定资料库</span>
        <span class="text-caption text-medium-emphasis ml-2">{{ novel.title }}</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="emit('update:visible', false)">
          <v-icon :icon="mdiClose" size="20" />
        </v-btn>
      </div>

      <v-divider />

      <!-- 主体：左右两栏 -->
      <div class="lore-page d-flex flex-1 overflow-hidden">
        <!-- ===== 左侧栏 ===== -->
        <div class="lore-sidebar d-flex flex-column pa-2 gap-2">
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

          <!-- 加载/空状态 -->
          <div v-else class="d-flex align-center justify-center flex-1 text-medium-emphasis text-body-2">
            加载中…
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
            <div v-if="!lore || lore.entries.length === 0">从左侧「新增条目」开始构建资料库</div>
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
      </div>

      <!-- 错误提示 -->
      <v-snackbar v-model="showError" color="error" timeout="4000" location="top">
        {{ errorMessage }}
      </v-snackbar>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { mdiBookmarkMultipleOutline, mdiClose } from '@mdi/js'
import { useLoreStore } from '@/store/loreStore'
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
import EntryList from '@/pages/lore/components/EntryList.vue'
import EntryEditor from '@/pages/lore/components/EntryEditor.vue'

const props = defineProps<{ novel: Novel; visible: boolean; focusEntryId?: string | null }>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  saved: []
}>()

const loreStore = useLoreStore()

const { lore, currentEntry, currentEntryContent, isDirty, filterType, filteredEntries, typeCounts } =
  storeToRefs(loreStore)

const showError = ref(false)
const errorMessage = ref('')

// 自动保存定时器
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// 打开或切小说时加载资料库
async function loadLore(novel: Novel) {
  try {
    const loreMeta = await loadOrCreateLore(novel)
    loreStore.openNovel(novel, loreMeta)
  } catch (e) {
    showErrorMsg('加载资料库失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

/** 定位到指定条目（供父组件 chip 点击跳转） */
async function focusEntry(entryId: string | null | undefined) {
  if (!entryId || !lore.value) return
  const entry = lore.value.entries.find((e) => e.id === entryId)
  if (!entry) return
  if (currentEntry.value?.id === entry.id) return
  await trySaveCurrent()
  try {
    const content = await loadEntryContent(lore.value!.id, entry.filename)
    loreStore.openEntry(entry, content)
  } catch (e) {
    showErrorMsg('加载条目失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// 弹窗打开时加载；切小说时重新加载
watch(
  () => [props.visible, props.novel?.id] as const,
  async ([vis, novelId], [prevVis]) => {
    if (vis && novelId) {
      if (!prevVis || !lore.value || lore.value.id !== novelId) {
        await loadLore(props.novel)
        // 加载完成后若指定了定位条目，则选中
        if (props.focusEntryId) await focusEntry(props.focusEntryId)
      }
    } else if (!vis) {
      // 关闭时落盘未保存内容
      await trySaveCurrent()
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
    }
  },
  { immediate: true },
)

// 打开期间 focusEntryId 变化时定位
watch(
  () => props.focusEntryId,
  (id) => {
    if (props.visible && id) focusEntry(id)
  },
)

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
    loreStore.openEntry(entry, `# ${name}\n\n`)
    emit('saved')
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
    emit('saved')
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
    emit('saved')
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
</script>

<style scoped>
.lore-dialog-card {
  overflow: hidden;
}

.lore-dialog-header {
  background: rgba(var(--v-theme-surface), 0.88);
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
