/**
 * agentService.ts
 * Agent 状态机 + tool-use loop 引擎。
 *
 * 状态机：idle → planning（只读工具循环）→ awaiting_confirmation（UI 闸门）→ generating（流式正文）
 *         → done；任意点可 canceled。
 * 人物记忆与整体进度不在生成后自动更新，而是由作者点「本章定稿」触发（见 chapterFinalize.ts）。
 * 内联续写快速模式（skipConfirmation）跳过 awaiting_confirmation。
 */

import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'
import type { Novel, ChapterMeta, Mention } from '@/types/novel'
import {
  createOpenAIClient,
  streamChatWithTools,
  buildAgentSystemPrompt,
  supportsToolCalling,
  type DeepSeekModel,
} from '@/services/deepseekService'
import {
  READONLY_TOOLS,
  findTool,
  toToolSchemas,
  type AgentTool,
  type ToolContext,
  type ToolResult,
} from '@/services/agentTools'
import { loadStoryState } from '@/services/storyStateService'
import {
  loadOrCreateLore,
  loadEntryContent,
  buildLoreContext,
} from '@/services/loreService'
import {
  buildGenerateInstruction,
  buildRoundKey,
  CONTINUE_INSTRUCTION,
  detectRepeatedRounds,
  parsePlan,
  NUDGE_OUTPUT_PLAN,
  PLAN_BLOCK_PATTERN,
  type AgentPlan,
} from '@/services/agentProtocol'
import {
  enforceContextBudget,
  type ContextBudgetResult,
} from '@/services/contextBudget'

/** 章节规划类型（定义在 agentProtocol，此处 re-export 保持既有引用可用） */
export type { AgentPlan } from '@/services/agentProtocol'

export type SessionPhase =
  | 'idle'
  | 'planning'
  | 'awaiting_confirmation'
  | 'generating'
  | 'finalizing'
  | 'done'
  | 'canceled'

export interface AgentConfig {
  apiKey: string
  model: DeepSeekModel
  /** 交互面板：目标字数（500/1000/1500/2000），约束规划粒度与正文长度 */
  lengthTarget?: number
}

export interface AgentCallbacks {
  onStatus?: (text: string) => void
  onPhase?: (phase: SessionPhase) => void
  onToolCall?: (log: {
    tool: string
    status: 'running' | 'done'
    text: string
  }) => void
  onPlanReady?: (plan: AgentPlan) => void
  onTextDelta?: (delta: string) => void
  /** 上下文超预算、已裁剪历史消息 */
  onContextTrimmed?: (info: ContextBudgetResult) => void
  /** 非致命警告（如正文被长度限制截断） */
  onWarn?: (message: string) => void
  onError?: (e: unknown) => void
  onDone?: () => void
}

export interface AgentSession {
  novelId: string
  chapterId: string
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string
  cursorPosition: number
  phase: SessionPhase
  messages: ChatCompletionMessageParam[]
  plan?: AgentPlan
  forcedMentions: Mention[]
  abortController: AbortController
  skipConfirmation: boolean
  /** planning 阶段的最大工具轮数（内联续写等轻量场景可调小） */
  planMaxToolRounds: number
  /**
   * 交互面板（chat）模式：取「最新」章节内容的钩子。
   * 会话创建时的 chapterContent 是快照，用户在编辑器里的手动编辑不落进快照，
   * 写章工具落笔前用 liveContent 取当前文档，避免覆盖用户刚写的内容。
   */
  liveContent?: () => string
}

/** 整章生成：规划阶段最大工具轮数 */
const PLAN_MAX_TOOL_ROUNDS = 12
/** 内联续写：只写一小段，压缩调研预算以降低首字延迟 */
export const INLINE_PLAN_MAX_TOOL_ROUNDS = 4
/** 正文被长度限制截断后的最大自动续写次数 */
const MAX_GENERATE_CONTINUATIONS = 2
/** 模型上下文窗口（DeepSeek 64K） */
const CONTEXT_LIMIT_TOKENS = 65536

/** 创建一个 Agent 会话 */
export function createSession(opts: {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string
  cursorPosition: number
  forcedMentions: Mention[]
  skipConfirmation: boolean
  /** 默认 PLAN_MAX_TOOL_ROUNDS；内联续写传 INLINE_PLAN_MAX_TOOL_ROUNDS */
  planMaxToolRounds?: number
}): AgentSession {
  return {
    novelId: opts.novel.id,
    chapterId: opts.chapter.id,
    novel: opts.novel,
    chapter: opts.chapter,
    chapterContent: opts.chapterContent,
    cursorPosition: opts.cursorPosition,
    phase: 'idle',
    messages: [],
    forcedMentions: opts.forcedMentions,
    abortController: new AbortController(),
    skipConfirmation: opts.skipConfirmation,
    planMaxToolRounds: opts.planMaxToolRounds ?? PLAN_MAX_TOOL_ROUNDS,
  }
}

