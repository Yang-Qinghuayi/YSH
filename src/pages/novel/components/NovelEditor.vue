<template>
  <!-- CodeMirror 编辑区 -->
  <div ref="editorContainer" class="editor-area" />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, shallowRef } from "vue";
import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "vuetify";
import type { ChapterMeta, Novel } from "@/types/novel";

const props = defineProps<{
  novel: Novel | null;
  chapter: ChapterMeta | null;
  content: string;
  isGenerating: boolean;
}>();

const emit = defineEmits<{
  "update:content": [content: string];
  generate: [cursorPos: number, lineText: string];
  stopGenerate: [];
  "open-search": [];
}>();

const editorContainer = ref<HTMLElement | null>(null);
const editorView = shallowRef<EditorView | null>(null);

const vuetifyTheme = useTheme();
const isDark = computed(() => vuetifyTheme.global.current.value.dark);

// @提及 自动补全
function buildCompletions(context: CompletionContext): CompletionResult | null {
  if (!props.novel) return null;
  const word = context.matchBefore(/@[一-龥\w]*/);
  if (!word) return null;
  const options: { label: string; type: string; detail?: string }[] = [];

  for (const char of props.novel.characters) {
    options.push({ label: `@${char.name}`, type: "variable", detail: "角色" });
  }

  if (!options.length) return null;
  return { from: word.from, options, validFor: /@[一-龥\w]*/ };
}

function handleTab(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const lineText = line.text.trim();
  if (lineText.includes("@")) {
    emit("generate", pos, lineText);
    return true;
  }
  view.dispatch({
    changes: { from: pos, insert: "　" },
    selection: { anchor: pos + 1 },
  });
  return true;
}

function createEditor(content: string) {
  if (!editorContainer.value) return;

  const lightTheme = EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "15px",
      fontFamily: '"Noto Serif SC", "Source Han Serif", "Georgia", serif',
      background: "transparent",
    },
    ".cm-scroller": { overflow: "auto", lineHeight: "1.85" },
    ".cm-content": {
      padding: "24px 28px 100px",
      maxWidth: "740px",
      margin: "0 auto",
      caretColor: "rgb(var(--v-theme-primary))",
    },
    ".cm-line": { paddingLeft: "0", paddingRight: "0" },
    ".cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "rgb(var(--v-theme-primary))" },
    ".cm-completionLabel": { fontFamily: "inherit" },
    ".cm-selectionBackground": {
      background: "rgba(var(--v-theme-primary), 0.15) !important",
    },
  });

  const extensions = [
    markdown(),
    autocompletion({ override: [buildCompletions] }),
    keymap.of([
      { key: "Tab", run: handleTab },
      {
        key: "Escape",
        run: () => {
          if (props.isGenerating) {
            emit("stopGenerate");
            return true;
          }
          return false;
        },
      },
      {
        // Cmd+Shift+F（Mac）或 Ctrl+Shift+F（Win/Linux）唤起全局搜索
        key: "Mod-Shift-f",
        run: () => {
          emit("open-search");
          return true;
        },
      },
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        emit("update:content", update.state.doc.toString());
      }
    }),
    EditorView.lineWrapping,
    lightTheme,
    ...(isDark.value ? [oneDark] : []),
  ];

  const state = EditorState.create({ doc: content, extensions });
  editorView.value = new EditorView({ state, parent: editorContainer.value });
}

function appendContent(text: string) {
  const view = editorView.value;
  if (!view) return;
  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: { anchor: pos + text.length },
    effects: EditorView.scrollIntoView(pos + text.length, { y: "center" }),
  });
}

function moveCursorToNextLine() {
  const view = editorView.value;
  if (!view) return;
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const endOfLine = line.to;
  view.dispatch({
    changes: { from: endOfLine, insert: "\n" },
    selection: { anchor: endOfLine + 1 },
  });
}

/** 跳转到指定行（0-indexed），滚动到视口中央并聚焦 */
function jumpToLine(lineIndex: number) {
  const view = editorView.value;
  if (!view) return;
  const doc = view.state.doc;
  const lineNo = Math.max(1, Math.min(lineIndex + 1, doc.lines));
  const line = doc.line(lineNo);
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
  });
  view.focus();
}

defineExpose({ appendContent, moveCursorToNextLine, jumpToLine });

watch(
  () => [props.chapter?.id, props.content],
  ([newChapterId], [oldChapterId]) => {
    if (newChapterId !== oldChapterId) {
      editorView.value?.destroy();
      editorView.value = null;
      nextTick(() => createEditor(props.content));
    }
  },
);

watch(isDark, () => {
  const content = editorView.value?.state.doc.toString() ?? props.content;
  editorView.value?.destroy();
  editorView.value = null;
  nextTick(() => createEditor(content));
});

onMounted(() => {
  if (props.chapter) createEditor(props.content);
});

onBeforeUnmount(() => {
  editorView.value?.destroy();
});
</script>

<style scoped>
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

/* ====== 编辑区 ====== */
.editor-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor-area :deep(.cm-editor) {
  height: 100%;
}
.editor-area :deep(.cm-focused) {
  outline: none;
}
</style>
