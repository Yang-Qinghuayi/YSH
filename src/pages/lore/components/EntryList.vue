<template>
  <div class="entry-list d-flex flex-column gap-1">
    <!-- 条目列表 -->
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="entry-item d-flex align-center rounded px-2 py-1 cursor-pointer"
      :class="{ 'entry-active': currentEntryId === entry.id }"
      @click="emit('select', entry)"
    >
      <!-- 重要度星标 -->
      <v-icon
        v-if="entry.importance === 'major'"
        :icon="mdiStar"
        size="12"
        color="warning"
        class="mr-1 flex-shrink-0"
      />
      <v-icon
        v-else
        :icon="mdiCircleSmall"
        size="16"
        class="mr-1 flex-shrink-0 text-medium-emphasis"
      />

      <!-- 名称 + 类型 -->
      <div class="flex-1 min-width-0">
        <div class="text-body-2 text-truncate">{{ entry.name }}</div>
      </div>

      <!-- 类型芯片 -->
      <v-chip size="x-small" variant="text" class="text-caption text-medium-emphasis ml-1 flex-shrink-0">
        {{ ENTRY_TYPE_LABELS[entry.type] }}
      </v-chip>

      <!-- 删除按钮（悬停显示） -->
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="error"
        class="delete-btn"
        @click.stop="emit('delete', entry.id)"
      >
        <v-icon :icon="mdiClose" size="14" />
      </v-btn>
    </div>

    <!-- 空状态 -->
    <div v-if="entries.length === 0" class="text-caption text-medium-emphasis px-2 py-2">
      {{ filterType === 'all' ? '还没有条目，添加一个吧' : `暂无「${ENTRY_TYPE_LABELS[filterType as EntryType]}」条目` }}
    </div>

    <!-- 新增条目按钮 -->
    <v-btn
      size="small"
      variant="text"
      prepend-icon="mdi-plus"
      class="mt-1 justify-start"
      @click="showCreateInput = true"
    >
      新增条目
    </v-btn>

    <!-- 新增条目输入框 -->
    <v-expand-transition>
      <div v-if="showCreateInput" class="px-1">
        <v-text-field
          v-model="newEntryName"
          label="条目名称"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          @keyup.enter="confirmCreate"
          @keyup.esc="cancelCreate"
        />
        <v-select
          v-model="newEntryType"
          :items="typeOptions"
          item-title="label"
          item-value="value"
          label="类型"
          density="compact"
          variant="outlined"
          hide-details
          class="mt-2"
        />
        <div class="d-flex gap-1 mt-1">
          <v-btn size="x-small" variant="text" @click="cancelCreate">取消</v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="tonal"
            :disabled="!newEntryName.trim()"
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
import { mdiStar, mdiCircleSmall, mdiClose } from '@mdi/js'
import type { EntryMeta, EntryType } from '@/types/lore'
import { ENTRY_TYPE_LABELS } from '@/types/lore'

const props = defineProps<{
  entries: EntryMeta[]
  currentEntryId?: string
  filterType: EntryType | 'all'
}>()

const emit = defineEmits<{
  select: [entry: EntryMeta]
  delete: [entryId: string]
  create: [name: string, type: EntryType]
}>()

const showCreateInput = ref(false)
const newEntryName = ref('')
const newEntryType = ref<EntryType>('character')

const typeOptions = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

function confirmCreate() {
  const name = newEntryName.value.trim()
  if (!name) return
  emit('create', name, newEntryType.value)
  cancelCreate()
}

function cancelCreate() {
  showCreateInput.value = false
  newEntryName.value = ''
  newEntryType.value = 'character'
}
</script>

<style scoped>
.entry-item {
  transition: background 0.15s;
  user-select: none;
  cursor: pointer;
}

.entry-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.entry-active {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.entry-item .delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.entry-item:hover .delete-btn {
  opacity: 1;
}

.min-width-0 {
  min-width: 0;
}
</style>