/** 中断会话 */
export function abort(session: AgentSession): void {
  session.abortController.abort()
}

function isAbort(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === 'AbortError' || /aborted/i.test(e.message))
  )
}

function toolContext(session: AgentSession): ToolContext {
  return {
    novel: session.novel,
    chapter: session.chapter,
    chapterContent: session.chapterContent,
    cursorPosition: session.cursorPosition,
  }
}

/**
 * 执行一批 tool_calls，把结果以 tool 角色消息 append 回 messages。
 *
 * registry 必须与产生这批 tool_calls 时传给模型的 schema 列表**完全一致**
 * （plan 阶段 READONLY_TOOLS、定稿阶段 SHORT_TERM_TOOLS / LONG_TERM_TOOLS、chat 模式 CHAT_TOOLS）；
 * 列表外的工具名会被拒绝并以错误文本回传，而不是静默忽略。
 *
 * 导出供 agentChat / chapterFinalize 复用。
 */
export async function executeToolCalls(
  session: AgentSession,
  toolCalls: ChatCompletionMessageFunctionToolCall[],
  registry: AgentTool[],
  cb: AgentCallbacks,
): Promise<void> {
  const ctx = toolContext(session)
  for (const tc of toolCalls) {
    const tool = findTool(tc.function.name, registry)
    cb.onToolCall?.({ tool: tc.function.name, status: 'running', text: '' })
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments || '{}')
    } catch {
      args = {}
    }

    // 工具内部抛错不应中断整个会话：转成错误文本回传给模型
    let result: ToolResult
    if (!tool) {
      result = { ok: false, text: `未知工具：${tc.function.name}` }
    } else {
      try {
        result = await tool.execute(args, ctx)
      } catch (e) {
        result = {
          ok: false,
          error: String(e),
          text: `工具 ${tc.function.name} 执行失败：${e}`,
        }
      }
    }

    cb.onToolCall?.({
      tool: tc.function.name,
      status: 'done',
      text: result.text,
    })
    session.messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: result.text,
    })
  }
}

/**
 * 单轮流式调用：先做上下文预算裁剪，再调用模型，返回文本、tool_calls 与结束原因。
 * 导出供 agentChat（交互面板多轮循环）复用。
 */
export async function runOneTurn(
  session: AgentSession,
  config: AgentConfig,
  tools: AgentTool[],
  maxTokens: number,
  onText?: (delta: string) => void,
  cb?: AgentCallbacks,
  onToolArgsDelta?: (
    index: number,
    id: string,
    name: string,
    delta: string,
  ) => void,
): Promise<{
  text: string
  toolCalls: ChatCompletionMessageFunctionToolCall[] | null
  finishReason: string | null
}> {
  applyContextBudget(session, tools, maxTokens, cb)

  const client = createOpenAIClient(config.apiKey)
  const signal = session.abortController.signal
  let text = ''
  let toolCalls: ChatCompletionMessageFunctionToolCall[] | null = null
  let finishReason: string | null = null

  for await (const ev of streamChatWithTools(client, {
    model: config.model,
    messages: session.messages,
    tools: toToolSchemas(tools),
    maxTokens,
    signal,
  })) {
    if (ev.type === 'text') {
      text += ev.delta
      onText?.(ev.delta)
    } else if (ev.type === 'tool_calls') {
      toolCalls = ev.toolCalls
    } else if (ev.type === 'tool_args_delta') {
      onToolArgsDelta?.(ev.index, ev.id, ev.name, ev.delta)
    } else if (ev.type === 'done') {
      finishReason = ev.finishReason
    }
  }

  // append assistant message
  session.messages.push({
    role: 'assistant',
    content: text || null,
    tool_calls: toolCalls ?? undefined,
  } as ChatCompletionMessageParam)

  return { text, toolCalls, finishReason }
}

/**
 * 上下文预算：超限时丢弃最旧的工具调研单元（不拆散 assistant/tool 配对）。
 * 每次调用模型前执行，避免长线会话撑爆 64K 上下文。
 */
function applyContextBudget(
  session: AgentSession,
  tools: AgentTool[],
  maxTokens: number,
  cb?: AgentCallbacks,
): void {
  const info = enforceContextBudget(session.messages, {
    contextLimitTokens: CONTEXT_LIMIT_TOKENS,
    reservedOutputTokens: maxTokens,
    toolsOverheadTokens: tools.length * 120,
  })
  if (info.trimmed > 0) {
    cb?.onContextTrimmed?.(info)
    cb?.onStatus?.('上下文接近上限，已省略部分早期调研结果…')
  }
}

