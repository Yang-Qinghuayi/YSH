/**
 * deepseekService.ts
 * DeepSeek API 封装（兼容 OpenAI 格式）
 *
 * 重构后职责：
 * - parseMentions：解析 @提及（角色）
 * - sliceContextBeforeCursor：取光标前 N 字前文（供 read_context 工具与 prompt 复用）
 * - buildAgentSystemPrompt / buildChatSystemPrompt：写作 system prompt
 *   （整体进度 + 人物长期记忆/短期记忆 + POV 认知规则）
 * - buildFinalizeSystemPrompt 等：「本章定稿」各步骤的 prompt
 * - createOpenAIClient / streamChatWithTools：无状态流式 tool-use 调用
 *
 * 多轮 messages 累积与状态机由 agentService 负责；本模块只做单次流式调用 + 事件转换。
 */

import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'
import type { Novel, ChapterMeta, Mention } from '@/types/novel'
import type { StoryState } from '@/types/storyState'
import {
  POV_RULES,
  formatCharacterBlock,
  formatMainline,
} from '@/services/storyMemory'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
// 发给 AI 的前文上下文最大字符数
const MAX_CONTEXT_CHARS = 2000

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner'

export type AgentPhase = 'planning' | 'generating'

/**
 * 模型是否支持 Function Calling。
 * deepseek-reasoner（R1 系）官方明确不支持 Function Call / Json Output，且带 reasoning_content
 * 的多轮消息有额外约束；传 tools 会被拒绝或忽略。因此 Agent 需要按模型走
 * 「工具循环」或「直读上下文（inline）」两条路径，避免静默失败。
 */
export function supportsToolCalling(model: DeepSeekModel): boolean {
  return model !== 'deepseek-reasoner'
}

/**
 * 流式事件：文本增量 / 工具调用（已聚合）/ 工具参数增量 / 结束。
 * tool_args_delta 供交互面板实时预览「正在写入的正文」（append_to_chapter 的 content 参数）。
 */
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_calls'; toolCalls: ChatCompletionMessageFunctionToolCall[] }
  | {
      type: 'tool_args_delta'
      index: number
      id: string
      name: string
      delta: string
    }
  | { type: 'done'; finishReason: string | null; usage?: unknown }

// ===================== @提及解析 =====================

/** 解析编辑器文本中的 @提及 */
export function parseMentions(text: string, novel: Novel): Mention[] {
  const mentions: Mention[] = []
  // 仅支持 @角色名（强制该角色进入本次写作）
  const pattern = /@([一-龥\w]+)/g
  let match: RegExpExecArray | null

  const seen = new Set<string>()
  while ((match = pattern.exec(text)) !== null) {
    const [raw, name] = match
    if (seen.has(name)) continue

    // 找角色
    const character = novel.characters.find((c) => c.name === name)
    if (character) {
      seen.add(name)
      mentions.push({ type: 'character', raw, characterName: name, character })
    }
  }

  return mentions
}

// ===================== 上下文切片 =====================

/** 取光标前 max 字符作为前文（去掉 @提及行） */
export function sliceContextBeforeCursor(
  chapterContent: string,
  cursorPosition: number,
  max: number = MAX_CONTEXT_CHARS,
): string {
  const textBefore = chapterContent.slice(0, cursorPosition)
  const lines = textBefore.split('\n').filter((l) => !l.trim().startsWith('@'))
  return lines.join('\n').slice(-max)
}

// ===================== Agent system prompt =====================

/**
 * 构建 Agent system prompt（按阶段）。
 * opts.loreContextText：无工具（inline）模式下直读进 prompt 的资料库文本；
 * opts.toolFree：为 true 时规划阶段改用「不调用工具、直接依据上文」的指令。
 */
