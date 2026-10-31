/**
 * useNovelPageController.ts
 * 小说页面的组装根：创建各领域控制器、注入窄 context、处理跨模块的停止动作。
 * index.vue 只做布局，不再包含业务细节。
 */

import { onBeforeUnmount, provide, ref, watch } from 'vue';

import type { EntryMeta } from '@/types/lore';

import {
  type AgentChatController,
  agentChatKey,
  type ChapterEditingController,
  chapterEditingKey,
  type ChapterFinalizationController,
  chapterFinalizationKey,
  characterMemoryKey,
  novelUiKey,
  novelWorkspaceKey,
} from './context';
import { useAgentChatController } from './useAgentChatController';
import { useChapterEditing } from './useChapterEditing';
import { useChapterFinalization } from './useChapterFinalization';
import { useCharacterMemory } from './useCharacterMemory';
import { useNovelUiState } from './useNovelUiState';
import { useNovelWorkspace } from './useNovelWorkspace';

interface DeferredControllers {
  chapters: ChapterEditingController;
  chat: AgentChatController;
  finalization: ChapterFinalizationController;
}

export function useNovelPageController() {
  const ui = useNovelUiState();
  const notify = { error: ui.error, warn: ui.warn };
  const loreEntries = ref<EntryMeta[]>([]);

  // 这三个控制器互相需要对方的回调；用延迟绑定避免构造期循环依赖。
  const controllers = {} as DeferredControllers;

  const workspace = useNovelWorkspace({
    notify,
    loreEntries,
    showLorePanel: ui.showLorePanel,
    showImportDialog: ui.showImportDialog,
    beforeLeaveNovel: async () => {
      await controllers.chapters.trySaveCurrentChapter();
      controllers.chat.resetForNovelSwitch();
    },
    onNovelLoaded: (novel) => {
      void controllers.chapters.loadMissingWordCounts(novel);
      // 进入页面即打开最新一章，避免主区停在空白提示上；无章节时回到 Agent 空白会话
      void controllers.chapters.openLatestChapter().then((opened) => {
        if (!opened) void controllers.chat.loadChatSessionForChapter();
      });
    },
  });

  controllers.chapters = useChapterEditing({
    notify,
    showGlobalSearch: ui.showGlobalSearch,
    onChapterChanged: () => void controllers.chat.loadChatSessionForChapter(),
  });

  const memory = useCharacterMemory({
    notify,
    isBusy: () => controllers.chat.chatStore.busy,
  });

  controllers.chat = useAgentChatController({
    notify,
    apiKey: ui.apiKey,
    buildAgentConfig: ui.buildAgentConfig,
    getEditor: () => controllers.chapters.editorRef.value,
  });

  controllers.finalization = useChapterFinalization({
    notify,
    buildAgentConfig: ui.buildAgentConfig,
    saveCurrentChapter: controllers.chapters.trySaveCurrentChapter,
    patchChapterMeta: controllers.chapters.patchChapterMeta,
    syncCharactersFromDisk: memory.syncCharactersFromDisk,
    persistChatSession: controllers.chat.persistChatSession,
    refreshStoryState: controllers.chat.refreshStoryState,
    focusAgentTab: ui.openAgentTab,
  });

  provide(novelUiKey, ui);
  provide(novelWorkspaceKey, workspace);
  provide(chapterEditingKey, controllers.chapters);
  provide(characterMemoryKey, memory);
  provide(agentChatKey, controllers.chat);
  provide(chapterFinalizationKey, controllers.finalization);

  /** 编辑器 Esc / 面板停止按钮：优先停止定稿，否则停止当前对话轮次 */
  function handleStopAgent() {
    if (controllers.finalization.stop()) return;
    controllers.chat.stopChat();
  }

  // 切到 Agent 面板时若主区还没打开章节（例如刚删掉当前章），同样自动打开最新一章
  watch(ui.sidebarTab, (tab) => {
    if (tab === 'agent') void controllers.chapters.openLatestChapter();
  });

  onBeforeUnmount(() => controllers.chat.abortOnUnmount());

  return {
    ui,
    workspace,
    chapters: controllers.chapters,
    memory,
    chat: controllers.chat,
    finalization: controllers.finalization,
    loreEntries,
    handleStopAgent,
  };
}
