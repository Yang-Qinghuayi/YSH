<template>
  <div class="entry-list d-flex flex-column gap-1">
    <!-- 条目列表 -->
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="entry-item"
      :class="{ 'entry-active': currentEntryId === entry.id, 'entry-disabled': !entry.enabled }"
      @click="handleItemClick(entry)"
    >
      <!-- 重要度星标 -->
      <v-icon
        v-if="entry.importance === 'major'"
        :icon="mdiStar"
        size="12"
        color="warning"
        class="entry-star"
      />
      <v-icon
        v-else
        :icon="mdiCircleSmall"
        size="16"
        class="entry-dot"
      />

      <!-- 名称：已选中时点击进入内联编辑 -->
      <input
        v-if="editingEntryId === entry.id"
        ref="nameInputRef"
        v-model="editingName"
        class="entry-name-input"
        @blur="commitRename"
        @keyup.enter="commitRename"
        @keyup.esc="cancelRename"
        @click.stop
      />
      <span v-else class="entry-name text-truncate">{{ entry.name }}</span>

      <!-- 禁用图标 -->
      <v-icon
        v-if="!entry.enabled"
        :icon="mdiEyeOffOutline"
        size="12"
        class="entry-disabled-icon"
      />

      <!-- 删除按钮（悬停显示） -->
      <button
        class="entry-del"
        tabindex="-1"
        @click.stop="emit('delete', entry.id)"
      >
        <v-icon :icon="mdiClose" size="13" />
      </button>
    </div>

    <!-- 新增条目按钮（输入中时隐藏） -->
    <button v-if="!showCreateInput" class="add-btn lg-pill" @click="openCreate">
      <v-icon :icon="mdiPlus" size="15" />
      新增条目
    </button>

    <!-- 新增条目输入框：Enter 确认，Esc 取消，无按钮 -->
    <input
      v-if="showCreateInput"
      ref="createInputRef"
      v-model="newEntryName"
      class="create-input"
      placeholder="条目名称…"
      @keyup.enter="confirmCreate"
      @keyup.esc="cancelCreate"
      @blur="cancelCreate"
    />
  </div>
</template>

<script setup lang="ts">
import { mdiStar, mdiCircleSmall, mdiClose, mdiPlus, mdiEyeOffOutline } from '@mdi/js'
import type { EntryMeta } from '@/types/lore'

const props = defineProps<{
  entries: EntryMeta[]
  currentEntryId?: string
}>()

const emit = defineEmits<{
  select: [entry: EntryMeta]
  delete: [entryId: string]
  create: [name: string]
  rename: [entryId: string, name: string]
}>()

// ---- 新增条目 ----
const showCreateInput = ref(false)
const newEntryName = ref('')
const createInputRef = ref<HTMLInputElement | null>(null)

function openCreate() {
  showCreateInput.value = true
  nextTick(() => createInputRef.value?.focus())
}

function confirmCreate() {
  const name = newEntryName.value.trim()
  if (!name) { cancelCreate(); return }
  emit('create', name)
  cancelCreate()
}

function cancelCreate() {
  showCreateInput.value = false
  newEntryName.value = ''
}

// ---- 条目点击 ----
function handleItemClick(entry: EntryMeta) {
  if (entry.id === props.currentEntryId) {
    // 已选中 → 进入名称编辑
    startRename(entry)
  } else {
    emit('select', entry)
  }
}

// ---- 名称内联编辑 ----
const editingEntryId = ref<string | null>(null)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startRename(entry: EntryMeta) {
  editingEntryId.value = entry.id
  editingName.value = entry.name
  nextTick(() => nameInputRef.value?.select())
}

function commitRename() {
  const name = editingName.value.trim()
  if (name && editingEntryId.value) {
    emit('rename', editingEntryId.value, name)
  }
  editingEntryId.value = null
  editingName.value = ''
}

function cancelRename() {
  editingEntryId.value = null
  editingName.value = ''
}
</script>

<style scoped>
/* ---- 列表项 ---- */
.entry-item {
  display: flex;
  align-items: center;
  border-radius: 14px;
  padding: 6px 8px;
  cursor: pointer;
  user-select: none;
  transition: background 0.18s ease, box-shadow 0.18s ease;
  gap: 7px;
}
.entry-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.055);
}
.entry-active {
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.2);
}

.entry-star,
.entry-dot {
  flex-shrink: 0;
}
.entry-dot {
  color: rgba(var(--v-theme-on-surface), 0.3);
}

.entry-name {
  flex: 1;
  font-size: 13px;
  font-weight: 450;
  color: rgba(var(--v-theme-on-surface), 0.82);
  transition: color 0.18s ease;
  min-width: 0;
}
.entry-active .entry-name {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

/* 禁用条目 */
.entry-disabled .entry-name {
  color: rgba(var(--v-theme-on-surface), 0.38);
}
.entry-disabled-icon {
  flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), 0.3);
}

/* 内联重命名输入框 */
.entry-name-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.5);
  padding: 0 2px;
  line-height: 1.4;
}

/* 删除按钮 */
.entry-del {
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
.entry-item:hover .entry-del {
  opacity: 1;
  pointer-events: auto;
}
.entry-del:hover {
  background: rgba(var(--v-theme-error), 0.1);
}

/* 空状态 */
.entry-empty {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  padding: 4px 8px;
}

/* 新增按钮 */
.add-btn {
  width: 100%;
  justify-content: flex-start;
  padding: 7px 12px;
  margin-top: 2px;
}

/* 新增条目输入框 */
.create-input {
  width: 100%;
  margin-top: 4px;
  padding: 7px 12px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  background: rgba(var(--v-theme-primary), 0.05);
  color: rgba(var(--v-theme-on-surface), 0.88);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.18s ease;
}
.create-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.3);
}
.create-input:focus {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background: rgba(var(--v-theme-primary), 0.07);
}
</style>
