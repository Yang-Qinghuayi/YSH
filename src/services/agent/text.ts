/**
 * text.ts
 * 发送给模型前的纯文本处理：@角色提及解析、光标前上下文切片。
 * 不依赖网络、文件系统或框架。
 */

import type { Mention, Novel } from '@/types/novel';

const MAX_CONTEXT_CHARS = 2000;

export function parseMentions(text: string, novel: Novel): Mention[] {
  const mentions: Mention[] = [];
  // 仅支持 @角色名（强制该角色进入本次写作）
  const pattern = /@([一-龥\w]+)/g;
  let match: RegExpExecArray | null;

  const seen = new Set<string>();
  while ((match = pattern.exec(text)) !== null) {
    const [raw, name] = match;
    if (seen.has(name)) continue;

    // 找角色
    const character = novel.characters.find((c) => c.name === name);
    if (character) {
      seen.add(name);
      mentions.push({ type: 'character', raw, characterName: name, character });
    }
  }

  return mentions;
}

// ===================== 上下文切片 =====================

/** 取光标前 max 字符作为前文（去掉 @提及行） */
export function sliceContextBeforeCursor(
  chapterContent: string,
  cursorPosition: number,
  max: number = MAX_CONTEXT_CHARS
): string {
  const textBefore = chapterContent.slice(0, cursorPosition);
  const lines = textBefore.split('\n').filter((l) => !l.trim().startsWith('@'));
  return lines.join('\n').slice(-max);
}
