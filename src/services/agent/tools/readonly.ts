/**
 * tools/readonly.ts
 * 只读调研工具：设定检索、章节搜索、故事状态、前文、角色档案。
 * 这些工具不修改磁盘，是规划阶段与交互面板的公共基础。
 */

import { sliceContextBeforeCursor } from '@/services/agent/text';
import { loadEntryContent, loadOrCreateLore } from '@/services/loreService';
import { searchInChapters } from '@/services/novelService';
import { formatStoryStateForTool } from '@/services/storyMemory';
import { loadStoryState } from '@/services/storyStateService';
import type { AgentTool } from '@/types/agent';

/** query_lore：检索 Lore 资料库 */
export const queryLoreTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'query_lore',
      description: '按关键词/重要度检索当前小说的资料库（世界观/地点等设定）。返回匹配条目的摘要。',
      parameters: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: '关键词，匹配条目名称、别名或简介',
          },
          importance: {
            type: 'string',
            enum: ['major', 'important', 'minor'],
          },
        },
      },
    },
  },
  async execute(args, ctx) {
    try {
      const keywords = (args.keywords as string[] | undefined) ?? [];
      const importance = args.importance as string | undefined;

      const lore = await loadOrCreateLore(ctx.novel);
      let entries = lore.entries.filter((e) => e.enabled);
      if (importance) entries = entries.filter((e) => e.importance === importance);
      if (keywords.length > 0) {
        entries = entries.filter((e) => {
          const hay = [e.name, e.briefDescription, ...e.keywords].join(' ').toLowerCase();
          return keywords.some((k) => hay.includes(k.toLowerCase()));
        });
      }

      if (entries.length === 0) {
        return { ok: true, text: '资料库中无匹配条目。' };
      }

      // major 条目加载全文，其余仅索引
      const lines: string[] = ['匹配条目：'];
      for (const e of entries.slice(0, 20)) {
        if (e.importance === 'major') {
          const content = await loadEntryContent(e.filename);
          lines.push(`【${e.name}】（主要）`);
          if (e.briefDescription) lines.push(`简介：${e.briefDescription}`);
          if (content.trim()) lines.push(content.trim().slice(0, 800));
        } else {
          lines.push(`- ${e.name}：${e.briefDescription || '无简介'}`);
        }
      }
      return {
        ok: true,
        data: { count: entries.length },
        text: lines.join('\n'),
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `检索资料库失败：${e}` };
    }
  },
};

/** search_chapters：跨章节全文搜索 */
export const searchChaptersTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'search_chapters',
      description: '在已写章节中全文搜索关键词，返回匹配行与所在章节。用于回顾前文细节。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索词' },
          limit: { type: 'number', description: '最大返回条数，默认 15' },
        },
        required: ['query'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const query = String(args.query ?? '');
      const limit = Number(args.limit ?? 15);
      if (!query.trim()) return { ok: true, text: '搜索词为空。' };

      const results = await searchInChapters(ctx.novel.chapters, query);
      const sliced = results.slice(0, limit);
      if (sliced.length === 0) return { ok: true, text: `未在已写章节中找到"${query}"。` };

      const lines = sliced.map(
        (r) => `·《${r.chapterTitle}》第${r.lineIndex + 1}行：${r.lineContent.trim().slice(0, 120)}`
      );
      return {
        ok: true,
        data: { count: results.length },
        text: `找到 ${results.length} 处：\n${lines.join('\n')}`,
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `搜索章节失败：${e}` };
    }
  },
};

/** read_story_state：读取整体进度与角色短期记忆（POV） */
export const readStoryStateTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'read_story_state',
      description:
        '读取故事状态：主线「整体进度」与角色「短期记忆」（以角色视角记录 TA 知道什么、误以为什么、此刻处境）。写角色的言行与心理前调用，确保角色只基于自己知道的信息行动。',
      parameters: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['mainline', 'memories', 'all'],
            description: '读取哪一部分，默认 all',
          },
          characterNames: {
            type: 'array',
            items: { type: 'string' },
            description: '只读取这些角色的短期记忆（不传则全部）',
          },
        },
      },
    },
  },
  async execute(args, ctx) {
    try {
      const state = await loadStoryState(ctx.novel.id);
      const section = args.section as 'mainline' | 'memories' | 'all' | undefined;
      const names = Array.isArray(args.characterNames)
        ? (args.characterNames as unknown[]).map(String)
        : [];
      return {
        ok: true,
        data: state,
        text: formatStoryStateForTool(state, {
          section,
          characterNames: names,
          chapters: ctx.novel.chapters,
        }),
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `读取故事状态失败：${e}` };
    }
  },
};

/** read_context：读取当前章节前文 */
export const readContextTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'read_context',
      description: '读取当前章节光标前的正文上下文（最近约2000字，已剔除@提及行）。用于衔接前文。',
      parameters: {
        type: 'object',
        properties: {
          chars: { type: 'number', description: '最大字符数，默认 2000' },
        },
      },
    },
  },
  async execute(args, ctx) {
    try {
      const chars = Number(args.chars ?? 2000);
      const text = sliceContextBeforeCursor(ctx.chapterContent, ctx.cursorPosition, chars);
      return {
        ok: true,
        text: `【当前章节：${ctx.chapter.title}】\n【前文上下文】\n${text || '（章节开头，无前文）'}`,
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `读取上下文失败：${e}` };
    }
  },
};

/** select_characters：选定本章要写的角色，返回其长期记忆（Skill）+ 短期记忆（POV） */
export const selectCharactersTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'select_characters',
      description:
        '选定本章要写的角色（按 id），返回每个角色完整的长期记忆（Skill：性格/出身/信念/说话方式等）与短期记忆（POV：TA 此刻知道什么、误以为什么）。',
      parameters: {
        type: 'object',
        properties: {
          characterIds: {
            type: 'array',
            items: { type: 'string' },
            description: '要选用的角色 id 列表',
          },
        },
        required: ['characterIds'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      // 兼容旧参数名 skillIds（模型可能沿用历史 schema）
      const ids =
        (args.characterIds as string[] | undefined) ??
        (args.skillIds as string[] | undefined) ??
        [];
      const state = await loadStoryState(ctx.novel.id).catch(() => null);
      const lines: string[] = [];

      for (const id of ids) {
        // 容错：模型偶尔会传角色名而不是 id
        const char =
          ctx.novel.characters.find((c) => c.id === id) ??
          ctx.novel.characters.find((c) => c.name === id);
        if (!char) {
          lines.push(`（未找到 id=${id} 的角色）`);
          continue;
        }
        lines.push(`【角色 ${char.name}】`);
        lines.push(`长期记忆（Skill）：${char.skill?.trim() || '（未填写）'}`);
        const mem = state?.characterMemories.find((m) => m.characterName === char.name);
        lines.push(`短期记忆（POV）：${mem?.shortTerm.trim() || '（暂无，按长期记忆与前文把握）'}`);
      }
      if (lines.length) {
        lines.push('提醒：每个角色的言行与心理只能基于 TA 自己短期记忆里的信息与本章亲历的事。');
      }

      return {
        ok: true,
        data: { ids },
        text: lines.join('\n') || '未选用任何角色。',
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `选用角色失败：${e}` };
    }
  },
};
