/**
 * composables/types.ts
 * 小说页面各编排模块之间共享的窄接口。
 * 只放回调与 DOM 句柄，不放业务实体（业务实体在 src/types 下）。
 */

import type { Ref } from 'vue';

import type { AgentConfig } from '@/types/agent';
import type { EntryMeta } from '@/types/lore';
import type { ChapterMeta, Novel } from '@/types/novel';

/** 统一的用户提示出口（页面 snackbar） */
export interface PageNotifier {
  error(message: string): void;
  warn(message: string): void;
}

/** NovelEditor 暴露给编排层的最小句柄，避免 composable 依赖 Vue SFC */
export interface NovelEditorHandle {
  replaceContent(content: string): void;
  jumpToLine(lineIndex: number): void;
}

/** useNovelWorkspace 的外部依赖 */
export interface NovelWorkspaceDeps {
  notify: PageNotifier;
  loreEntries: Ref<EntryMeta[]>;
  showLorePanel: Ref<boolean>;
  showImportDialog: Ref<boolean>;
  /** 离开当前小说前保存并终止会话 */
  beforeLeaveNovel(): Promise<void> | void;
  /** 小说加载完成后刷新章节/会话的派生状态 */
  onNovelLoaded(novel: Novel): void;
}

/** useCharacterMemory 的外部依赖 */
export interface CharacterMemoryDeps {
  notify: PageNotifier;
  isBusy(): boolean;
}

/** useChapterEditing 的外部依赖 */
export interface ChapterEditingDeps {
  notify: PageNotifier;
  showGlobalSearch: Ref<boolean>;
  /** 章节变化后重载该章的 Agent 会话 */
  onChapterChanged(): void;
}

/** useAgentChatController 的外部依赖 */
export interface AgentChatControllerDeps {
  notify: PageNotifier;
  apiKey: Ref<string>;
  buildAgentConfig(): AgentConfig;
  getEditor(): NovelEditorHandle | null;
}

/** useChapterFinalization 的外部依赖 */
export interface ChapterFinalizationDeps {
  notify: PageNotifier;
  buildAgentConfig(): AgentConfig;
  saveCurrentChapter(): Promise<void>;
  patchChapterMeta(chapterId: string, patch: Partial<ChapterMeta>): Promise<void>;
  syncCharactersFromDisk(): Promise<void>;
  persistChatSession(): void;
  refreshStoryState(): Promise<void>;
  focusAgentTab(): void;
}
