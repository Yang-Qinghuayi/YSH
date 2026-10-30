/**
 * useNovelUiState.ts
 * 小说页面的纯 UI 状态：侧栏、弹窗、snackbar、API Key 与 Agent 配置。
 * 不读写小说文件，也不调用 Agent 引擎。
 */

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useApiKey } from '@/hooks/useApiKey';
import { useDialogEsc } from '@/hooks/useDialogEsc';
import { useNovelStore } from '@/store/novelStore';
import { useSettingStore } from '@/store/setting';
import type { AgentConfig } from '@/types/agent';

export type SidebarTab = 'menu' | 'agent';

export function useNovelUiState() {
  const settingStore = useSettingStore();
  const novelStore = useNovelStore();
  const { apiKey, remember: rememberApiKey, clear: clearApiKey } = useApiKey();

  const sidebarCollapsed = ref(false);
  const sidebarTab = ref<SidebarTab>('menu');
  const showCharacterDialog = ref(false);
  const showGlobalSearch = ref(false);
  const showApiKey = ref(false);
  const showLorePanel = ref(false);
  const showImportDialog = ref(false);
  const showStoryStateDialog = ref(false);
  const showChapterSummaryDialog = ref(false);
  const showEditorSettings = ref(false);

  const showError = ref(false);
  const errorMessage = ref('');
  const snackColor = ref<'error' | 'warning'>('error');

  useDialogEsc(showEditorSettings);

  const modelOptions = [
    { title: 'deepseek-chat（通用，速度快）', value: 'deepseek-chat' },
    { title: 'deepseek-reasoner（深度推理，更慢）', value: 'deepseek-reasoner' },
  ];

  function error(message: string) {
    snackColor.value = 'error';
    errorMessage.value = message;
    showError.value = true;
  }

  function warn(message: string) {
    snackColor.value = 'warning';
    errorMessage.value = message;
    showError.value = true;
  }

  function openAgentTab() {
    sidebarCollapsed.value = false;
    sidebarTab.value = 'agent';
  }

  function openCharacters() {
    sidebarCollapsed.value = false;
    showCharacterDialog.value = true;
  }

  function openLore() {
    sidebarCollapsed.value = false;
    showLorePanel.value = true;
  }

  function buildAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
      apiKey: apiKey.value,
      model: settingStore.deepseekModel,
      lengthTarget: settingStore.agentWriteLength,
      ...overrides,
    };
  }

  let removeSearchShortcut: (() => void) | null = null;
  onMounted(() => {
    // 独立监听，绕过 useShortcuts 的 contentEditable 过滤
    const handleGlobalSearchKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'F') {
        event.preventDefault();
        if (novelStore.currentNovel) showGlobalSearch.value = true;
      }
    };
    window.addEventListener('keydown', handleGlobalSearchKey);
    removeSearchShortcut = () => window.removeEventListener('keydown', handleGlobalSearchKey);
  });
  onBeforeUnmount(() => removeSearchShortcut?.());

  return {
    settingStore,
    apiKey,
    rememberApiKey,
    clearApiKey,
    sidebarCollapsed,
    sidebarTab,
    showCharacterDialog,
    showGlobalSearch,
    showApiKey,
    showLorePanel,
    showImportDialog,
    showStoryStateDialog,
    showChapterSummaryDialog,
    showEditorSettings,
    showError,
    errorMessage,
    snackColor,
    modelOptions,
    error,
    warn,
    openAgentTab,
    openCharacters,
    openLore,
    buildAgentConfig,
  };
}
