/**
 * chat/quickActions.ts
 * 「续写上一章 / 续写本章」快捷动作的任务文案与隐藏上下文构建。
 */

import { sliceContextBeforeCursor } from '@/services/agent/text';
import { loadChapterContent } from '@/services/novelService';
import { formatPovReminder } from '@/services/storyMemory';
import { loadStoryState } from '@/services/storyStateService';
import type { ChapterMeta, Novel } from '@/types/novel';
import type { StoryState } from '@/types/storyState';

/** 找当前章节的前一章（order 最大且小于当前） */
export function findPrevChapter(novel: Novel, chapter: ChapterMeta): ChapterMeta | undefined {
  return novel.chapters.filter((c) => c.order < chapter.order).sort((a, b) => b.order - a.order)[0];
}

/**
 * 「续写上一章」任务：当前是新建的空章，以上一章结尾为起点续写本章。
 * 返回 null 表示无上一章（UI 置灰）。
 */
export async function buildContinuePrevTask(
  novel: Novel,
  chapter: ChapterMeta,
  lengthTarget?: number
): Promise<{ visible: string; llm: string } | null> {
  const prev = findPrevChapter(novel, chapter);
  if (!prev) return null;

  let tail = '';
  try {
    const content = await loadChapterContent(prev.filename);
    tail = sliceContextBeforeCursor(content, content.length, 2000);
  } catch {
    // 上一章读取失败不阻断：模型仍可用 search_chapters 等工具调研
  }

  const lines: string[] = [
    '【写作任务：续写上一章】',
    `当前章节《${chapter.title}》是新开的章节。请以上一章《${prev.title}》的结尾为起点，续写本新章节的正文。`,
  ];
  if (prev.summary?.trim()) lines.push(`【上一章前情摘要】${prev.summary.trim()}`);
  if (tail.trim()) lines.push('【上一章结尾原文】', tail.trim());
  const state = await loadStoryState(novel.id).catch(() => null);
  const pov = formatPovReminder(novel.characters, state);
  if (pov) lines.push(pov);
  lines.push(
    lengthTarget
      ? `请基于以上规划本新章（正文约 ${lengthTarget} 字），自然衔接前文，输出 PLAN。`
      : '请基于以上规划本新章，自然衔接前文，输出 PLAN。'
  );

  return {
    visible: `续写上一章：从《${prev.title}》结尾开始写本章`,
    llm: lines.join('\n'),
  };
}

/** 「续写本章」任务：从当前章已有正文的结尾继续往下写 */
export function buildContinueCurrentTask(
  novel: Novel,
  chapter: ChapterMeta,
  liveContent: string,
  lengthTarget?: number,
  storyState?: StoryState | null
): { visible: string; llm: string } {
  const tail = sliceContextBeforeCursor(liveContent, liveContent.length, 2000);
  const lines: string[] = [
    '【写作任务：续写本章】',
    `请从当前章节《${chapter.title}》已有正文的结尾继续往下写，自然衔接前文。`,
  ];
  if (tail.trim()) lines.push('【当前正文结尾】', tail.trim());
  else lines.push('（当前正文为空，按本章定位从头写起）');
  const pov = formatPovReminder(novel.characters, storyState);
  if (pov) lines.push(pov);
  lines.push(
    lengthTarget
      ? `请规划续写内容（正文约 ${lengthTarget} 字）并输出 PLAN。`
      : '请规划续写内容并输出 PLAN。'
  );
  return {
    visible: '续写本章：接已有正文继续往下写',
    llm: lines.join('\n'),
  };
}
