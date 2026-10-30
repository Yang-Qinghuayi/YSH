/**
 * useNovelWorkspace.ts
 * 小说工作区：初始化、打开/切换小说、文件夹入口、导入完成、Lore 条目缓存。
 * 章节编辑与 Agent 会话通过回调交给各自模块，避免在这里形成第二个上帝组件。
 */

import { openPath } from '@tauri-apps/plugin-opener';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';

import { loadOrCreateLore } from '@/services/loreService';
import { createNovel, loadCurrentNovel } from '@/services/novelService';
import { loadStoryState } from '@/services/storyStateService';
import { getDirName, getWorkspaceDir, isWorkspaceInitialized } from '@/services/workspaceService';
import { useNovelStore } from '@/store/novelStore';
import { useNovelUiStore } from '@/store/novelUiStore';
import type { Novel } from '@/types/novel';

import type { NovelWorkspaceDeps } from './types';

export function useNovelWorkspace(deps: NovelWorkspaceDeps) {
  const novelStore = useNovelStore();
  const novelUiStore = useNovelUiStore();
  const { currentNovel } = storeToRefs(novelStore);

  const workspaceReady = ref(isWorkspaceInitialized());
  const pendingLoreEntryId = ref<string | null>(null);

  async function loadLoreEntries(novel: Novel) {
    try {
      const lore = await loadOrCreateLore(novel);
      deps.loreEntries.value = lore.entries;
    } catch {
      deps.loreEntries.value = [];
    }
  }

  function reloadLoreEntries() {
    if (currentNovel.value) void loadLoreEntries(currentNovel.value);
  }

  function openLoreAt(entryId: string) {
    pendingLoreEntryId.value = entryId;
    deps.showLorePanel.value = true;
  }

  async function loadCurrentNovelData(title?: string) {
    try {
      let novel = await loadCurrentNovel();
      if (!novel) {
        const dir = getWorkspaceDir();
        const fallbackTitle =
          title || (dir ? await getDirName(dir).catch(() => '未命名小说') : '未命名小说');
        novel = await createNovel(fallbackTitle, '');
      }
      novelStore.openNovel(novel);
      loadStoryState(novel.id)
        .then((state) => novelUiStore.setStoryState(state))
        .catch(() => {});
      void loadLoreEntries(novel);
      deps.onNovelLoaded(novel);
    } catch (e) {
      deps.notify.error('加载小说失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleWorkspaceReady(title?: string) {
    workspaceReady.value = true;
    await loadCurrentNovelData(title);
  }

  async function switchNovel() {
    await deps.beforeLeaveNovel();
    novelStore.openNovel(null);
    deps.loreEntries.value = [];
    pendingLoreEntryId.value = null;
    workspaceReady.value = false;
  }

  async function handleOpenFolder() {
    const dir = getWorkspaceDir();
    if (!dir) return;
    try {
      await openPath(dir);
    } catch (e) {
      deps.notify.error('打开文件夹失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleImported() {
    deps.showImportDialog.value = false;
    await loadCurrentNovelData();
  }

  onMounted(() => {
    if (workspaceReady.value) void loadCurrentNovelData();
  });

  return {
    workspaceReady,
    pendingLoreEntryId,
    currentNovel,
    loreEntries: deps.loreEntries,
    loadCurrentNovelData,
    handleWorkspaceReady,
    switchNovel,
    handleOpenFolder,
    handleImported,
    loadLoreEntries,
    reloadLoreEntries,
    openLoreAt,
  };
}
