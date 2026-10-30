/**
 * chat/session.ts
 * 交互面板会话的创建、中断与 LLM 消息历史恢复。
 * 这一层不读写文件；会话文件由 sessionFile.ts 单独负责。
 */

import { abortSession, createSession } from '@/services/agent/session';
import type { AgentSession } from '@/types/agent';
import type { ChapterMeta, Mention, Novel } from '@/types/novel';

export interface CreateChatSessionOptions {
  novel: Novel;
  chapter: ChapterMeta;
  chapterContent: string;
  forcedMentions?: Mention[];
  /** 取编辑器里的最新章节内容（包括尚未保存的手动编辑） */
  liveContent?: () => string;
}

/** 创建交互面板会话 */
export function createChatSession(opts: CreateChatSessionOptions): AgentSession {
  return createSession({
    novel: opts.novel,
    chapter: opts.chapter,
    chapterContent: opts.chapterContent,
    cursorPosition: opts.chapterContent.length,
    forcedMentions: opts.forcedMentions,
    liveContent: opts.liveContent,
  });
}

/** 中断当前会话 */
export function abortChatSession(session: AgentSession): void {
  abortSession(session);
}

/** 恢复持久化会话的 LLM 消息历史，并校验基本结构 */
export function restoreSessionMessages(session: AgentSession, messages: unknown[]): void {
  const valid = messages.filter(
    (m): m is { role: string } =>
      !!m && typeof m === 'object' && typeof (m as { role?: unknown }).role === 'string'
  );
  session.messages = valid as AgentSession['messages'];
}
