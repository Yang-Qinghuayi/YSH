/**
 * agentService.ts
 * Agent 状态机 + tool-use loop 引擎。
 *
 * 状态机：idle → planning（只读工具循环）→ awaiting_confirmation（UI 闸门）→ generating（流式正文）
 *         → finalizing（调 update_story_state）→ done；任意点可 canceled。
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
  summarizeStoryState,
  type DeepSeekModel,
} from '@/services/deepseekService'
import {
  READONLY_TOOLS,
  SIDE_EFFECT_TOOLS,
  findTool,
  toToolSchemas,
  type AgentTool,
  type ToolContext,
  type ToolResult,
} from '@/services/agentTools'
import { loadStoryState } from '@/services/storyStateService'

export type SessionPhase =
  | 'idle'
  | 'planning'
  | 'awaiting_confirmation'
  | 'generating'
  | 'finalizing'
  | 'done'
  | 'canceled'

export interface AgentPlan {
  outline: string
  selectedSkills: { id: string; name: string; reason: string }[]
  referencedLoreEntries: { id: string; name: string }[]
  approach: string
}

export interface AgentConfig {
  apiKey: string
  model: DeepSeekModel
  autoUpdateStoryState: boolean
}

export interface AgentCallbacks {
  onStatus?: (text: string) => void
  onPhase?: (phase: SessionPhase) => void
  onToolCall?: (log: { tool: string; status: 'running' | 'done'; text: string }) => void
  onPlanReady?: (plan: AgentPlan) => void
  onTextDelta?: (delta: string) => void
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
}

const PLAN_MAX_TOOL_ROUNDS = 8
const FINALIZE_MAX_TOOL_ROUNDS = 3

/** 创建一个 Agent 会话 */
export function createSession(opts: {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string
  cursorPosition: number
  forcedMentions: Mention[]
  skipConfirmation: boolean
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
  }
}

/** 中断会话 */
export function abort(session: AgentSession): void {
  session.abortController.abort()
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))
}

function toolContext(session: AgentSession): ToolContext {
  return {
    novel: session.novel,
    chapter: session.chapter,
    chapterContent: session.chapterContent,
    cursorPosition: session.cursorPosition,
  }
}

/** 执行一批 tool_calls，把结果以 tool 角色消息 append 回 messages */
async function executeToolCalls(
  session: AgentSession,
  toolCalls: ChatCompletionMessageFunctionToolCall[],
  tools: AgentTool[],
  cb: AgentCallbacks,
): Promise<void> {
  const ctx = toolContext(session)
  for (const tc of toolCalls) {
    const tool = findTool(tc.function.name, tools)
    cb.onToolCall?.({ tool: tc.function.name, status: 'running', text: '' })
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments || '{}')
    } catch {
      args = {}
    }
    const result: ToolResult = tool
      ? await tool.execute(args, ctx)
      : { ok: false, text: `未知工具：${tc.function.name}` }
    cb.onToolCall?.({ tool: tc.function.name, status: 'done', text: result.text })
    session.messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: result.text,
    })
  }
}

/** 单轮流式调用，返回聚合的 assistant 文本与 tool_calls */
async function runOneTurn(
  session: AgentSession,
  config: AgentConfig,
  tools: AgentTool[],
  maxTokens: number,
  onText?: (delta: string) => void,
): Promise<{ text: string; toolCalls: ChatCompletionMessageFunctionToolCall[] | null }> {
  const client = createOpenAIClient(config.apiKey)
  const signal = session.abortController.signal
  let text = ''
  let toolCalls: ChatCompletionMessageFunctionToolCall[] | null = null

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
    }
  }

  // append assistant message
  session.messages.push({
    role: 'assistant',
    content: text || null,
    tool_calls: toolCalls ?? undefined,
  } as ChatCompletionMessageParam)

  return { text, toolCalls }
}

/** plan 阶段：只读工具循环 + 产出 plan */
export async function runPlanPhase(
  session: AgentSession,
  userBrief: string,
  config: AgentConfig,
  cb: AgentCallbacks,
): Promise<void> {
  try {
    const storyState = await loadStoryState(session.novelId)
    const storyStateText = summarizeStoryState(storyState)
    const sys = buildAgentSystemPrompt('planning', session.novel, storyStateText)

    const forcedNote = session.forcedMentions.length
      ? `\n\n作者已强制指定：${session.forcedMentions.map((m) => m.raw).join(' ')}。请在规划中纳入。`
      : ''

    session.messages = [
      { role: 'system', content: sys },
      { role: 'user', content: userBrief + forcedNote },
    ]

    setPhase(session, 'planning', cb)
    cb.onStatus?.('正在调研上下文…')

    for (let i = 0; i < PLAN_MAX_TOOL_ROUNDS; i++) {
      const { text, toolCalls } = await runOneTurn(
        session,
        config,
        READONLY_TOOLS,
        1500,
      )

      if (toolCalls && toolCalls.length > 0) {
        await executeToolCalls(session, toolCalls, READONLY_TOOLS, cb)
        cb.onStatus?.('继续调研…')
        continue
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
    cb.onError?.(new Error('规划阶段超出最大工具调用轮数'))
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb)
      return
    }
    cb.onError?.(e)
  }
}

/** 生成阶段：流式正文 + finalizing 更新故事状态 */
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
      content: '请按已确认大纲续写小说正文。只输出正文，不要输出 @提及 标记、说明文字或标题。',
    })

    const { text } = await runOneTurn(session, config, [], 2500, (delta) => {
      cb.onTextDelta?.(delta)
    })

    // finalizing：更新故事状态
    if (config.autoUpdateStoryState) {
      setPhase(session, 'finalizing', cb)
      cb.onStatus?.('正在更新故事状态…')
      session.messages.push({
        role: 'user',
        content: '请调用 update_story_state 工具，根据以上正文以增量方式更新受影响角色的动态状态。',
      })

      for (let i = 0; i < FINALIZE_MAX_TOOL_ROUNDS; i++) {
        const { toolCalls } = await runOneTurn(session, config, SIDE_EFFECT_TOOLS, 1200)
        if (toolCalls && toolCalls.length > 0) {
          await executeToolCalls(session, toolCalls, SIDE_EFFECT_TOOLS, cb)
          continue
        }
        break
      }
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

function setPhase(session: AgentSession, phase: SessionPhase, cb: AgentCallbacks): void {
  session.phase = phase
  cb.onPhase?.(phase)
}

/** 从模型输出解析 plan（容错：解析失败则把原文当 outline） */
function parsePlan(text: string): AgentPlan {
  const match = text.match(/<<<PLAN>>>\s*([\s\S]*?)\s*<<<END>>>/)
  if (match) {
    try {
      const obj = JSON.parse(match[1]) as Partial<AgentPlan>
      return {
        outline: typeof obj.outline === 'string' ? obj.outline : text.trim(),
        selectedSkills: Array.isArray(obj.selectedSkills) ? obj.selectedSkills : [],
        referencedLoreEntries: Array.isArray(obj.referencedLoreEntries) ? obj.referencedLoreEntries : [],
        approach: typeof obj.approach === 'string' ? obj.approach : '',
      }
    } catch {
      // fallthrough
    }
  }
  return { outline: text.trim(), selectedSkills: [], referencedLoreEntries: [], approach: '' }
}
