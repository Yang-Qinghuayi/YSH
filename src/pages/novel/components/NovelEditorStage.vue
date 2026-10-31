<template>
  <div class="editor-main flex-1 flex flex-col overflow-hidden">
    <NovelOverviewBar
      v-if="currentNovel"
      :novel="currentNovel"
      :has-chapter="!!currentChapter"
      @open-folder="handleOpenFolder"
      @view-state="showStoryStateDialog = true"
      @view-summary="showChapterSummaryDialog = true"
      @open-settings="showEditorSettings = true"
      @switch-novel="switchNovel"
    />

    <div v-if="!currentChapter" class="empty-stage">
      <div class="empty-card lg-card">
        <div class="empty-title">
          {{ currentNovel ? '开始创作新章节' : '开启你的第一部小说' }}
        </div>
        <div class="empty-sub">
          {{
            currentNovel
              ? '在左侧选择章节，或新建一章开始写作'
              : '在左侧新建一部小说，开启 AI 辅助写作之旅'
          }}
        </div>
        <div v-if="!currentNovel" class="empty-actions">
          <button class="lg-pill empty-btn" @click="switchNovel">
            <v-icon :icon="mdiPlus" size="16" /> 新建 / 打开小说
          </button>
          <button class="lg-pill empty-btn empty-btn--ghost" @click="showImportDialog = true">
            <v-icon :icon="mdiImport" size="16" /> 导入小说
          </button>
        </div>
      </div>
    </div>

    <NovelEditor
      v-else
      ref="editorRef"
      class="flex-1"
      style="min-height: 0"
      :chapter="currentChapter"
      :content="currentChapterContent"
      :characters="currentNovel?.characters ?? []"
      :is-generating="isGenerating"
      @update:content="handleContentChange"
      @stop-generate="$emit('stop')"
      @open-search="showGlobalSearch = true"
    />
  </div>
</template>

<script setup lang="ts">
import { mdiImport, mdiPlus } from '@mdi/js';

import {
  useChapterEditingContext,
  useNovelUiContext,
  useNovelWorkspaceContext,
} from '../composables/context';
import NovelEditor from './NovelEditor.vue';
import NovelOverviewBar from './NovelOverviewBar.vue';

defineEmits<{ stop: [] }>();

const ui = useNovelUiContext();
const workspace = useNovelWorkspaceContext();
const chapters = useChapterEditingContext();

const {
  showStoryStateDialog,
  showChapterSummaryDialog,
  showEditorSettings,
  showGlobalSearch,
  showImportDialog,
} = ui;
const { currentNovel, switchNovel, handleOpenFolder } = workspace;
const { currentChapter, currentChapterContent, isGenerating, editorRef, handleContentChange } =
  chapters;
</script>
