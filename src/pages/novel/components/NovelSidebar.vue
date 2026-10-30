<template>
  <aside
    class="novel-sidebar lg-scroll"
    :class="{
      'novel-sidebar--rail': sidebarCollapsed,
      'novel-sidebar--agent': !sidebarCollapsed && sidebarTab === 'agent',
    }"
  >
    <div v-if="sidebarCollapsed" class="rail">
      <button class="lg-icon-btn rail-toggle" title="展开侧栏" @click="sidebarCollapsed = false">
        <v-icon :icon="mdiMenuClose" size="18" />
      </button>
      <button
        class="rail-avatar"
        :class="{ 'rail-avatar--active': currentNovel }"
        :title="currentNovel ? currentNovel.title : '切换小说'"
        @click="switchNovel"
      >
        {{ currentNovel ? currentNovel.title.slice(0, 1) : '书' }}
      </button>
      <button
        class="lg-icon-btn"
        :class="{ 'rail-active': sidebarTab === 'agent' }"
        title="Agent"
        :disabled="!currentNovel"
        @click="openAgentTab"
      >
        <v-icon :icon="mdiRobotOutline" size="18" />
      </button>
      <button
        class="lg-icon-btn"
        title="章节"
        :disabled="!currentNovel"
        @click="sidebarCollapsed = false"
      >
        <v-icon :icon="mdiFormatListBulleted" size="18" />
      </button>
      <button class="lg-icon-btn" title="角色" :disabled="!currentNovel" @click="openCharacters">
        <v-icon :icon="mdiAccountGroupOutline" size="18" />
      </button>
      <button class="lg-icon-btn" title="设定" :disabled="!currentNovel" @click="openLore">
        <v-icon :icon="mdiBookshelf" size="18" />
      </button>
    </div>

    <template v-else>
      <div class="sidebar-tabs lg-card">
        <button
          class="sidebar-tab"
          :class="{ 'sidebar-tab--active': sidebarTab === 'menu' }"
          @click="sidebarTab = 'menu'"
        >
          <v-icon :icon="mdiFormatListBulleted" size="13" /> 目录
        </button>
        <button
          class="sidebar-tab"
          :class="{ 'sidebar-tab--active': sidebarTab === 'agent' }"
          @click="sidebarTab = 'agent'"
        >
          <v-icon :icon="mdiRobotOutline" size="13" /> Agent
        </button>
        <button
          class="lg-icon-btn collapse-inline"
          title="折叠侧栏"
          @click="sidebarCollapsed = true"
        >
          <v-icon :icon="mdiMenuOpen" size="16" />
        </button>
      </div>

      <AgentChatPanel
        v-if="sidebarTab === 'agent' && currentNovel"
        class="agent-sidebar-card lg-card flex-1-1"
        :novel="currentNovel"
        :chapter="currentChapterMeta"
        :content-length="currentChapterContent.length"
        @send="handleChatSend"
        @quick-action="handleChatQuickAction"
        @stop="$emit('stop')"
        @confirm-plan="handleChatConfirmPlan"
        @cancel-plan="handleChatCancelPlan"
        @undo-write="handleChatUndoWrite"
        @clear-chat="handleChatClear"
        @finalize="finalize"
      />
      <div
        v-else-if="sidebarTab === 'agent'"
        class="agent-sidebar-card lg-card d-flex align-center justify-center flex-1-1"
      >
        <span class="empty-hint">未打开小说</span>
      </div>

      <NovelSidebarDirectory
        v-else
        :novel="currentNovel"
        :current-chapter-id="currentChapter?.id"
        :lore-entries="loreEntries"
        @select="handleSelectChapter"
        @delete="handleDeleteChapter"
        @create="handleCreateChapter"
        @switch-novel="switchNovel"
        @import-novel="showImportDialog = true"
        @open-characters="openCharacters"
        @open-lore="openLore"
        @open-character-panel="novelUiStore.openCharacterPanel"
        @open-lore-at="openLoreAt"
      />
    </template>
  </aside>
</template>

<script setup lang="ts">
import {
  mdiAccountGroupOutline,
  mdiBookshelf,
  mdiFormatListBulleted,
  mdiMenuClose,
  mdiMenuOpen,
  mdiRobotOutline,
} from '@mdi/js';

import { useNovelUiStore } from '@/store/novelUiStore';

import {
  useAgentChatContext,
  useChapterEditingContext,
  useChapterFinalizationContext,
  useNovelUiContext,
  useNovelWorkspaceContext,
} from '../composables/context';
import AgentChatPanel from './AgentChatPanel.vue';
import NovelSidebarDirectory from './NovelSidebarDirectory.vue';

defineEmits<{ stop: [] }>();

const ui = useNovelUiContext();
const workspace = useNovelWorkspaceContext();
const chapters = useChapterEditingContext();
const chat = useAgentChatContext();
const finalization = useChapterFinalizationContext();
const novelUiStore = useNovelUiStore();

const { sidebarCollapsed, sidebarTab, showImportDialog } = ui;
const { openAgentTab, openCharacters, openLore } = ui;
const { currentNovel, loreEntries, switchNovel, openLoreAt } = workspace;
const {
  currentChapter,
  currentChapterMeta,
  currentChapterContent,
  handleSelectChapter,
  handleDeleteChapter,
  handleCreateChapter,
} = chapters;
const {
  handleChatSend,
  handleChatQuickAction,
  handleChatConfirmPlan,
  handleChatCancelPlan,
  handleChatUndoWrite,
  handleChatClear,
} = chat;
const { finalize } = finalization;
</script>