export function buildAgentSystemPrompt(
  phase: AgentPhase,
  novel: Novel,
  storyState?: StoryState | null,
  opts?: {
    loreContextText?: string
    toolFree?: boolean
    /** 前情提要：最近若干章的摘要（按时间顺序） */
    recentSummaries?: { title: string; summary: string }[]
  },
): string {
  const lines: string[] = [
    '你是一位专业的中文小说创作 Agent，能自主调用工具调研上下文、规划章节并撰写正文。',
    '',
    '【小说简介】',
    novel.synopsis || '（无简介）',
    '',
  ]

  // 整体进度（主线梳理）
  const mainline = formatMainline(storyState)
  if (mainline) {
    lines.push(mainline)
    lines.push('')
  }

  // 人物：长期记忆（Skill）+ 短期记忆（POV）
  const characterBlock = formatCharacterBlock(novel.characters, storyState, {
    fullSkill: !!opts?.toolFree,
    chapters: novel.chapters,
  })
  if (characterBlock) {
    lines.push(characterBlock)
    lines.push('')
  }

  // 前情提要（章节摘要，帮助长篇小说维持连贯）
  const summaries = (opts?.recentSummaries ?? []).filter((s) =>
    s.summary?.trim(),
  )
  if (summaries.length > 0) {
    lines.push('【前情提要】')
    for (const s of summaries) {
      lines.push(`- ${s.title}：${s.summary.trim()}`)
    }
    lines.push('')
  }

  // 资料库（无工具模式：由调用方直读拼装好后传入）
  if (opts?.loreContextText && opts.loreContextText.trim()) {
    lines.push(opts.loreContextText.trim())
    lines.push('')
  }

  // POV 认知规则（规划与写正文都要遵守）
  if (novel.characters.length > 0) {
    lines.push(POV_RULES)
    lines.push('')
  }

  // 阶段指令
  if (phase === 'planning') {
    lines.push('【当前任务：规划】')
    if (opts?.toolFree) {
      lines.push(
        '1. 本次运行不提供任何工具，请直接依据以上小说简介、整体进度、人物记忆与资料库内容完成调研判断。',
      )
      lines.push('2. 在规划中指明本章要重点刻画哪些角色、依据哪些设定，以及各角色此刻知道/不知道什么。')
    } else {
      lines.push(
        '1. 调用只读工具（query_lore / search_chapters / read_story_state / read_context / select_characters）调研本章所需上下文。',
      )
      lines.push(
        '2. 选定本章要写的角色（select_characters，取回完整的长期记忆与短期记忆），并引用相关 Lore 条目。',
      )
    }
    lines.push('3. 调研完成后，输出章节大纲。输出格式必须严格为：')
    lines.push('<<<PLAN>>>')
    lines.push(
      '{"outline":"章节大纲（分场景/分段的写作要点）","selectedCharacters":[{"id":"角色id","name":"名称","reason":"为何选用"}],"referencedLoreEntries":[{"id":"条目id","name":"名称"}],"approach":"整体写法思路"}',
    )
    lines.push('<<<END>>>')
    lines.push('不要在 PLAN 标记之外输出正文。')
  } else if (phase === 'generating') {
    lines.push('【当前任务：生成正文】')
    lines.push(
      '按已确认大纲续写小说正文。只输出正文，不要输出 @提及 标记、说明文字或标题。自然衔接前文，风格保持一致。',
    )
  }

  return lines.join('\n')
}

/**
 * 构建交互面板（chat 模式）的 system prompt。
 *
 * 与 buildAgentSystemPrompt 的区别：chat 模式是多轮对话，一轮里模型要自己决定
 * 「这是写作任务（先调研、出 PLAN 等作者确认）还是普通问答（直接简洁回复）」；
 * 写作任务落笔必须走 append_to_chapter / replace_tail 工具，而不是直接吐正文。
 */
