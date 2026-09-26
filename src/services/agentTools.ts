/**
 * agentTools.ts
 * Agent 可调用的工具集（function calling）。
 * 只读工具（plan 阶段）：query_lore / search_chapters / read_story_state / read_context / select_characters
 * 副作用工具（finalizing 阶段）：update_story_state
 *
 * 每个工具统一返回 { ok, data?, error?, text }——text 是回传 LLM 的摘要文本（控 token，不回传全文）。
 */

import type {
  ChatCompletionTool,
  ChatCompletionFunctionTool,
} from 'openai/resources/chat/completions'
import type { Novel, ChapterMeta } from '@/types/novel'
import type { StoryState, CharacterState } from '@/types/storyState'
import { loadOrCreateLore, loadEntryContent } from '@/services/loreService'
import { searchInChapters, saveChapterContent } from '@/services/novelService'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import { sliceContextBeforeCursor } from '@/services/deepseekService'
import {
  applyStoryStatePatch,
  type StoryStatePatch,
} from '@/services/storyStateMerge'
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

/** read_story_state：读取故事状态层 */
const readStoryStateTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'read_story_state',
      description:
        '读取当前故事状态（角色动态状态：心情/位置/伤势/关系等；时间线/伏笔）。生成前调用以保持一致性。',
      parameters: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['characterStates', 'timeline', 'foreshadowings', 'all'],
            description: '读取哪一部分，默认 all',
          },
        },
      },
    },
  },
  async execute(args, ctx) {
    try {
      const state = await loadStoryState(ctx.novel.id)
      const section = (args.section as string | undefined) ?? 'all'
      const lines: string[] = []

      if (section === 'characterStates' || section === 'all') {
        if (state.characterStates.length === 0) {
          lines.push('角色状态：暂无')
        } else {
          lines.push('角色状态：')
          for (const c of state.characterStates) {
            const parts: string[] = []
            if (c.mood) parts.push(`心情=${c.mood}`)
            if (c.location) parts.push(`位置=${c.location}`)
            if (c.injuries) parts.push(`伤势=${c.injuries}`)
            if (c.possessions?.length)
              parts.push(`持有=${c.possessions.join('/')}`)
            if (c.relationships?.length)
              parts.push(
                `关系=${c.relationships.map((r) => `${r.target}:${r.relation}`).join(',')}`,
              )
            if (c.notes) parts.push(`notes=${c.notes}`)
            lines.push(
              `- ${c.characterName}：${parts.join('；') || '无'}（最近更新于章节 ${c.lastUpdatedChapterId}）`,
            )
          }
        }
      }
      if (
        (section === 'timeline' || section === 'all') &&
        state.timeline.length > 0
      ) {
        lines.push('时间线：')
        for (const t of state.timeline) lines.push(`- ${t.label}`)
      }
      if (
        (section === 'foreshadowings' || section === 'all') &&
        state.foreshadowings.length > 0
      ) {
        lines.push('伏笔：')
        for (const f of state.foreshadowings)
          lines.push(`- [${f.status}] ${f.description}`)
      }

      return {
        ok: true,
        data: state,
        text: lines.join('\n') || '故事状态为空。',
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

/** select_characters：选定本章要调用的角色档案，返回合并写作指导 */
const selectCharactersTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'select_characters',
      description:
        '选定本章要调用的角色档案（按 id），返回合并后的写作指导文本。角色档案会携带角色描述、别名与文学形象参考。',
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
      const lines: string[] = []

      for (const id of ids) {
        const char = ctx.novel.characters.find((c) => c.id === id)
        if (char) {
          lines.push(`【角色 ${char.name}】`)
          if (char.profile) lines.push(`角色描述：${char.profile}`)
          if (char.aliases?.length)
            lines.push(`别名：${char.aliases.join('/')}`)
          if (char.literaryReference)
            lines.push(`文学形象参考：${char.literaryReference}`)
          continue
        }
        lines.push(`（未找到 id=${id} 的角色）`)
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

/**
 * update_story_state：增量更新故事状态（副作用，仅 finalizing 阶段）
 * 合并语义见 storyStateMerge.ts（纯函数，可单测）。
 */
const updateStoryStateTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'update_story_state',
      description:
        '根据本次生成的正文，增量更新故事状态。只提交发生变化的字段（未提交的字段保持原值，不要为了占位而填空字符串）；按 characterName 匹配更新或新增角色；timeline/foreshadowings 为追加。',
      parameters: {
        type: 'object',
        properties: {
          characterStates: {
            type: 'array',
            description:
              '受影响的角色状态增量：只需给出发生变化的字段，未给出的字段保留原值',
            items: {
              type: 'object',
              properties: {
                characterName: { type: 'string' },
                mood: { type: 'string' },
                location: { type: 'string' },
                injuries: { type: 'string' },
                possessions: { type: 'array', items: { type: 'string' } },
                relationships: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      target: { type: 'string' },
                      relation: { type: 'string' },
                      sinceChapterId: { type: 'string' },
                    },
                    required: ['target', 'relation'],
                  },
                },
                notes: { type: 'string' },
              },
              required: ['characterName'],
            },
          },
          timeline: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                detail: { type: 'string' },
              },
              required: ['label'],
            },
          },
          foreshadowings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['open', 'resolved', 'abandoned'],
                },
              },
              required: ['description'],
            },
          },
        },
      },
    },
  },
  async execute(args, ctx) {
    try {
      const state = await loadStoryState(ctx.novel.id)
      const now = Date.now()
      const chapterId = ctx.chapter.id

      const patch: StoryStatePatch = {
        characterStates: (args.characterStates as CharacterState[]) ?? [],
        timeline: (args.timeline as StoryStatePatch['timeline']) ?? [],
        foreshadowings:
          (args.foreshadowings as StoryStatePatch['foreshadowings']) ?? [],
      }

      // 增量合并：只覆盖本次「明确提交」的字段，未提交的字段保留原值
      // （旧实现是字段级全量赋值，模型漏填时会静默清空已有状态）
      const next = applyStoryStatePatch(state, patch, chapterId, now)

      await saveStoryState(next)
      const affected = patch.characterStates?.length ?? 0
      const tl = patch.timeline ?? []
      const fs = patch.foreshadowings ?? []
      return {
        ok: true,
        data: next,
        text: `故事状态已更新（角色状态 ${affected} 条${tl.length ? `，时间线 ${tl.length} 条` : ''}${fs.length ? `，伏笔 ${fs.length} 条` : ''}）。`,
      }
    } catch (e) {
      return { ok: false, error: String(e), text: `更新故事状态失败：${e}` }
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

/** 副作用工具（finalizing 阶段） */
export const SIDE_EFFECT_TOOLS: AgentTool[] = [updateStoryStateTool]

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
