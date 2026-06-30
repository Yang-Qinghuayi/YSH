<template>
  <div class="novel-editor d-flex flex-column h-100">

    <!-- 章节标题栏 -->
    <div class="editor-header d-flex align-center px-5 gap-3">
      <span class="editor-title text-truncate">{{ chapter?.title ?? '请选择章节' }}</span>
      <v-spacer />
      <transition name="fade">
        <span v-if="isDirty" class="save-hint">未保存</span>
      </transition>
      <transition name="fade">
        <v-btn
          v-if="isDirty"
          size="small"
          variant="tonal"
          color="primary"
          rounded="pill"
          :loading="isSaving"
          @click="emit('save')"
        >
          保存
        </v-btn>
      </transition>
    </div>

    <!-- CodeMirror 编辑区 -->
    <div ref="editorContainer" class="editor-area flex-1 overflow-hidden" />

    <!-- AI 生成状态提示 — 悬浮胶囊 -->
    <transition name="slide-up">
      <div v-if="isGenerating" class="generating-pill">
        <v-progress-circular indeterminate size="14" width="2" color="primary" />
        <span class="generating-label">AI 正在生成…</span>
        <button class="stop-btn" @click="emit('stopGenerate')">停止</button>
      </div>
    </transition>

    <!-- 底部提示 -->
    <div class="editor-footer">
      输入 <kbd>@</kbd> 引用角色或技能，在 @提及 行按 <kbd>Tab</kbd> 触发 AI 续写
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
  'open-search': []
}>()

const editorContainer = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
const isSaving = ref(false)

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

// @提及 自动补全
function buildCompletions(context: CompletionContext): CompletionResult | null {
  if (!props.novel) return null
  const word = context.matchBefore(/@[一-龥\w]*/)
  if (!word) return null
  const options: { label: string; type: string; detail?: string }[] = []

  for (const char of props.novel.characters) {
    options.push({ label: `@${char.name}`, type: 'variable', detail: '角色' })
  }
  for (const skill of props.novel.plotSkills) {
    options.push({ label: `@${skill.name}`, type: 'function', detail: '剧情技能' })
  }

  if (!options.length) return null
  return { from: word.from, options, validFor: /@[一-龥\w]*/ }
}

function handleTab(view: EditorView): boolean {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const lineText = line.text.trim()
  if (lineText.includes('@')) {
    emit('generate', pos, lineText)
    return true
  }
  view.dispatch({
    changes: { from: pos, insert: '　' },
    selection: { anchor: pos + 1 },
  })
  return true
}

function createEditor(content: string) {
  if (!editorContainer.value) return

  const lightTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '15px',
      fontFamily: '"Noto Serif SC", "Source Han Serif", "Georgia", serif',
      background: 'transparent',
    },
    '.cm-scroller': { overflow: 'auto', lineHeight: '1.85' },
    '.cm-content': {
      padding: '24px 28px 100px',
      maxWidth: '740px',
      margin: '0 auto',
      caretColor: 'rgb(var(--v-theme-primary))',
    },
    '.cm-line': { paddingLeft: '0', paddingRight: '0' },
    '.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: 'rgb(var(--v-theme-primary))' },
    '.cm-completionLabel': { fontFamily: 'inherit' },
    '.cm-selectionBackground': {
      background: 'rgba(var(--v-theme-primary), 0.15) !important',
    },
  })

  const extensions = [
    markdown(),
    autocompletion({ override: [buildCompletions] }),
    keymap.of([
      { key: 'Tab', run: handleTab },
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
      {
        // Cmd+Shift+F（Mac）或 Ctrl+Shift+F（Win/Linux）唤起全局搜索
        key: 'Mod-Shift-f',
        run: () => {
          emit('open-search')
          return true
        },
      },
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        emit('update:content', update.state.doc.toString())
      }
    }),
    EditorView.lineWrapping,
    lightTheme,
    ...(isDark.value ? [oneDark] : []),
  ]

  const state = EditorState.create({ doc: content, extensions })
  editorView.value = new EditorView({ state, parent: editorContainer.value })
}

function appendContent(text: string) {
  const view = editorView.value
  if (!view) return
  const pos = view.state.selection.main.head
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
  })
}

function moveCursorToNextLine() {
  const view = editorView.value
  if (!view) return
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const endOfLine = line.to
  view.dispatch({
    changes: { from: endOfLine, insert: '\n' },
    selection: { anchor: endOfLine + 1 },
  })
}

/** 跳转到指定行（0-indexed），滚动到视口中央并聚焦 */
function jumpToLine(lineIndex: number) {
  const view = editorView.value
  if (!view) return
  const doc = view.state.doc
  // doc.line 是 1-indexed，clamp 到合法范围
  const lineNo = Math.max(1, Math.min(lineIndex + 1, doc.lines))
  const line = doc.line(lineNo)
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  })
  view.focus()
}

defineExpose({ appendContent, moveCursorToNextLine, jumpToLine })

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

watch(isDark, () => {
  const content = editorView.value?.state.doc.toString() ?? props.content
  editorView.value?.destroy()
  editorView.value = null
  nextTick(() => createEditor(content))
})

onMounted(() => {
  if (props.chapter) createEditor(props.content)
})

onBeforeUnmount(() => {
  editorView.value?.destroy()
})
</script>

<style scoped>
/* ====== 整体容器 ====== */
.novel-editor {
  overflow: hidden;
}

/* ====== 标题栏 — 磨砂玻璃 ====== */
.editor-header {
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  background: rgba(var(--v-theme-surface), 0.85);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}

.editor-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.78);
  max-width: 300px;
}

.save-hint {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  letter-spacing: 0.01em;
}

/* ====== 编辑区 ====== */
.editor-area {
  overflow: hidden;
}
.editor-area :deep(.cm-editor) {
  height: 100%;
}
.editor-area :deep(.cm-focused) {
  outline: none;
}

/* ====== AI 生成胶囊 — 悬浮 ====== */
.generating-pill {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px 7px 12px;
  border-radius: 999px;
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  z-index: 10;
  white-space: nowrap;
}

.generating-label {
  font-size: 12.5px;
  color: rgba(var(--v-theme-on-surface), 0.75);
}

.stop-btn {
  font-size: 12px;
  color: rgba(var(--v-theme-primary), 0.9);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-weight: 500;
  transition: opacity 0.15s ease;
}
.stop-btn:hover {
  opacity: 0.7;
}

/* ====== 底部提示栏 ====== */
.editor-footer {
  flex-shrink: 0;
  padding: 6px 24px;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.05);
  background: rgba(var(--v-theme-surface), 0.5);
  letter-spacing: 0.01em;
}

/* ====== 键盘快捷键 ====== */
kbd {
  display: inline-block;
  background: rgba(var(--v-theme-on-surface), 0.07);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 0px 5px;
  font-size: 10.5px;
  font-family: ui-monospace, 'SF Mono', 'Menlo', monospace;
  color: rgba(var(--v-theme-on-surface), 0.55);
  line-height: 1.6;
}

/* ====== 过渡动画 ====== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
