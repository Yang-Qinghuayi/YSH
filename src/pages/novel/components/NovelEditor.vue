<template>
  <!-- CodeMirror 编辑区 -->
  <div ref="editorContainer" class="editor-area" />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, shallowRef } from "vue";
import {
  EditorView,
  keymap,
  ViewUpdate,
  placeholder,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "vuetify";
import { useSettingStore } from "@/store/setting";
import type { ChapterMeta, Character } from "@/types/novel";

const props = defineProps<{
  chapter: ChapterMeta | null;
  content: string;
  characters: Character[];
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
const settingStore = useSettingStore();
const isDark = computed(() => vuetifyTheme.global.current.value.dark);

/** @角色 补全：输入 @ 后按角色档案提示，选中即写入 @角色名（供 Agent 强制指定） */
function mentionCompletion(context: CompletionContext) {
  const before = context.matchBefore(/@[\u4e00-\u9fff\w]*/);
  if (!before) return null;
  if (before.from === before.to && !context.explicit) return null;
  const options = props.characters.map((c) => ({
    label: `@${c.name}`,
    detail: c.literaryReference || c.profile?.slice(0, 24) || undefined,
    type: 'variable',
  }));
  if (!options.length) return null;
  return {
    from: before.from,
    options,
    validFor: /^@[\u4e00-\u9fff\w]*$/,
  };
}

function handleTab(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const lineText = line.text.trim();
  if (lineText) {
    emit("generate", pos, line.text);
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
      fontSize: `${settingStore.editorFontSize}px`,
      fontFamily: 'var(--font-sans)',
      background: "transparent",
    },
    ".cm-scroller": {
      overflow: "auto",
      lineHeight: "1.85",
      fontFamily: "var(--font-sans)",
    },
    ".cm-content": {
      padding: "24px 28px 100px",
      maxWidth: "740px",
      margin: "0 auto",
      caretColor: "rgb(var(--v-theme-primary))",
    },
    ".cm-line": { paddingLeft: "0", paddingRight: "0" },
    ".cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "rgb(var(--v-theme-primary))" },
    ".cm-selectionBackground": {
      background: "rgba(var(--v-theme-primary), 0.15) !important",
    },
  });

  const extensions = [
    markdown(),
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
    autocompletion({
      override: [mentionCompletion],
      activateOnTyping: true,
      icons: false,
    }),
    placeholder('写下来吧……'),
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

watch(() => settingStore.editorFontSize, () => {
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
/* ====== 标题栏 ====== */
.editor-header {
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  background: rgb(var(--v-theme-surface));
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
.editor-area :deep(.cm-placeholder) {
  color: rgba(var(--v-theme-on-surface), 0.28);
  font-style: italic;
}
</style>
