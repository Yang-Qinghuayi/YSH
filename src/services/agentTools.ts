/**
 * agentTools.ts
 * Agent 可调用的工具集（function calling）。
 * 只读工具（plan 阶段）：query_lore / search_chapters / read_story_state / read_context / select_characters
 * 定稿工具（本章定稿时，有副作用）：update_short_term_memory / update_long_term_memory
 *
 * 每个工具统一返回 { ok, data?, error?, text }——text 是回传 LLM 的摘要文本（控 token，不回传全文）。
 */

import type {
  ChatCompletionTool,
  ChatCompletionFunctionTool,
} from 'openai/resources/chat/completions'
import type { Novel, ChapterMeta } from '@/types/novel'
import { loadOrCreateLore, loadEntryContent } from '@/services/loreService'
import {
  searchInChapters,
  saveChapterContent,
  saveNovelMeta,
} from '@/services/novelService'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import { sliceContextBeforeCursor } from '@/services/deepseekService'
import {
  applyShortTermMemories,
  applyLongTermChange,
  formatStoryStateForTool,
  type ShortTermPatch,
} from '@/services/storyMemory'
import {
  applyAppendToChapter,
  applyReplaceTail,
} from '@/services/agentProtocol'

/** 工具执行上下文 */
export interface ToolContext {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string
  cursorPosition: number
  /**
   * 交互面板（chat）模式专用：取「最新」章节内容。
   * 会话建立时的 chapterContent 是快照，用户在编辑器里的手动编辑不落进快照；
   * 写章工具落笔前必须用 liveContent 取当前文档，避免覆盖用户刚写的内容。
   */
  liveContent?: () => string
}

/** 工具执行结果 */
export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
  /** 回传给 LLM 的自然语言摘要 */
  text: string
}

/** 工具定义 */
export interface AgentTool {
  def: ChatCompletionFunctionTool
  execute: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<ToolResult>
}

// ===================== 工具实现 =====================

/** query_lore：检索 Lore 资料库 */
const queryLoreTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'query_lore',
      description:
        '按关键词/重要度检索当前小说的资料库（世界观/地点等设定）。返回匹配条目的摘要。',
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
      const keywords = (args.keywords as string[] | undefined) ?? []
      const importance = args.importance as string | undefined

      const lore = await loadOrCreateLore(ctx.novel)
      let entries = lore.entries.filter((e) => e.enabled)
      if (importance)
        entries = entries.filter((e) => e.importance === importance)
      if (keywords.length > 0) {
        entries = entries.filter((e) => {
          const hay = [e.name, e.briefDescription, ...e.keywords]
            .join(' ')
            .toLowerCase()
          return keywords.some((k) => hay.includes(k.toLowerCase()))
        })
      }

      if (entries.length === 0) {
        return { ok: true, text: '资料库中无匹配条目。' }
      }

      // major 条目加载全文，其余仅索引
      const lines: string[] = ['匹配条目：']
      for (const e of entries.slice(0, 20)) {
        if (e.importance === 'major') {
          const content = await loadEntryContent(e.filename)
          lines.push(`【${e.name}】（主要）`)
          if (e.briefDescription) lines.push(`简介：${e.briefDescription}`)
          if (content.trim()) lines.push(content.trim().slice(0, 800))
        } else {
          lines.push(`- ${e.name}：${e.briefDescription || '无简介'}`)
        }
      }
      return {
        ok: true,
        data: { count: entries.length },
        text: lines.join('\n'),
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `检索资料库失败：${e}` }
    }
  },
}

/** search_chapters：跨章节全文搜索 */
const searchChaptersTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'search_chapters',
      description:
        '在已写章节中全文搜索关键词，返回匹配行与所在章节。用于回顾前文细节。',
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
      const query = String(args.query ?? '')
      const limit = Number(args.limit ?? 15)
      if (!query.trim()) return { ok: true, text: '搜索词为空。' }

      const results = await searchInChapters(ctx.novel.chapters, query)
      const sliced = results.slice(0, limit)
      if (sliced.length === 0)
        return { ok: true, text: `未在已写章节中找到"${query}"。` }

      const lines = sliced.map(
        (r) =>
          `·《${r.chapterTitle}》第${r.lineIndex + 1}行：${r.lineContent.trim().slice(0, 120)}`,
      )
      return {
        ok: true,
        data: { count: results.length },
        text: `找到 ${results.length} 处：\n${lines.join('\n')}`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `搜索章节失败：${e}` }
    }
  },
}

/** read_story_state：读取整体进度与角色短期记忆（POV） */
const readStoryStateTool: AgentTool = {
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
      const state = await loadStoryState(ctx.novel.id)
      const section = args.section as 'mainline' | 'memories' | 'all' | undefined
      const names = Array.isArray(args.characterNames)
        ? (args.characterNames as unknown[]).map(String)
        : []
      return {
        ok: true,
        data: state,
        text: formatStoryStateForTool(state, {
          section,
          characterNames: names,
          chapters: ctx.novel.chapters,
        }),
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `读取故事状态失败：${e}` }
    }
  },
}

