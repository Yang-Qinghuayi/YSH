/**
 * tools/writing.ts
 * 写章工具：追加正文、重写章节结尾。
 * 工具负责落盘并返回写入前后的内容，供 UI 同步编辑器与撤销。
 */

import { applyAppendToChapter, applyReplaceTail } from '@/services/agent/protocol';
import { saveChapterContent } from '@/services/novelService';
import type { AgentTool } from '@/types/agent';

/**
 * append_to_chapter：把正文追加到当前章节末尾（chat 模式写章的唯一正向通道）。
 * 段落衔接（是否另起段）由模型在 content 里自行控制。
 */
export const appendToChapterTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'append_to_chapter',
      description:
        '把小说正文追加写入当前章节末尾（正文写入章节的唯一通道，系统会自动落盘保存）。' +
        '紧接上文续写时 content 开头不要加空行；另起新段落时让 content 以换行开头。',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '要写入的正文（中文小说正文，不含任何说明文字）',
          },
        },
        required: ['content'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const content = String(args.content ?? '');
      const base = ctx.liveContent?.() ?? ctx.chapterContent;
      const { next, addedChars } = applyAppendToChapter(base, content);
      if (addedChars === 0) {
        return { ok: false, text: 'content 为空，未写入任何内容。' };
      }
      await saveChapterContent(ctx.chapter.filename, next);
      return {
        ok: true,
        data: {
          chapterId: ctx.chapter.id,
          chapterTitle: ctx.chapter.title,
          newContent: next,
          addedChars,
          snapshot: base,
        },
        text: `已把 ${addedChars} 字正文追加到《${ctx.chapter.title}》末尾。`,
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `写入章节失败：${e}` };
    }
  },
};

/**
 * replace_tail：重写章节结尾（用于「打磨/改写结尾」类修改）。
 * 模型应先用 read_context 读到当前结尾，再决定替换多少字符。
 */
export const replaceTailTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'replace_tail',
      description:
        '重写当前章节的结尾：把末尾 chars 个字符替换为 content（系统会自动落盘保存）。' +
        '改写结尾前请先用 read_context 读取当前结尾原文，chars 要覆盖住要改写的那段。',
      parameters: {
        type: 'object',
        properties: {
          chars: {
            type: 'number',
            description: '从章节末尾替换多少字符（0 = 仅在末尾插入）',
          },
          content: { type: 'string', description: '替换后的新正文' },
        },
        required: ['chars', 'content'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const content = String(args.content ?? '');
      const chars = Number(args.chars ?? 0);
      const base = ctx.liveContent?.() ?? ctx.chapterContent;
      const { next, removedChars } = applyReplaceTail(base, chars, content);
      if (content.trim() === '' && removedChars === 0) {
        return { ok: false, text: '未做任何修改（content 为空且 chars=0）。' };
      }
      await saveChapterContent(ctx.chapter.filename, next);
      return {
        ok: true,
        data: {
          chapterId: ctx.chapter.id,
          chapterTitle: ctx.chapter.title,
          newContent: next,
          addedChars: content.length,
          removedChars,
          snapshot: base,
        },
        text: `已重写《${ctx.chapter.title}》结尾：移除 ${removedChars} 字，写入 ${content.length} 字。`,
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `重写章节结尾失败：${e}` };
    }
  },
};