/** 取最近若干章的摘要作为「前情提要」（按章节顺序，早于当前章）。导出供 agentChat 复用 */
export function recentChapterSummaries(
  novel: Novel,
  chapter: ChapterMeta,
  limit = 5,
): { title: string; summary: string }[] {
  return novel.chapters
    .filter((c) => c.order < chapter.order && c.summary?.trim())
    .sort((a, b) => a.order - b.order)
    .slice(-limit)
    .map((c) => ({ title: c.title, summary: c.summary!.trim() }))
}

/**
 * 无工具模式下把 Lore 直读进 prompt：major 条目全量 + 其余条目索引
 * （复用 buildLoreContext 的优先级拼装规则）。
 */
async function buildInlineLoreContext(novel: Novel): Promise<string> {
  try {
    const lore = await loadOrCreateLore(novel)
    const contents = new Map<string, string>()
    for (const entry of lore.entries) {
      if (!entry.enabled || entry.importance !== 'major') continue
      contents.set(entry.id, await loadEntryContent(entry.filename))
    }
    return buildLoreContext(lore, contents)
  } catch {
    // 资料库读取失败不应阻断生成
    return ''
  }
}

/**
 * 无工具规划（deepseek-reasoner 等不支持 Function Calling 的模型）：
 * 把故事状态与 Lore 直读进 system prompt，单轮产出 plan，不做工具循环。
 */
async function runInlinePlanPhase(
  session: AgentSession,
  userBrief: string,
  config: AgentConfig,
  cb: AgentCallbacks,
): Promise<void> {
  try {
    const storyState = await loadStoryState(session.novelId)
    const loreContextText = await buildInlineLoreContext(session.novel)
    const sys = buildAgentSystemPrompt(
      'planning',
      session.novel,
      storyState,
      {
        loreContextText,
        toolFree: true,
        recentSummaries: recentChapterSummaries(session.novel, session.chapter),
      },
    )

    const forcedNote = session.forcedMentions.length
      ? `\n\n作者已强制指定：${session.forcedMentions.map((m) => m.raw).join(' ')}。请在规划中纳入。`
      : ''

    session.messages = [
      { role: 'system', content: sys },
      { role: 'user', content: userBrief + forcedNote },
    ]

    setPhase(session, 'planning', cb)
    cb.onStatus?.('正在直读上下文并规划（无工具模式）…')

    const { text } = await runOneTurn(session, config, [], 1500)
    const plan = parsePlan(text)
    session.plan = plan
    setPhase(session, 'awaiting_confirmation', cb)
    cb.onPlanReady?.(plan)

    if (session.skipConfirmation) {
      await runGeneratePhase(session, config, cb)
    }
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb)
      return
    }
    cb.onError?.(e)
  }
}

