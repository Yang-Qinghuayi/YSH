<template>
  <div class="entry-editor d-flex flex-column h-100">
    <!-- 顶部元数据表单 -->
    <div class="entry-meta-form px-4 pt-3 pb-2 flex-shrink-0">
      <!-- 标题行：名称 + 保存按钮 -->
      <div class="d-flex align-center gap-2 mb-3">
        <v-text-field
          :model-value="entry.name"
          label="条目名称"
          density="compact"
          variant="underlined"
          hide-details
          class="entry-name-field"
          @update:model-value="handleMetaChange('name', $event)"
        />
        <v-spacer />
        <span v-if="isDirty" class="text-caption text-medium-emphasis">未保存</span>
        <v-btn
          v-if="isDirty"
          size="small"
          variant="tonal"
          color="primary"
          @click="emit('save')"
        >
          保存
        </v-btn>
      </div>

      <!-- 类型 + 重要度 + 启用 -->
      <div class="d-flex flex-wrap gap-2 mb-2">
        <v-select
          :model-value="entry.type"
          :items="typeOptions"
          item-title="label"
          item-value="value"
          label="类型"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 130px"
          @update:model-value="handleMetaChange('type', $event)"
        />
        <v-select
          :model-value="entry.importance"
          :items="importanceOptions"
          item-title="label"
          item-value="value"
          label="重要度"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 110px"
          @update:model-value="handleMetaChange('importance', $event)"
        />
        <v-checkbox
          :model-value="entry.enabled"
          label="启用"
          density="compact"
          hide-details
          @update:model-value="handleMetaChange('enabled', $event)"
        />
      </div>

      <!-- 简介 -->
      <v-textarea
        :model-value="entry.briefDescription"
        label="索引简介（3-5 句，供 AI 快速参考）"
        density="compact"
        variant="outlined"
        hide-details
        rows="2"
        auto-grow
        class="mb-2"
        @update:model-value="handleMetaChange('briefDescription', $event)"
      />

      <!-- 关键词 + 标签 -->
      <div class="d-flex gap-2">
        <v-combobox
          :model-value="entry.keywords"
          label="别名 / 触发词"
          density="compact"
          variant="outlined"
          hide-details
          multiple
          chips
          closable-chips
          class="flex-1"
          @update:model-value="handleMetaChange('keywords', $event)"
        />
        <v-combobox
          :model-value="entry.tags"
          label="标签"
          density="compact"
          variant="outlined"
          hide-details
          multiple
          chips
          closable-chips
          class="flex-1"
          @update:model-value="handleMetaChange('tags', $event)"
        />
      </div>
    </div>

    <v-divider />

    <!-- CodeMirror 正文编辑区 -->
    <div ref="editorContainer" class="editor-area flex-1 overflow-hidden" />

    <!-- 底部提示 -->
    <div class="editor-footer px-4 py-1 text-caption text-medium-emphasis">
      在此编写条目正文（支持 Markdown），内容会注入到 AI 写作上下文中
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from 'vuetify'
import type { EntryMeta, EntryType, EntryImportance } from '@/types/lore'
import { ENTRY_TYPE_LABELS, ENTRY_IMPORTANCE_LABELS } from '@/types/lore'

const props = defineProps<{
  entry: EntryMeta
  content: string
  isDirty: boolean
}>()

const emit = defineEmits<{
  'update:content': [content: string]
  'update:meta': [patch: Partial<EntryMeta>]
  save: []
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

const typeOptions = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const importanceOptions = Object.entries(ENTRY_IMPORTANCE_LABELS).map(([value, label]) => ({ value, label }))

// 元数据变更（表单字段）
function handleMetaChange(field: keyof EntryMeta, value: unknown) {
  emit('update:meta', { [field]: value } as Partial<EntryMeta>)
}

// 初始化 CodeMirror
function createEditor(content: string) {
  if (!editorContainer.value) return

  const extensions = [
    markdown(),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': { height: '100%', fontSize: '15px' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', lineHeight: '1.8' },
      '.cm-content': { maxWidth: '720px', margin: '0 auto', padding: '16px 24px 80px' },
      '.cm-line': { padding: '0' },
      '.cm-focused': { outline: 'none' },
    }),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        emit('update:content', update.state.doc.toString())
      }
    }),
  ]

  if (isDark.value) {
    extensions.push(oneDark)
  }

  const state = EditorState.create({ doc: content, extensions })
  editorView.value = new EditorView({ state, parent: editorContainer.value })
}

// 切换条目时重建编辑器
watch(
  () => props.entry.id,
  () => {
    editorView.value?.destroy()
    editorView.value = null
    nextTick(() => createEditor(props.content))
  },
)

// 主题切换时重建
watch(isDark, () => {
  const doc = editorView.value?.state.doc.toString() ?? props.content
  editorView.value?.destroy()
  editorView.value = null
  nextTick(() => createEditor(doc))
})

onMounted(() => createEditor(props.content))
onBeforeUnmount(() => editorView.value?.destroy())
</script>

<style scoped>
.entry-editor {
  height: 100%;
  overflow: hidden;
}

.entry-meta-form {
  border-bottom: none;
}

.entry-name-field {
  flex: 1;
}

.editor-area {
  height: 0; /* flex-1 需要固定高度基准 */
}

.editor-footer {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
