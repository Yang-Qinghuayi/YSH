<template>
  <div class="novel-editor d-flex flex-column h-100">
    <!-- 章节标题栏 -->
    <div class="editor-header d-flex align-center px-4 py-2 gap-2">
      <span class="text-body-1 font-weight-medium">{{ chapter?.title ?? '请选择章节' }}</span>
      <v-spacer />
      <span v-if="isDirty" class="text-caption text-medium-emphasis">未保存</span>
      <v-btn
        v-if="isDirty"
        size="small"
        variant="tonal"
        color="primary"
        :loading="isSaving"
        @click="emit('save')"
      >
        保存
      </v-btn>
    </div>

    <!-- CodeMirror 编辑区 -->
    <div ref="editorContainer" class="editor-area flex-1 overflow-hidden" />

    <!-- AI 生成状态提示 -->
    <v-expand-transition>
      <div v-if="isGenerating" class="generating-bar px-4 py-2 d-flex align-center gap-2">
        <v-progress-circular indeterminate size="16" width="2" color="primary" />
        <span class="text-caption">AI 正在生成...</span>
        <v-spacer />
        <v-btn size="x-small" variant="text" @click="emit('stopGenerate')">停止（Esc）</v-btn>
      </div>
    </v-expand-transition>

    <!-- 底部提示 -->
    <div class="editor-footer px-4 py-1 text-caption text-medium-emphasis">
      输入 <kbd>@</kbd> 引用角色技能或剧情技能，光标在 @提及 行时按 <kbd>Tab</kbd> 触发 AI 生成
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { EditorView, keymap, ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from 'vuetify'
import type { ChapterMeta, Novel } from '@/types/novel'

const props = defineProps<{
  novel: Novel | null
  chapter: ChapterMeta | null
  content: string
  isGenerating: boolean
  isDirty: boolean
}>()

const emit = defineEmits<{
  'update:content': [content: string]
  save: []
  generate: [cursorPos: number, lineText: string]
  stopGenerate: []
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
const isSaving = ref(false)

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

// @提及 自动补全
function buildCompletions(context: CompletionContext): CompletionResult | null {
  if (!props.novel) return null

  // 匹配光标前的 @ 开头文本
  const word = context.matchBefore(/@[一-龥\w]*(?:\.[一-龥\w]*)?/)
  if (!word) return null

  const text = word.text.slice(1) // 去掉 @
  const dotIndex = text.indexOf('.')

  const options: { label: string; type: string; detail?: string }[] = []

  if (dotIndex === -1) {
    // @前缀匹配：列出所有角色名 + 剧情技能名
    for (const char of props.novel.characters) {
      options.push({ label: `@${char.name}`, type: 'variable', detail: '角色' })
    }
    for (const skill of props.novel.plotSkills) {
      options.push({ label: `@${skill.name}`, type: 'function', detail: '剧情技能' })
    }
  } else {
    // @角色名.技能前缀：列出该角色的技能
    const charName = text.slice(0, dotIndex)
    const char = props.novel.characters.find((c) => c.name === charName)
    if (char) {
      for (const skill of char.skills) {
        options.push({ label: `@${charName}.${skill.name}`, type: 'method', detail: skill.prompt.slice(0, 30) + '...' })
      }
    }
  }

  if (!options.length) return null

  return {
    from: word.from,
    options,
    validFor: /@[一-龥\w]*(?:\.[一-龥\w]*)*/,
  }
}

// Tab 键处理：在 @提及 行触发 AI 生成，否则插入缩进
function handleTab(view: EditorView): boolean {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const lineText = line.text.trim()

  // 如果当前行包含 @提及，触发 AI 生成
  if (lineText.includes('@')) {
    emit('generate', pos, lineText)
    return true
  }

  // 否则插入两个空格（Markdown 段落缩进）
  view.dispatch({
    changes: { from: pos, insert: '　' }, // 全角空格（中文首行缩进）
    selection: { anchor: pos + 1 },
  })
  return true
}

// 创建编辑器
function createEditor(content: string) {
  if (!editorContainer.value) return

  const extensions = [
    markdown(),
    autocompletion({ override: [buildCompletions] }),
    keymap.of([
      {
        key: 'Tab',
        run: handleTab,
      },
      {
        key: 'Escape',
        run: () => {
          if (props.isGenerating) {
            emit('stopGenerate')
            return true
          }
          return false
        },
      },
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        emit('update:content', update.state.doc.toString())
      }
    }),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': { height: '100%', fontSize: '15px', fontFamily: '"Noto Serif SC", "Source Han Serif", serif' },
      '.cm-scroller': { overflow: 'auto', lineHeight: '1.8' },
      '.cm-content': { padding: '16px 20px', maxWidth: '720px', margin: '0 auto' },
      '.cm-line': { paddingLeft: '0', paddingRight: '0' },
      // @提及 高亮
      '.cm-completionLabel': { fontFamily: 'inherit' },
    }),
    // 根据主题切换暗色主题
    ...(isDark.value ? [oneDark] : []),
  ]

  const state = EditorState.create({
    doc: content,
    extensions,
  })

  editorView.value = new EditorView({
    state,
    parent: editorContainer.value,
  })
}

// 外部更新内容（AI 生成时追加文字）
function appendContent(text: string) {
  const view = editorView.value
  if (!view) return
  const pos = view.state.selection.main.head
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
  })
}

// 将光标移到当前章节末尾（清空 @提及 块后）
function moveCursorToNextLine() {
  const view = editorView.value
  if (!view) return
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const endOfLine = line.to
  // 在 @提及 行后插入换行并移过去
  view.dispatch({
    changes: { from: endOfLine, insert: '\n' },
    selection: { anchor: endOfLine + 1 },
  })
}

// 暴露给父组件
defineExpose({ appendContent, moveCursorToNextLine })

// 章节切换时重建编辑器
watch(
  () => [props.chapter?.id, props.content],
  ([newChapterId], [oldChapterId]) => {
    if (newChapterId !== oldChapterId) {
      editorView.value?.destroy()
      editorView.value = null
      nextTick(() => createEditor(props.content))
    }
  },
)

// 主题切换时重建
watch(isDark, () => {
  const content = editorView.value?.state.doc.toString() ?? props.content
  editorView.value?.destroy()
  editorView.value = null
  nextTick(() => createEditor(content))
})

onMounted(() => {
  if (props.chapter) {
    createEditor(props.content)
  }
})

onBeforeUnmount(() => {
  editorView.value?.destroy()
})
</script>

<style scoped>
.novel-editor {
  overflow: hidden;
}

.editor-header {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  flex-shrink: 0;
}

.editor-area {
  overflow: hidden;
}

.editor-area :deep(.cm-editor) {
  height: 100%;
}

.editor-area :deep(.cm-focused) {
  outline: none;
}

.generating-bar {
  background: rgba(var(--v-theme-primary), 0.06);
  border-top: 1px solid rgba(var(--v-theme-primary), 0.2);
  flex-shrink: 0;
}

.editor-footer {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  flex-shrink: 0;
}

kbd {
  background: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 3px;
  padding: 0 4px;
  font-size: 11px;
  font-family: monospace;
}
</style>
