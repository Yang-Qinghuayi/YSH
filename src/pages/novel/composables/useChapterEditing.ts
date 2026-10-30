/**
 * useChapterEditing.ts
 * 章节列表 CRUD、编辑器内容、自动保存、字数统计、搜索跳转与章节元数据补丁。
 * 只通过 deps 通知外部「章节已变化」，不依赖具体 Agent 实现。
 */

import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import {
  countWords,
  createChapter,
  deleteChapter,
  loadAllChapterWordCounts,
  loadChapterContent,
  saveChapterContent,
  saveNovelMeta,
  searchInChapters,
} from '@/services/novelService';
import { useNovelStore } from '@/store/novelStore';
import type { ChapterMeta, Novel, SearchResult } from '@/types/novel';

import type { ChapterEditingDeps, NovelEditorHandle } from './types';

export function useChapterEditing(deps: ChapterEditingDeps) {
  const novelStore = useNovelStore();
  const { currentNovel, currentChapter, currentChapterContent, isDirty, isGenerating } =
    storeToRefs(novelStore);

  const editorRef = ref<NovelEditorHandle | null>(null);
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 章节数组在保存后会被重建；取最新 meta，避免 summary/finalizedAt 使用旧对象 */
  const currentChapterMeta = computed<ChapterMeta | null>(() => {
    const chapter = currentChapter.value;
    if (!chapter) return null;
    return currentNovel.value?.chapters.find((c) => c.id === chapter.id) ?? chapter;
  });

  async function loadMissingWordCounts(novel: Novel) {
    const missing = novel.chapters.filter((c) => c.wordCount === undefined);
    if (!missing.length) return;
    try {
      const counts = await loadAllChapterWordCounts(missing);
      if (!currentNovel.value || currentNovel.value.id !== novel.id) return;
      const updatedNovel: Novel = {
        ...currentNovel.value,
        chapters: currentNovel.value.chapters.map((c) => ({
          ...c,
          wordCount: counts.has(c.id) ? counts.get(c.id) : c.wordCount,
        })),
      };
      novelStore.updateCurrentNovel(updatedNovel);
      await saveNovelMeta(updatedNovel);
    } catch {
      // 字数统计失败不影响主流程
    }
  }

  async function handleSelectChapter(chapter: ChapterMeta) {
    if (currentChapter.value?.id === chapter.id) return;
    await trySaveCurrentChapter();
    try {
      const content = await loadChapterContent(chapter.filename);
      novelStore.openChapter(chapter, content);
      deps.onChapterChanged();
    } catch (e) {
      deps.notify.error('加载章节失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleCreateChapter(title: string) {
    if (!currentNovel.value) return;
    try {
      const { novel, chapter } = await createChapter(currentNovel.value, title);
      novelStore.updateCurrentNovel(novel);
      novelStore.openChapter(chapter, '');
      deps.onChapterChanged();
    } catch (e) {
      deps.notify.error('创建章节失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!currentNovel.value) return;
    try {
      const updatedNovel = await deleteChapter(currentNovel.value, chapterId);
      novelStore.updateCurrentNovel(updatedNovel);
      if (currentChapter.value?.id === chapterId) {
        novelStore.closeChapter();
        deps.onChapterChanged();
      }
    } catch (e) {
      deps.notify.error('删除章节失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleContentChange(content: string) {
    novelStore.updateContent(content);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => void handleSave(), 2000);
  }

  async function handleSave() {
    if (!currentNovel.value || !currentChapter.value) return;
    try {
      await saveChapterContent(currentChapter.value.filename, currentChapterContent.value);
      const wordCount = countWords(currentChapterContent.value);
      const chapterId = currentChapter.value.id;
      const updatedNovel: Novel = {
        ...currentNovel.value,
        chapters: currentNovel.value.chapters.map((c) =>
          c.id === chapterId ? { ...c, wordCount } : c
        ),
      };
      novelStore.updateCurrentNovel(updatedNovel);
      await saveNovelMeta(updatedNovel);
      novelStore.markSaved();
    } catch (e) {
      deps.notify.error('保存失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function trySaveCurrentChapter() {
    if (isDirty.value && currentNovel.value && currentChapter.value) {
      await handleSave();
    }
  }

  /** Agent 写章 / 撤销写入后，同步 store 与编辑器（不再走用户输入自动保存） */
  function replaceEditorContent(content: string) {
    novelStore.updateContent(content);
    editorRef.value?.replaceContent(content);
  }

  async function handleSearchJump(result: SearchResult) {
    deps.showGlobalSearch.value = false;
    if (!currentNovel.value) return;
    const chapter = currentNovel.value.chapters.find((c) => c.id === result.chapterId);
    if (!chapter) return;
    if (currentChapter.value?.id !== chapter.id) {
      await trySaveCurrentChapter();
      try {
        const content = await loadChapterContent(chapter.filename);
        novelStore.openChapter(chapter, content);
        deps.onChapterChanged();
      } catch (e) {
        deps.notify.error('加载章节失败：' + (e instanceof Error ? e.message : String(e)));
        return;
      }
    }
    await nextTick();
    editorRef.value?.jumpToLine(result.lineIndex);
  }

  async function patchChapterMeta(chapterId: string, patch: Partial<ChapterMeta>) {
    const novel = currentNovel.value;
    if (!novel) return;
    const updated: Novel = {
      ...novel,
      chapters: novel.chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)),
    };
    novelStore.updateCurrentNovel(updated);
    if (currentChapter.value?.id === chapterId) {
      Object.assign(currentChapter.value, patch);
    }
    await saveNovelMeta(updated);
  }

  async function handleSaveChapterSummary(summary: string) {
    const chapter = currentChapterMeta.value;
    if (!chapter) return;
    try {
      await patchChapterMeta(chapter.id, { summary: summary || undefined });
    } catch (e) {
      deps.notify.error('保存概要失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  function dispose() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    novelStore.stopGenerating();
  }

  onBeforeUnmount(dispose);

  return {
    currentNovel,
    currentChapter,
    currentChapterContent,
    currentChapterMeta,
    isDirty,
    isGenerating,
    editorRef,
    searchInChapters,
    loadMissingWordCounts,
    handleSelectChapter,
    handleCreateChapter,
    handleDeleteChapter,
    handleContentChange,
    handleSave,
    trySaveCurrentChapter,
    replaceEditorContent,
    handleSearchJump,
    patchChapterMeta,
    handleSaveChapterSummary,
    dispose,
  };
}
