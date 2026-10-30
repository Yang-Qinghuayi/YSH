/**
 * useCharacterMemory.ts
 * 角色档案管理、短期记忆手动编辑、长期记忆回滚，以及定稿失败后的磁盘刷新。
 * 只负责人物记忆领域，不负责聊天与章节生成。
 */

import { storeToRefs } from 'pinia';

import { loadCurrentNovel, saveNovelMeta } from '@/services/novelService';
import {
  renameCharactersInState,
  revertLongTermChange,
  setShortTermMemory,
} from '@/services/storyMemory';
import { loadStoryState, saveStoryState } from '@/services/storyStateService';
import { useNovelStore } from '@/store/novelStore';
import { useNovelUiStore } from '@/store/novelUiStore';
import type { Character } from '@/types/novel';

import type { CharacterMemoryDeps } from './types';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useCharacterMemory(deps: CharacterMemoryDeps) {
  const novelStore = useNovelStore();
  const novelUiStore = useNovelUiStore();
  const { currentNovel } = storeToRefs(novelStore);

  async function handleUpdateCharacters(characters: Character[]) {
    if (!currentNovel.value) return;
    const renames: Record<string, string> = {};
    for (const character of characters) {
      const previous = currentNovel.value.characters.find((c) => c.id === character.id);
      if (previous && previous.name !== character.name && character.name.trim()) {
        renames[previous.name] = character.name;
      }
    }
    const updated = { ...currentNovel.value, characters };
    novelStore.updateCurrentNovel(updated);
    await saveNovelMeta(updated).catch((e) => deps.notify.error('保存角色失败：' + errorText(e)));
    if (Object.keys(renames).length) {
      try {
        const state = await loadStoryState(updated.id);
        novelUiStore.setStoryState(await saveStoryState(renameCharactersInState(state, renames)));
      } catch (e) {
        deps.notify.error('同步角色记忆失败：' + errorText(e));
      }
    }
  }

  async function handleUpdateSingleCharacter(character: Character) {
    if (!currentNovel.value) return;
    const characters = currentNovel.value.characters.map((c) =>
      c.id === character.id ? character : c
    );
    await handleUpdateCharacters(characters);
  }

  async function handleUpdateShortTermMemory(patch: { characterName: string; shortTerm: string }) {
    if (!currentNovel.value) return;
    try {
      const state = await loadStoryState(currentNovel.value.id);
      const saved = await saveStoryState(
        setShortTermMemory(state, patch.characterName, patch.shortTerm)
      );
      novelUiStore.setStoryState(saved);
    } catch (e) {
      deps.notify.error('保存短期记忆失败：' + errorText(e));
    }
  }

  async function handleRevertLongTerm(changeId: string) {
    const novel = currentNovel.value;
    if (!novel) return;
    if (deps.isBusy()) {
      deps.notify.warn('Agent 工作中，请稍后再回滚');
      return;
    }
    try {
      const state = await loadStoryState(novel.id);
      const result = revertLongTermChange(novel.characters, state, changeId);
      if (!result) {
        deps.notify.warn('无法回滚：记录不存在、已回滚，或角色已被删除');
        return;
      }
      const updated = { ...novel, characters: result.characters };
      novelStore.updateCurrentNovel(updated);
      await saveNovelMeta(updated);
      novelUiStore.setStoryState(await saveStoryState(result.state));
      if (result.revertedIds.length > 1) {
        deps.notify.warn(
          `已回滚，并一并撤销了之后对该角色的 ${result.revertedIds.length - 1} 次改写`
        );
      }
    } catch (e) {
      deps.notify.error('回滚失败：' + errorText(e));
    }
  }

  /** 定稿中断/失败时，以磁盘为准刷新角色 Skill，避免自动保存覆盖回旧值 */
  async function syncCharactersFromDisk() {
    const novel = currentNovel.value;
    if (!novel) return;
    try {
      const disk = await loadCurrentNovel();
      if (disk && disk.id === novel.id) {
        novelStore.updateCurrentNovel({ ...novel, characters: disk.characters });
      }
    } catch {
      // 忽略：磁盘刷新是尽力而为的兜底
    }
  }

  async function refreshStoryStateFromDisk() {
    const novelId = currentNovel.value?.id;
    if (!novelId) return;
    try {
      novelUiStore.setStoryState(await loadStoryState(novelId));
    } catch {
      // 缓存刷新失败不影响主流程
    }
  }

  return {
    handleUpdateCharacters,
    handleUpdateSingleCharacter,
    handleUpdateShortTermMemory,
    handleRevertLongTerm,
    syncCharactersFromDisk,
    refreshStoryStateFromDisk,
  };
}