export function buildChatSystemPrompt(
  novel: Novel,
  chapter: ChapterMeta,
  opts?: {
    /** 故事状态：整体进度 + 角色短期记忆 */
    storyState?: StoryState | null
    recentSummaries?: { title: string; summary: string }[]
    /** 目标字数（500/1000/1500/2000），约束规划粒度与正文长度 */
    lengthTarget?: number
    toolFree?: boolean
    /** 当前章节现有正文（供模型判断「续写本章」的衔接点） */
    chapterContent?: string
    /** 「续写上一章」场景注入的上一章上下文 */
    prevChapterContext?: { title: string; tail: string; summary?: string }
  },
): string {
  const lines: string[] = [
    '你是一位专业的中文小说创作 Agent 副驾，正在与作者进行多轮对话协作（交互模式）。',
    '',
    '【小说简介】',
    novel.synopsis || '（无简介）',
    '',
  ]

  const mainline = formatMainline(opts?.storyState)
  if (mainline) {
    lines.push(mainline)
    lines.push('')
  }

  const characterBlock = formatCharacterBlock(
    novel.characters,
    opts?.storyState,
    { fullSkill: !!opts?.toolFree, chapters: novel.chapters },
  )
  if (characterBlock) {
    lines.push(characterBlock)
    lines.push('')
  }

  const summaries = (opts?.recentSummaries ?? []).filter((s) =>
    s.summary?.trim(),
  )
  if (summaries.length > 0) {
    lines.push('【前情提要】')
    for (const s of summaries) lines.push(`- ${s.title}：${s.summary.trim()}`)
    lines.push('')
  }

  lines.push(`【当前章节】《${chapter.title}》`)
  const contentLen = opts?.chapterContent?.trim().length ?? 0
  lines.push(
    contentLen > 0
      ? `  - 本章已有 ${contentLen} 字正文`
      : '  - 本章目前为空（新开的章节）',
  )
  if (opts?.prevChapterContext) {
    const p = opts.prevChapterContext
    lines.push(`  - 前一章是《${p.title}》（作者要求以它为起点续写本章）`)
    if (p.summary?.trim()) lines.push(`  - 前情摘要：${p.summary.trim()}`)
    if (p.tail.trim()) {
      lines.push('  - 上一章结尾原文：')
      lines.push(p.tail.trim())
    }
  }
  lines.push('')

  if (opts?.lengthTarget) {
    lines.push(
      `【目标字数】本次写入章节的正文总量约 ${opts.lengthTarget} 字（允许 ±15% 浮动）。规划大纲时按此体量拆分场景，正文写到接近该体量即可停笔。`,
    )
    lines.push('')
  }

  if (novel.characters.length > 0) {
    lines.push(POV_RULES)
    lines.push('')
  }

  lines.push('【协作规则】')
  if (opts?.toolFree) {
    lines.push(
      '1. 本次运行不提供任何工具。写作任务请依据以上已有信息直接规划；要写入章节的正文用 <<<CONTENT>>>...<<<END>>> 包裹输出（系统会自动落盘）。',
    )
    lines.push(
      '2. 写作任务（作者给了章节概要/要求续写/要求改写）：先输出章节规划 <<<PLAN>>>...<<<END>>>，等作者确认后再写正文。规划格式必须严格为：',
    )
  } else {
    lines.push(
      '1. 可调用只读工具（query_lore / search_chapters / read_story_state / read_context / select_characters）调研上下文。',
    )
    lines.push(
      '2. 写作任务（作者给了章节概要 / 要求续写 / 要求改写）：先调研，然后输出章节规划 <<<PLAN>>>...<<<END>>>，等作者确认后再写正文。规划格式必须严格为：',
    )
  }
  lines.push('<<<PLAN>>>')
  lines.push(
    '{"outline":"章节大纲（分场景/分段的写作要点，体量与目标字数匹配）","selectedCharacters":[{"id":"角色id","name":"名称","reason":"为何选用"}],"referencedLoreEntries":[{"id":"条目id","name":"名称"}],"approach":"整体写法思路"}',
  )
  lines.push('<<<END>>>')
  lines.push(
    '规划输出后本轮结束，等待作者确认或提出修改意见（作者后续的修改意见也要按此格式重新输出完整规划）。',
  )
  if (!opts?.toolFree) {
    lines.push(
      '3. 正文写入章节只能通过工具：append_to_chapter（追加新正文）或 replace_tail（重写结尾）。不要在对话里直接输出成段正文。',
    )
  } else {
    lines.push(
      '3. 正文写入章节只能用 <<<CONTENT>>>...<<<END>>> 包裹，不要在对话里直接输出成段正文。',
    )
  }
  lines.push(
    '4. 作者提问或讨论（不是写作任务）：直接简洁回复（300 字以内，不要输出 PLAN、不要写大段正文）。',
  )
  lines.push('5. 作者用 @角色名 强制指定时，规划与正文必须纳入该角色。')
  lines.push('6. 正文中不要出现 @提及 标记、章节标题或任何解释性文字。')
  lines.push(
    '7. 规划与写作都要遵守 POV 认知规则：规划大纲时写明关键角色此刻知道/不知道什么；写正文前可用 select_characters / read_story_state 取回角色记忆。',
  )

  return lines.join('\n')
}

