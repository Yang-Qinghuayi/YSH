<template>
  <div class="entry-editor d-flex flex-column h-100">
    <!-- 顶部元数据表单 -->
    <div class="entry-meta-form flex-shrink-0">
      <!-- 重要度 + 启用 -->
      <div class="d-flex align-center flex-wrap gap-2 mb-2">
        <v-select
          :model-value="entry.importance"
          :items="importanceOptions"
          item-title="label"
          item-value="value"
          label="重要度"
          density="compact"
          variant="outlined"
          rounded="xl"
          color="primary"
          hide-details
          style="max-width: 120px"
          @update:model-value="handleMetaChange('importance', $event)"
        />
        <!-- 自定义启用切换，确保 off 状态清晰可见 -->
        <button
          class="enabled-toggle"
          :class="{ 'is-on': entry.enabled }"
          @click="handleMetaChange('enabled', !entry.enabled)"
        >
          <span class="et-track"><span class="et-thumb" /></span>
          <span class="et-label">{{ entry.enabled ? 'AI 读取中' : 'AI 不读取' }}</span>
        </button>
      </div>

      <!-- 简介 -->
      <v-textarea
        :model-value="entry.briefDescription"
        label="索引简介（3-5 句，供 AI 快速参考）"
        density="compact"
        variant="outlined"
        rounded="xl"
        color="primary"
        hide-details
        rows="2"
        auto-grow
        class="mb-2"
        @update:model-value="handleMetaChange('briefDescription', $event)"
      />

      <!-- 关键词 -->
      <v-combobox
        :model-value="entry.keywords"
        label="别名 / 触发词"
        density="compact"
        variant="outlined"
        rounded="xl"
        color="primary"
        hide-details
        multiple
        chips
        closable-chips
        @update:model-value="handleMetaChange('keywords', $event)"
      />
    </div>

    <!-- CodeMirror 正文编辑区 -->
    <div ref="editorContainer" class="editor-area flex-1 overflow-hidden" />

    <!-- 底部提示 -->
    <div class="editor-footer">
      <span class="lg-section-label">在此编写条目正文（支持 Markdown），内容会注入到 AI 写作上下文中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { EditorView, ViewUpdate, placeholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from 'vuetify'
import type { EntryMeta, EntryImportance } from '@/types/lore'
import { ENTRY_IMPORTANCE_LABELS } from '@/types/lore'

const props = defineProps<{
  entry: EntryMeta
  content: string
}>()

const emit = defineEmits<{
  'update:content': [content: string]
  'update:meta': [patch: Partial<EntryMeta>]
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

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
    placeholder('在此编写条目正文…'),
    EditorView.theme({
      '&': { height: '100%', fontSize: '15px' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', lineHeight: '1.8' },
      '.cm-content': { maxWidth: '720px', margin: '0 auto', padding: '16px 24px 80px' },
      '.cm-line': { padding: '0' },
      '.cm-focused': { outline: 'none' },
      '.cm-placeholder': { color: 'rgba(var(--v-theme-on-surface), 0.3)', fontStyle: 'italic' },
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
  padding: 12px;
  gap: 12px;
}

.entry-meta-form {
  padding: 8px 4px 0;
}

/* ---- 自定义启用切换 ---- */
.enabled-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  border: none;
  background: none;
  padding: 2px 0;
  user-select: none;
}

.et-track {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: 1.5px solid rgba(var(--v-theme-on-surface), 0.28);
  background: rgba(var(--v-theme-on-surface), 0.07);
  position: relative;
  flex-shrink: 0;
  transition: background 0.22s ease, border-color 0.22s ease;
}
.is-on .et-track {
  background: rgb(var(--v-theme-primary));
  border-color: transparent;
}

.et-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.4);
  transition: left 0.22s ease, background 0.22s ease;
}
.is-on .et-thumb {
  left: 19px;
  background: #fff;
}

.et-label {
  font-size: 12.5px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.45);
  transition: color 0.22s ease;
}
.is-on .et-label {
  color: rgb(var(--v-theme-primary));
}

.editor-area {
  height: 0; /* flex-1 需要固定高度基准 */
  border-radius: 14px;
}

.editor-footer {
  padding: 4px 4px 0;
  text-align: center;
}
</style>
