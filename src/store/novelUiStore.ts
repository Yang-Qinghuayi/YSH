/**
 * novelUiStore.ts
 * 小说页面跨组件共享的两类只读/弹窗状态：
 * - storyState：故事状态面板与角色面板使用的缓存
 * - characterPanel：角色面板的开关与当前角色
 *
 * 旧的 agentStore 还保存 phase / plan / toolLog，但现行交互面板已由 chatStore 管理，
 * 这些状态没有任何消费者，因此不再存在于这个 store。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { StoryState } from '@/types/storyState';

export const useNovelUiStore = defineStore('novelUi', () => {
  const storyState = ref<StoryState | null>(null);
  const characterPanelOpen = ref(false);
  const selectedCharacterName = ref<string | null>(null);

  function setStoryState(state: StoryState | null) {
    storyState.value = state;
  }

  function openCharacterPanel(name: string | null) {
    selectedCharacterName.value = name;
    characterPanelOpen.value = true;
  }

  function closeCharacterPanel() {
    characterPanelOpen.value = false;
  }

  return {
    storyState,
    characterPanelOpen,
    selectedCharacterName,
    setStoryState,
    openCharacterPanel,
    closeCharacterPanel,
  };
});
