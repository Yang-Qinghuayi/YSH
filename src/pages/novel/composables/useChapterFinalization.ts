/**
 * useChapterFinalization.ts
 * 「本章定稿」四步流水线的页面编排：忙碌态、步骤工具卡、结果合并、中断与回滚。
 * 真正的模型流程位于 services/agent/finalize.ts，本文件只处理页面状态与持久化。
 */

import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import { type FinalizeResult, type FinalizeStep, runChapterFinalize } from '@/services/agent';
import { useAgentChatStore } from '@/store/agentChatStore';
import { useNovelStore } from '@/store/novelStore';
import { useNovelUiStore } from '@/store/novelUiStore';
import type { Novel } from '@/types/novel';

import type { ChapterFinalizationDeps } from './types';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useChapterFinalization(deps: ChapterFinalizationDeps) {
  const novelStore = useNovelStore();
  const chatStore = useAgentChatStore();
  const novelUiStore = useNovelUiStore();
  const { currentNovel, currentChapter, currentChapterContent, isGenerating } =
    storeToRefs(novelStore);

  const finalizing = ref(false);
  let finalizeAbort: AbortController | null = null;

  const currentChapterMeta = computed(() => {
    const chapter = currentChapter.value;
    if (!chapter) return null;
    return currentNovel.value?.chapters.find((c) => c.id === chapter.id) ?? chapter;
  });

  async function applyFinalizeResult(result: FinalizeResult, chapterId: string) {
    const novel = currentNovel.value;
    if (!novel || novel.id !== result.novel.id) return;
    const finalized = result.novel.chapters.find((c) => c.id === chapterId);
    novelStore.updateCurrentNovel({
      ...novel,
      characters: result.novel.characters,
    } as Novel);
    await deps.patchChapterMeta(chapterId, {
      summary: finalized?.summary,
      finalizedAt: finalized?.finalizedAt,
    });
    novelUiStore.setStoryState(result.state);
  }

  function finalizeFromSummaryDialog() {
    deps.focusAgentTab();
    void finalize();
  }

  function stop(): boolean {
    if (!finalizing.value || !finalizeAbort) return false;
    chatStore.pushSystem('正在停止定稿…');
    finalizeAbort.abort();
    return true;
  }

  async function finalize() {
    const novel = currentNovel.value;
    const chapter = currentChapterMeta.value;
    if (!novel || !chapter) return;
    if (chatStore.busy || isGenerating.value) return;
    const config = deps.buildAgentConfig();
    if (!config.apiKey) {
      deps.notify.error('请先在「设置」中填写 DeepSeek API Key');
      return;
    }
    await deps.saveCurrentChapter();
    const content = currentChapterContent.value;
    if (content.trim().length < 50) {
      deps.notify.warn('本章正文太短，写完后再定稿');
      return;
    }

    const chapterId = chapter.id;
    const refinalize = !!chapter.finalizedAt;
    chatStore.pushSystem(
      refinalize
        ? `重新定稿《${chapter.title}》：先撤回上次定稿对记忆的改动，再重新整理`
        : `定稿《${chapter.title}》：概要 → 短期记忆 → 长期记忆 → 整体进度`
    );
    chatStore.setBusy(true);
    chatStore.setPhase('finalizing');
    novelStore.startGenerating();
    finalizing.value = true;
    finalizeAbort = new AbortController();
    const cards: Partial<Record<FinalizeStep, string>> = {};

    try {
      const result = await runChapterFinalize(
        {
          novel: currentNovel.value ?? novel,
          chapter,
          chapterContent: content,
          config,
          abortController: finalizeAbort,
        },
        {
          onStatus: (status) => chatStore.setStatus(status),
          onStepStart: (step) => {
            cards[step] = chatStore.pushTool(`finalize:${step}`, '进行中…');
          },
          onStepEnd: (step, _ok, text) => {
            const id = cards[step];
            if (!id) return;
            const firstLine = text.split('\n')[0];
            chatStore.updateTool(id, {
              status: 'done',
              argsSummary: firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine,
              resultText: text,
            });
            delete cards[step];
          },
          onContextTrimmed: (info) =>
            deps.notify.warn(`上下文接近上限，已省略 ${info.trimmed} 条早期内容。`),
          onWarn: (message) => deps.notify.warn(message),
        }
      );
      await applyFinalizeResult(result, chapterId);
      const parts = [
        `《${chapter.title}》已定稿。`,
        result.shortTermUpdated.length
          ? `短期记忆：${result.shortTermUpdated.join('、')}`
          : '短期记忆：无变化',
        result.longTermChanges.length
          ? `长期记忆改写：${result.longTermChanges.map((c) => c.characterName).join('、')}（可在「故事状态」回滚）`
          : '长期记忆：无需改写',
      ];
      chatStore.pushSystem(parts.join('\n'));
    } catch (e) {
      const aborted =
        finalizeAbort?.signal.aborted ||
        (e instanceof Error && (e.name === 'AbortError' || /abort/i.test(e.message)));
      for (const id of Object.values(cards)) {
        if (id) {
          chatStore.updateTool(id, {
            status: 'error',
            argsSummary: aborted ? '已停止' : '失败',
          });
        }
      }
      if (aborted) {
        chatStore.pushSystem('已停止定稿（已完成的步骤会保留，可重新定稿）');
      } else {
        deps.notify.error('定稿失败：' + errorText(e));
      }
      await deps.syncCharactersFromDisk();
      await deps.refreshStoryState();
    } finally {
      finalizeAbort = null;
      finalizing.value = false;
      chatStore.setBusy(false);
      chatStore.setStatus('');
      chatStore.setPhase('idle');
      novelStore.stopGenerating();
      deps.persistChatSession();
    }
  }

  return {
    finalizing,
    currentChapterMeta,
    finalize,
    finalizeFromSummaryDialog,
    stop,
  };
}