/** 生成章节摘要的指令（本章定稿第一步，正文已在上下文中） */
export function buildChapterSummaryInstruction(): string {
  return [
    '请为以上本章正文写一段章节概要，用于后续章节的「前情提要」与整体进度梳理。',
    '要求：2-3 句、不超过 120 字；只写剧情事实（谁做了什么、结果如何、留下了什么线索），不要评价文笔。',
    '只输出摘要正文，不要标题、不要引号、不要 Markdown 标记。',
  ].join('\n')
}

// ===================== 本章定稿 prompt =====================

/** 定稿时送给模型的正文上限（字符）：超长时保留开头与结尾 */
const FINALIZE_CONTENT_MAX_CHARS = 16000

function clipChapterForFinalize(content: string): string {
  const t = content.trim()
  if (t.length <= FINALIZE_CONTENT_MAX_CHARS) return t
  const head = Math.floor(FINALIZE_CONTENT_MAX_CHARS * 0.4)
  const tail = FINALIZE_CONTENT_MAX_CHARS - head
  return `${t.slice(0, head)}\n\n……（中间省略 ${t.length - FINALIZE_CONTENT_MAX_CHARS} 字）……\n\n${t.slice(-tail)}`
}

/**
 * 「本章定稿」会话的 system prompt：
 * 小说简介 + 整体进度 + 人物（完整 Skill + 短期记忆）+ 本章全文。
 * 定稿是独立的轻量会话，不依赖聊天记录（隔很久再点定稿也能用）。
 */
export function buildFinalizeSystemPrompt(
  novel: Novel,
  chapter: ChapterMeta,
  chapterContent: string,
  storyState: StoryState | null,
): string {
  const lines: string[] = [
    '你是一位细致的中文小说编辑，负责在作者确认本章定稿后，维护这部小说的「记忆」：章节概要、角色短期记忆、角色长期记忆（Skill）与主线整体进度。',
    '',
    '【小说简介】',
    novel.synopsis || '（无简介）',
    '',
  ]
  const mainline = formatMainline(storyState)
  lines.push(mainline || '【整体进度】\n（尚无）')
  lines.push('')
  const characterBlock = formatCharacterBlock(novel.characters, storyState, {
    fullSkill: true,
    chapters: novel.chapters,
  })
  if (characterBlock) {
    lines.push('以下是本章之前的人物记忆：')
    lines.push(characterBlock)
    lines.push('')
  }
  lines.push(`【本章正文】《${chapter.title}》`)
  lines.push(clipChapterForFinalize(chapterContent) || '（空）')
  lines.push('')
  lines.push('接下来作者会分步骤给出任务，请每次只完成当前这一步。')
  return lines.join('\n')
}

/** 定稿第二步：改写短期记忆（工具模式） */
export function buildShortTermInstruction(): string {
  return [
    '第二步：更新角色短期记忆。',
    '请调用 update_short_term_memory，为本章出场、或在本章得知了新信息的每个角色，以 TA 的视角（POV）整段改写短期记忆（200-300 字）：',
    '- 写 TA 最近经历了什么、知道什么、误以为什么、此刻的处境与心绪，以及 TA 眼下最在意的事；',
    '- 只写 TA 能知道的信息：TA 不在场、也没人告诉 TA 的事，不能写进 TA 的记忆；',
    '- 在旧的短期记忆基础上改写：仍然重要的旧信息保留，过时的删去；',
    '- 本章没出场、也没得知新信息的角色不要提交（保持原样）。',
  ].join('\n')
}