/** plan 阶段：只读工具循环 + 产出 plan（模型不支持工具时降级为直读上下文） */
export async function runPlanPhase(
  session: AgentSession,
  userBrief: string,
  config: AgentConfig,
  cb: AgentCallbacks,
): Promise<void> {
  if (!supportsToolCalling(config.model)) {
    await runInlinePlanPhase(session, userBrief, config, cb)
    return
  }

  try {
    const storyState = await loadStoryState(session.novelId)
    const sys = buildAgentSystemPrompt(
      'planning',
      session.novel,
      storyState,
      {
        recentSummaries: recentChapterSummaries(session.novel, session.chapter),
      },
    )

    const forcedNote = session.forcedMentions.length
      ? `\n\n作者已强制指定：${session.forcedMentions.map((m) => m.raw).join(' ')}。请在规划中纳入。`
      : ''

    session.messages = [
      { role: 'system', content: sys },
      { role: 'user', content: userBrief + forcedNote },
    ]

    setPhase(session, 'planning', cb)
    cb.onStatus?.('正在调研上下文…')

    // 最近3轮工具调用签名（按轮聚合）
    const recentRoundKeys: string[] = []

    // 轮数上限按会话配置（内联续写会调小），催促阈值随之动态计算（50% / 75% / 最后一轮）
    const maxRounds = Math.max(1, session.planMaxToolRounds)
    const halfRound = Math.max(1, Math.floor(maxRounds * 0.5))
    const threeQuarterRound = Math.max(1, Math.floor(maxRounds * 0.75))
    const finalRound = maxRounds

    for (let i = 0; i < maxRounds; i++) {
      const roundIndex = i + 1 // 1-based

      // 渐进式催促：在关键轮次注入用户提示，帮助模型收束为 plan
      if (roundIndex === halfRound) {
        session.messages.push({ role: 'user', content: NUDGE_OUTPUT_PLAN })
      } else if (roundIndex === threeQuarterRound) {
        session.messages.push({
          role: 'user',
          content: '调研已很充分，请立即输出规划，不要再调用工具。',
        })
      } else if (roundIndex === finalRound) {
        session.messages.push({
          role: 'user',
          content:
            '这是最后一轮。必须现在输出 <<<PLAN>>>...<<<END>>>，不要再调用任何工具。',
        })
      }

      // 最后一轮：关闭工具，强制文本输出，避免继续调研
      const toolsForThisTurn = roundIndex === finalRound ? [] : READONLY_TOOLS

      const { text, toolCalls, finishReason } = await runOneTurn(
        session,
        config,
        toolsForThisTurn,
        1500,
        undefined,
        cb,
      )

      if (toolCalls && toolCalls.length > 0) {
        await executeToolCalls(session, toolCalls, READONLY_TOOLS, cb)
        cb.onStatus?.('继续调研…')

        // 记录当轮调用签名并做三连相同检测 → 立即催促收束
        try {
          if (detectRepeatedRounds(recentRoundKeys, buildRoundKey(toolCalls))) {
            session.messages.push({ role: 'user', content: NUDGE_OUTPUT_PLAN })
          }
        } catch {
          // 忽略签名构建中的异常，不影响主流程
        }
        continue
      }

      // 规划输出被长度限制截断且没有 PLAN 块 → 给出可操作的错误，而不是静默把半截文本当大纲
      if (
        !PLAN_BLOCK_PATTERN.test(text) &&
        !toolCalls?.length &&
        finishReason === 'length'
      ) {
        cb.onError?.(
          new Error(
            '规划输出被长度限制截断，未生成完整大纲。可重试，或改用 deepseek-chat / 缩短章节概要。',
          ),
        )
        return
      }

      // 无工具调用 → 解析 plan
      const plan = parsePlan(text)
      session.plan = plan
      setPhase(session, 'awaiting_confirmation', cb)
      cb.onPlanReady?.(plan)

      if (session.skipConfirmation) {
        await runGeneratePhase(session, config, cb)
      }
      return
    }

    // 优雅降级保底：从最近的 assistant 消息回溯解析 plan
    try {
      for (let j = session.messages.length - 1; j >= 0; j--) {
        const m = session.messages[j]
        if (m.role === 'assistant' && typeof m.content === 'string') {
          const txt = m.content
          if (PLAN_BLOCK_PATTERN.test(txt)) {
            const plan = parsePlan(txt)
            session.plan = plan
            setPhase(session, 'awaiting_confirmation', cb)
            cb.onPlanReady?.(plan)
            if (session.skipConfirmation) {
              await runGeneratePhase(session, config, cb)
            }
            return
          }
        }
      }
    } catch {
      // ignore and fallthrough to error
    }

    cb.onError?.(new Error('规划阶段超出最大工具调用轮数'))
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb)
      return
    }
    cb.onError?.(e)
  }
}

/** 生成阶段：流式正文（含截断续写）→ done */
export async function runGeneratePhase(
  session: AgentSession,
  config: AgentConfig,
  cb: AgentCallbacks,
): Promise<void> {
  try {
    setPhase(session, 'generating', cb)
    cb.onStatus?.('正在生成正文…')

    session.messages.push({
      role: 'user',
      content: buildGenerateInstruction(session.plan),
    })

    // 正文流式输出；若因单次 max_tokens 截断（finish_reason=length）则自动续写
    let { finishReason } = await runOneTurn(
      session,
      config,
      [],
      2500,
      (delta) => cb.onTextDelta?.(delta),
      cb,
    )

    let continuations = 0
    while (
      finishReason === 'length' &&
      continuations < MAX_GENERATE_CONTINUATIONS
    ) {
      continuations++
      cb.onStatus?.(
        `正文达到单次长度上限，正在续写（${continuations}/${MAX_GENERATE_CONTINUATIONS}）…`,
      )
      session.messages.push({ role: 'user', content: CONTINUE_INSTRUCTION })
      const next = await runOneTurn(
        session,
        config,
        [],
        2500,
        (delta) => cb.onTextDelta?.(delta),
        cb,
      )
      finishReason = next.finishReason
    }
    if (finishReason === 'length') {
      cb.onWarn?.(
        '正文已达到单次长度上限并续写多次，可能仍未写完，请检查章节结尾。',
      )
    }

    setPhase(session, 'done', cb)
    cb.onDone?.()
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb)
      return
    }
    cb.onError?.(e)
  }
}

function setPhase(
  session: AgentSession,
  phase: SessionPhase,
  cb: AgentCallbacks,
): void {
  session.phase = phase
  cb.onPhase?.(phase)
}
