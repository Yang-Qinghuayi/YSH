/**
 * chat/write.ts
 * toolFree 模型（reasoner）的 CONTENT 块 → 虚拟写章数据转换。
 */

import { applyAppendToChapter } from '@/services/agent/protocol';
import type { AgentSession, ChatWriteData } from '@/types/agent';

export function buildVirtualWrite(session: AgentSession, content: string): ChatWriteData {
  const base = session.liveContent?.() ?? session.chapterContent;
  const { next, addedChars } = applyAppendToChapter(base, content);
  return {
    chapterId: session.chapter.id,
    chapterTitle: session.chapter.title,
    newContent: next,
    addedChars,
    snapshot: base,
  };
}