/** 定稿第三步：判断是否改写长期记忆（工具模式） */
export function buildLongTermInstruction(): string {
  return [
    '第三步：判断是否需要更新角色长期记忆（Skill）。',
    '长期记忆是角色的性格、信念、身份与说话方式等根本设定。只有当本章发生了足以改变某角色根本设定的重大事件（生死、背叛、顿悟、创伤、身份巨变、关系根本逆转等）时，才调用 update_long_term_memory；大多数章节都不需要。',
    '调用时 revisedSkill 必须是完整的 Skill 全文：保留原文中未受影响的内容，只修改受影响的部分，并可补一句这次改变的由来。',
    '如果不需要更新，直接回复「无需更新」，不要调用工具。',
  ].join('\n')
}

/** 定稿第四步：梳理整体进度 */
export function buildMainlineInstruction(
  summaries: { title: string; summary: string }[],
  previousMainline: string,
): string {
  const lines: string[] = [
    '第四步：梳理主线整体进度。',
    '请综合「已有整体进度」与「各章概要」（含本章），重写一份主线整体进度，供后续写作把握全局：',
    '- 按时间顺序概括故事已经发生的主线事件、当前局势与主要悬念；',
    '- 前期内容可以高度压缩，越接近本章越具体；',
    '- 400-800 字，只写剧情事实，不评价；只输出进度正文，不要标题、不要 Markdown 标记。',
    '',
    '【已有整体进度】',
    previousMainline.trim() || '（尚无）',
    '',
    '【各章概要】',
  ]
  if (summaries.length === 0) lines.push('（无）')
  for (const s of summaries) lines.push(`- ${s.title}：${s.summary}`)
  return lines.join('\n')
}

// ===================== OpenAI client =====================

/** 创建 DeepSeek（OpenAI 兼容）client */
export function createOpenAIClient(apiKey: string): OpenAI {
  if (!apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key')
  }
  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    dangerouslyAllowBrowser: true,
  })
}

/** 流式 tool-use 调用，返回事件流（text delta 即时产出；tool_calls 聚合后产出） */
export async function* streamChatWithTools(
  client: OpenAI,
  params: {
    model: DeepSeekModel
    messages: ChatCompletionMessageParam[]
    tools?: ChatCompletionTool[]
    maxTokens?: number
    signal?: AbortSignal
  },
): AsyncGenerator<StreamEvent> {
  const stream = await client.chat.completions.create(
    {
      model: params.model,
      messages: params.messages,
      // 空数组也要转成 undefined：部分模型（reasoner）收到 tools 字段会直接报错
      tools: params.tools?.length ? params.tools : undefined,
      tool_choice: params.tools?.length ? 'auto' : undefined,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: params.signal },
  )

  const toolCallAcc = new Map<
    number,
    { id: string; name: string; arguments: string }
  >()
  let finishReason: string | null = null
  let usage: unknown

  for await (const chunk of stream) {
    const choice = chunk.choices[0]
    if (choice) {
      const delta = choice.delta
      if (delta?.content) yield { type: 'text', delta: delta.content }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          const acc = toolCallAcc.get(idx) ?? {
            id: '',
            name: '',
            arguments: '',
          }
          if (tc.id) acc.id = tc.id
          if (tc.function?.name) acc.name = tc.function.name
          if (tc.function?.arguments) {
            acc.arguments += tc.function.arguments
            // 参数增量事件：交互面板用它实时预览 append_to_chapter 的 content
            yield {
              type: 'tool_args_delta',
              index: idx,
              id: acc.id,
              name: acc.name,
              delta: tc.function.arguments,
            }
          }
          toolCallAcc.set(idx, acc)
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason
    }
    const chunkUsage = (chunk as { usage?: unknown }).usage
    if (chunkUsage) usage = chunkUsage
  }

  if (toolCallAcc.size > 0) {
    const toolCalls: ChatCompletionMessageFunctionToolCall[] = [
      ...toolCallAcc.entries(),
    ]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        id: v.id,
        type: 'function' as const,
        function: { name: v.name, arguments: v.arguments },
      }))
    yield { type: 'tool_calls', toolCalls }
  }
  yield { type: 'done', finishReason, usage }
}
