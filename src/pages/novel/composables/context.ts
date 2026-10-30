/**
 * composables/context.ts
 * 小说页面各布局组件的显式注入边界。
 *
 * 每个 key 只暴露一个窄控制器，组件按需 inject，避免把整个页面对象层层透传。
 * key 在 useNovelPageController 中 provide；页面之外使用会立即报错。
 */

import { inject, type InjectionKey } from 'vue';

import type { useAgentChatController } from './useAgentChatController';
import type { useChapterEditing } from './useChapterEditing';
import type { useChapterFinalization } from './useChapterFinalization';
import type { useCharacterMemory } from './useCharacterMemory';
import type { useNovelUiState } from './useNovelUiState';
import type { useNovelWorkspace } from './useNovelWorkspace';

export type NovelUiController = ReturnType<typeof useNovelUiState>;
export type NovelWorkspaceController = ReturnType<typeof useNovelWorkspace>;
export type ChapterEditingController = ReturnType<typeof useChapterEditing>;
export type CharacterMemoryController = ReturnType<typeof useCharacterMemory>;
export type AgentChatController = ReturnType<typeof useAgentChatController>;
export type ChapterFinalizationController = ReturnType<typeof useChapterFinalization>;

export const novelUiKey: InjectionKey<NovelUiController> = Symbol('novel-ui');
export const novelWorkspaceKey: InjectionKey<NovelWorkspaceController> = Symbol('novel-workspace');
export const chapterEditingKey: InjectionKey<ChapterEditingController> = Symbol('chapter-editing');
export const characterMemoryKey: InjectionKey<CharacterMemoryController> =
  Symbol('character-memory');
export const agentChatKey: InjectionKey<AgentChatController> = Symbol('agent-chat');
export const chapterFinalizationKey: InjectionKey<ChapterFinalizationController> =
  Symbol('chapter-finalization');

function requireContext<T>(key: InjectionKey<T>, name: string): T {
  const context = inject(key);
  if (!context) throw new Error(`${name} 必须在小说页面内使用`);
  return context;
}

export function useNovelUiContext() {
  return requireContext(novelUiKey, 'useNovelUiContext');
}

export function useNovelWorkspaceContext() {
  return requireContext(novelWorkspaceKey, 'useNovelWorkspaceContext');
}

export function useChapterEditingContext() {
  return requireContext(chapterEditingKey, 'useChapterEditingContext');
}

export function useCharacterMemoryContext() {
  return requireContext(characterMemoryKey, 'useCharacterMemoryContext');
}

export function useAgentChatContext() {
  return requireContext(agentChatKey, 'useAgentChatContext');
}

export function useChapterFinalizationContext() {
  return requireContext(chapterFinalizationKey, 'useChapterFinalizationContext');
}