/** read_context：读取当前章节前文 */
const readContextTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'read_context',
      description:
        '读取当前章节光标前的正文上下文（最近约2000字，已剔除@提及行）。用于衔接前文。',
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
      const chars = Number(args.chars ?? 2000)
      const text = sliceContextBeforeCursor(
        ctx.chapterContent,
        ctx.cursorPosition,
        chars,
      )
      return {
        ok: true,
        text: `【当前章节：${ctx.chapter.title}】\n【前文上下文】\n${text || '（章节开头，无前文）'}`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `读取上下文失败：${e}` }
    }
  },
}

/** select_characters：选定本章要写的角色，返回其长期记忆（Skill）+ 短期记忆（POV） */
const selectCharactersTool: AgentTool = {
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
        []
      const state = await loadStoryState(ctx.novel.id).catch(() => null)
      const lines: string[] = []

      for (const id of ids) {
        // 容错：模型偶尔会传角色名而不是 id
        const char =
          ctx.novel.characters.find((c) => c.id === id) ??
          ctx.novel.characters.find((c) => c.name === id)
        if (!char) {
          lines.push(`（未找到 id=${id} 的角色）`)
          continue
        }
        lines.push(`【角色 ${char.name}】`)
        lines.push(`长期记忆（Skill）：${char.skill?.trim() || '（未填写）'}`)
        const mem = state?.characterMemories.find(
          (m) => m.characterName === char.name,
        )
        lines.push(
          `短期记忆（POV）：${mem?.shortTerm.trim() || '（暂无，按长期记忆与前文把握）'}`,
        )
      }
      if (lines.length) {
        lines.push(
          '提醒：每个角色的言行与心理只能基于 TA 自己短期记忆里的信息与本章亲历的事。',
        )
      }

      return {
        ok: true,
        data: { ids },
        text: lines.join('\n') || '未选用任何角色。',
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `选用角色失败：${e}` }
    }
  },
}

// ===================== 定稿工具（有副作用，仅「本章定稿」使用） =====================

/** 模型偶尔会带上 @ 前缀或空白 */
function normalizeName(v: unknown): string {
  return String(v ?? '').trim().replace(/^@/, '').trim()
}

/**
 * update_short_term_memory：以角色视角整段改写短期记忆。
 * 只改提交的角色；未提交的角色（本章未出场、也没得知新信息）保持原样 —— POV 信息差由此保留。
 */
const updateShortTermMemoryTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'update_short_term_memory',
      description:
        '以角色视角（POV）整段改写本章出场或得知新信息的角色的短期记忆。只提交需要更新的角色；每条 shortTerm 是改写后的完整短期记忆（200-300 字），只写该角色能知道的信息。',
      parameters: {
        type: 'object',
        properties: {
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                characterName: { type: 'string', description: '角色名' },
                shortTerm: {
                  type: 'string',
                  description:
                    '改写后的完整短期记忆：TA 最近经历了什么、知道什么、误以为什么、此刻的处境与心绪',
                },
              },
              required: ['characterName', 'shortTerm'],
            },
          },
        },
        required: ['memories'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const raw = (Array.isArray(args.memories) ? args.memories : []) as Partial<ShortTermPatch>[]
      const patches: ShortTermPatch[] = raw.map((p) => ({
        characterName: normalizeName(p?.characterName),
        shortTerm: String(p?.shortTerm ?? ''),
      }))
      const known = new Set(ctx.novel.characters.map((c) => c.name))
      const unknown = patches
        .map((p) => p.characterName)
        .filter((n) => n && !known.has(n))
      const valid = patches.filter((p) => known.has(p.characterName))

      const state = await loadStoryState(ctx.novel.id)
      const { state: next, updated } = applyShortTermMemories(
        state,
        valid,
        ctx.chapter.id,
      )
      if (updated.length) await saveStoryState(next)
      const tail = unknown.length ? `；忽略未知角色：${unknown.join('、')}` : ''
      return {
        ok: true,
        data: { updated },
        text: updated.length
          ? `已改写 ${updated.length} 个角色的短期记忆：${updated.join('、')}${tail}。`
          : `没有可更新的短期记忆${tail}。`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `更新短期记忆失败：${e}` }
    }
  },
}

/**
 * update_long_term_memory：重大事件改变了角色时，改写其长期记忆（Skill）。
 * 直接写入 novel.json，同时在 story-state.json 记改写日志（可在故事状态面板回滚）。
 * 会同步修改 ctx.novel.characters，便于同一次定稿中后续调用看到最新 Skill。
 */
const updateLongTermMemoryTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'update_long_term_memory',
      description:
        '当本章发生了足以改变某角色性格、信念或身份的重大事件（生死、背叛、顿悟、创伤、身份巨变等）时，改写该角色的长期记忆（Skill）。大多数章节不需要调用。revisedSkill 必须是改写后的完整 Skill 全文：保留原文未受影响的内容，只修改受影响的部分。',
      parameters: {
        type: 'object',
        properties: {
          characterName: { type: 'string', description: '角色名' },
          reason: {
            type: 'string',
            description: '触发改写的重大事件（一句话）',
          },
          revisedSkill: {
            type: 'string',
            description: '改写后的完整长期记忆（Skill）全文',
          },
        },
        required: ['characterName', 'reason', 'revisedSkill'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const name = normalizeName(args.characterName)
      const state = await loadStoryState(ctx.novel.id)
      const result = applyLongTermChange(
        ctx.novel.characters,
        state,
        {
          characterName: name,
          reason: String(args.reason ?? ''),
          revisedSkill: String(args.revisedSkill ?? ''),
        },
        ctx.chapter.id,
      )
      if (!result) {
        return {
          ok: false,
          text: `未改写「${name}」的长期记忆（角色不存在、内容为空或与原文相同）。`,
        }
      }
      ctx.novel.characters = result.characters
      await saveNovelMeta(ctx.novel)
      await saveStoryState(result.state)
      return {
        ok: true,
        data: { change: result.change, characters: result.characters },
        text: `已改写「${name}」的长期记忆（原因：${result.change.reason}）。`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `更新长期记忆失败：${e}` }
    }
  },
}

// ===================== 写章工具（交互面板 chat 模式） =====================

/**
 * append_to_chapter：把正文追加到当前章节末尾（chat 模式写章的唯一正向通道）。
 * 段落衔接（是否另起段）由模型在 content 里自行控制。
 */
const appendToChapterTool: AgentTool = {
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
      const content = String(args.content ?? '')
      const base = ctx.liveContent?.() ?? ctx.chapterContent
      const { next, addedChars } = applyAppendToChapter(base, content)
      if (addedChars === 0) {
        return { ok: false, text: 'content 为空，未写入任何内容。' }
      }
      await saveChapterContent(ctx.chapter.filename, next)
      return {
        ok: true,
        data: {
          chapterId: ctx.chapter.id,
          chapterTitle: ctx.chapter.title,
          newContent: next,
          addedChars,
          previousContent: base,
        },
        text: `已把 ${addedChars} 字正文追加到《${ctx.chapter.title}》末尾。`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `写入章节失败：${e}` }
    }
  },
}

/**
 * replace_tail：重写章节结尾（用于「打磨/改写结尾」类修改）。
 * 模型应先用 read_context 读到当前结尾，再决定替换多少字符。
 */
const replaceTailTool: AgentTool = {
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
      const content = String(args.content ?? '')
      const chars = Number(args.chars ?? 0)
      const base = ctx.liveContent?.() ?? ctx.chapterContent
      const { next, removedChars } = applyReplaceTail(base, chars, content)
      if (content.trim() === '' && removedChars === 0) {
        return { ok: false, text: '未做任何修改（content 为空且 chars=0）。' }
      }
      await saveChapterContent(ctx.chapter.filename, next)
      return {
        ok: true,
        data: {
          chapterId: ctx.chapter.id,
          chapterTitle: ctx.chapter.title,
          newContent: next,
          addedChars: content.length,
          removedChars,
          previousContent: base,
        },
        text: `已重写《${ctx.chapter.title}》结尾：移除 ${removedChars} 字，写入 ${content.length} 字。`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `重写章节结尾失败：${e}` }
    }
  },
}

// ===================== 工具集导出 =====================

/** 只读工具（plan 阶段） */
export const READONLY_TOOLS: AgentTool[] = [
  queryLoreTool,
  searchChaptersTool,
  readStoryStateTool,
  readContextTool,
  selectCharactersTool,
]

/** 定稿工具：改写短期记忆 */
export const SHORT_TERM_TOOLS: AgentTool[] = [updateShortTermMemoryTool]
/** 定稿工具：判断并改写长期记忆 */
export const LONG_TERM_TOOLS: AgentTool[] = [updateLongTermMemoryTool]
/** 全部定稿工具（无工具模式下按名字查执行器用） */
export const FINALIZE_TOOLS: AgentTool[] = [
  updateShortTermMemoryTool,
  updateLongTermMemoryTool,
]

/** 写章工具（交互面板 chat 模式的主循环可用） */
export const CHAT_WRITE_TOOLS: AgentTool[] = [
  appendToChapterTool,
  replaceTailTool,
]

/** 交互面板（chat）模式主循环的完整工具集 = 只读调研 + 写章 */
export const CHAT_TOOLS: AgentTool[] = [...READONLY_TOOLS, ...CHAT_WRITE_TOOLS]

/** 按 name 查找工具执行器 */
export function findTool(
  name: string,
  tools: AgentTool[],
): AgentTool | undefined {
  return tools.find((t) => t.def.function.name === name)
}

/** 把 AgentTool[] 转为 OpenAI tool schema 数组 */
export function toToolSchemas(tools: AgentTool[]): ChatCompletionTool[] {
  return tools.map((t) => t.def)
}
