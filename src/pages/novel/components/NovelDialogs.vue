<template>
  <!-- 小说页面的无布局弹窗层：每个弹窗只拿自己需要的数据和回调 -->
  <CharacterDialog
    v-if="currentNovel"
    v-model="showCharacterDialog"
    :characters="currentNovel.characters"
    @update:characters="handleUpdateCharacters"
  />

  <GlobalSearch
    v-if="currentNovel"
    v-model:visible="showGlobalSearch"
    :chapters="currentNovel.chapters"
    :search-fn="searchInChapters"
    @jump="handleSearchJump"
  />

  <CharacterPanel
    v-if="currentNovel"
    :characters="currentNovel.characters"
    :chapters="currentNovel.chapters"
    @update:character="handleUpdateSingleCharacter"
    @update:memory="handleUpdateShortTermMemory"
  />

  <LorePanel
    v-if="currentNovel"
    v-model:visible="showLorePanel"
    :novel="currentNovel"
    :focus-entry-id="pendingLoreEntryId"
    @saved="reloadLoreEntries"
  />

  <StoryStateDialog
    v-if="currentNovel"
    v-model="showStoryStateDialog"
    :novel-id="currentNovel.id"
    :characters="currentNovel.characters"
    :chapters="currentNovel.chapters"
    @revert="handleRevertLongTerm"
  />

  <ChapterSummaryDialog
    v-model="showChapterSummaryDialog"
    :chapter="currentChapterMeta"
    :finalizing="finalizing"
    :busy="chatStore.busy || isGenerating"
    @save="handleSaveChapterSummary"
    @finalize="finalizeFromSummaryDialog"
  />

  <ImportNovelDialog v-model:visible="showImportDialog" @imported="handleImported" />

  <EditorSettingsDialog />
</template>

<script setup lang="ts">
import GlobalSearch from '@/components/GlobalSearch.vue';

import {
  useAgentChatContext,
  useChapterEditingContext,
  useChapterFinalizationContext,
  useCharacterMemoryContext,
  useNovelUiContext,
  useNovelWorkspaceContext,
} from '../composables/context';
import ChapterSummaryDialog from './ChapterSummaryDialog.vue';
import CharacterDialog from './CharacterDialog.vue';
import CharacterPanel from './CharacterPanel.vue';
import EditorSettingsDialog from './EditorSettingsDialog.vue';
import ImportNovelDialog from './ImportNovelDialog.vue';
import LorePanel from './LorePanel.vue';
import StoryStateDialog from './StoryStateDialog.vue';

const ui = useNovelUiContext();
const workspace = useNovelWorkspaceContext();
const chapters = useChapterEditingContext();
const memory = useCharacterMemoryContext();
const chat = useAgentChatContext();
const finalization = useChapterFinalizationContext();

const {
  showCharacterDialog,
  showGlobalSearch,
  showLorePanel,
  showStoryStateDialog,
  showChapterSummaryDialog,
  showImportDialog,
} = ui;
const { currentNovel, pendingLoreEntryId, reloadLoreEntries, handleImported } = workspace;
const {
  currentChapterMeta,
  isGenerating,
  searchInChapters,
  handleSearchJump,
  handleSaveChapterSummary,
} = chapters;
const {
  handleUpdateCharacters,
  handleUpdateSingleCharacter,
  handleUpdateShortTermMemory,
  handleRevertLongTerm,
} = memory;
const { chatStore } = chat;
const { finalizing, finalizeFromSummaryDialog } = finalization;
</script>
