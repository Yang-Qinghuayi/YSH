/**
 * session.ts
 * Agent 会话对象的创建、取消与章节上下文查询。
 * 这里只保存一次会话所需的数据，不负责模型调用和 UI 状态。
 */

import type { AgentSession, SessionPhase } from '@/types/agent';
import type { ChapterMeta, Mention, Novel } from '@/types/novel';

export interface CreateSessionOptions {
  novel: Novel;
  chapter: ChapterMeta;
  chapterContent: string;
  cursorPosition?: number;
  forcedMentions?: Mention[];
  /** 交互面板模式：读取编辑器里的最新正文 */
  liveContent?: () => string;
}

/** 创建一个相互独立、可取消的 Agent 会话 */
export function createSession(opts: CreateSessionOptions): AgentSession {
  return {
    novelId: opts.novel.id,
    chapterId: opts.chapter.id,
    novel: opts.novel,
    chapter: opts.chapter,
    chapterContent: opts.chapterContent,
    cursorPosition: opts.cursorPosition ?? opts.chapterContent.length,
    phase: 'idle',
    messages: [],
    forcedMentions: opts.forcedMentions ?? [],
    abortController: new AbortController(),
    liveContent: opts.liveContent,
  };
}

/** 中断会话中的模型请求 */
export function abortSession(session: AgentSession): void {
  session.abortController.abort();
}

/** 更新会话阶段；通知 UI 是调用方的职责 */
export function setSessionPhase(session: AgentSession, phase: SessionPhase): void {
  session.phase = phase;
}

/** 取当前章之前最近若干章的摘要，作为「前情提要」 */
export function recentChapterSummaries(
  novel: Novel,
  chapter: ChapterMeta,
  limit = 5
): { title: string; summary: string }[] {
  return novel.chapters
    .filter((c) => c.order < chapter.order && c.summary?.trim())
    .sort((a, b) => a.order - b.order)
    .slice(-limit)
    .map((c) => ({ title: c.title, summary: c.summary!.trim() }));
}
