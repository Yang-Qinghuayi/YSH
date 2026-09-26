/**
 * agentChat.ts
 * 交互面板（chat 模式）多轮 Agent 会话引擎。
 *
 * 与整章生成流水线（runPlanPhase/runGeneratePhase）平行，复用其单轮原语
 * （runOneTurn：上下文预算 + 流式调用）与工具集，差异在：
 * - 多轮对话：messages 跨轮累积，每轮 = user 消息 → 工具循环 → 文本/PLAN
 * - plan 先行闸门：轮次输出里检测到 PLAN 块 → awaiting_confirmation，等作者确认
 *   （作者可在闸门里继续发消息打磨 plan，新 plan 替换旧 plan）
 * - 写章走工具：append_to_chapter / replace_tail（参数流式 → 实时预览），
 *   toolFree 模型（reasoner）降级为 <<<CONTENT>>>...<<<END>>> 协议
 * - 会话文件持久化：<小说文件夹>/agent-chat/<chapterId>.json
 */

import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions'
import type { Novel, ChapterMeta, Mention } from '@/types/novel'
import type { ChatMsg, ChatSessionFile, ChatWriteData } from '@/types/agentChat'
import {
  createSession,
  runOneTurn,
  recentChapterSummaries,
  type AgentSession,
  type AgentPlan,
  type AgentConfig,
  type AgentCallbacks,
  type SessionPhase,
} from '@/services/agentService'
import {
  buildChatSystemPrompt,
  buildChapterSummaryInstruction,
  summarizeStoryState,
  supportsToolCalling,
  sliceContextBeforeCursor,
} from '@/services/deepseekService'
import {
  CHAT_TOOLS,
  SIDE_EFFECT_TOOLS,
  findTool,
  type AgentTool,
  type ToolContext,
  type ToolResult,
} from '@/services/agentTools'
import { loadStoryState } from '@/services/storyStateService'
import { loadChapterContent } from '@/services/novelService'
import {
  PLAN_BLOCK_PATTERN,
  parsePlan,
  parseContentBlock,
  extractPartialContent,
  cleanChapterSummary,
  INLINE_STATE_INSTRUCTION,
  parseStatePatch,
  NUDGE_OUTPUT_PLAN,
  buildRoundKey,
  detectRepeatedRounds,
  applyAppendToChapter,
} from '@/services/agentProtocol'
import type { ContextBudgetResult } from '@/services/contextBudget'
import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'

/** 单轮对话的最大工具轮数 */
export const CHAT_TURN_MAX_TOOL_ROUNDS = 8
/** plan 确认后的生成轮：写正文 + 少量补查 */
const CHAT_GENERATE_MAX_TOOL_ROUNDS = 5
/** finalizing 阶段 update_story_state 的最大轮数 */
const CHAT_FINALIZE_MAX_TOOL_ROUNDS = 3

const WRITE_TOOL_NAMES = ['append_to_chapter', 'replace_tail']

function isWriteTool(name: string): boolean {
  return WRITE_TOOL_NAMES.includes(name)
}

function isAbort(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === 'AbortError' || /aborted/i.test(e.message))
  )
}

// ===================== 会话 =====================

/** 创建交互面板会话（复用 AgentSession 结构） */
export function createChatSession(opts: {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string
  forcedMentions?: Mention[]
  /** 取最新章节内容（编辑器未保存编辑） */
  liveContent?: () => string
}): AgentSession {
  const session = createSession({
    novel: opts.novel,
    chapter: opts.chapter,
    chapterContent: opts.chapterContent,
    cursorPosition: opts.chapterContent.length,
    forcedMentions: opts.forcedMentions ?? [],
    skipConfirmation: false,
  })
  session.liveContent = opts.liveContent
  return session
}

/** 中断会话 */
export function abortChatSession(session: AgentSession): void {
  session.abortController.abort()
}

/** 恢复持久化会话的 LLM 消息历史（多轮上下文延续） */
export function restoreSessionMessages(
  session: AgentSession,
  messages: unknown[],
): void {
  // 校验基本结构，避免坏文件污染会话
  const valid = messages.filter(
    (m): m is { role: string } =>
      !!m &&
      typeof m === 'object' &&
      typeof (m as { role?: unknown }).role === 'string',
  )
  session.messages = valid as AgentSession['messages']
}

// ===================== 回调 =====================

export interface ChatTurnCallbacks {
  onPhase?: (phase: SessionPhase) => void
  onStatus?: (text: string) => void
  /** 文本增量（对话回复 / 规划前的说明文字） */
  onTextDelta?: (delta: string) => void
  /** 工具调用开始（argsSummary：参数摘要） */
  onToolStart?: (tool: string, argsSummary: string) => void
  /** 写章工具 content 参数实时预览 */
  onWritePreview?: (tool: string, partial: string) => void
  /** 工具执行结束 */
  onToolEnd?: (
    tool: string,
    ok: boolean,
    resultText: string,
    write?: ChatWriteData,
  ) => void
  /** toolFree 模型：解析到 CONTENT 块（虚拟写章，由调用方落盘） */
  onVirtualWrite?: (content: string) => void
  onPlanReady?: (plan: AgentPlan) => void
  onChapterSummary?: (summary: string) => void
  onContextTrimmed?: (info: ContextBudgetResult) => void
  onWarn?: (message: string) => void
  onError?: (e: unknown) => void
  onDone?: () => void
}

export interface ChatTurnInput {
  /** 转录里展示的用户消息 */
  visibleText: string
  /** 实际发给 LLM 的消息（快捷动作会附加隐藏的上下文；默认同 visibleText） */
  llmText?: string
  /** 强制 plan 路径（快捷动作为 true；自由文本由模型自行判断） */
  forcePlan?: boolean
}

// ===================== 工具执行（chat 版：富事件 + 写入数据回传） =====================

function toolContext(session: AgentSession): ToolContext {
  return {
    novel: session.novel,
    chapter: session.chapter,
    chapterContent: session.chapterContent,
    cursorPosition: session.cursorPosition,
    liveContent: session.liveContent,
  }
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const clip = (s: string, n: number) => {
    const t = s.replace(/\s+/g, ' ').trim()
    return t.length > n ? `${t.slice(0, n)}…` : t
  }
  if (isWriteTool(name)) {
    const content = String(args.content ?? '')
    if (name === 'replace_tail') {
      return `重写结尾 ${args.chars ?? 0} 字 → ${clip(content, 40) || '（空）'}`
    }
    return `写入 ${content.length} 字：${clip(content, 40) || '（空）'}`
  }
  try {
    const s = JSON.stringify(args)
    return s.length > 80 ? `${s.slice(0, 80)}…` : s
  } catch {
    return ''
  }
}

function isWriteData(data: unknown): data is ChatWriteData {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as ChatWriteData).chapterId === 'string' &&
    typeof (data as ChatWriteData).newContent === 'string'
  )
}

/**
 * 执行一批 tool_calls（chat 版）：逐工具发 start/end 事件，写章工具回传写入数据。
 * 返回本轮所有写章工具的写入结果（供引擎判断「本轮是否已落笔」）。
 */
async function executeChatToolCalls(
  session: AgentSession,
  toolCalls: ChatCompletionMessageFunctionToolCall[],
  registry: AgentTool[],
  cb: ChatTurnCallbacks,
): Promise<ChatWriteData[]> {
  const ctx = toolContext(session)
  const writes: ChatWriteData[] = []

  for (const tc of toolCalls) {
    const tool = findTool(tc.function.name, registry)
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments || '{}')
    } catch {
      args = {}
    }

    cb.onToolStart?.(tc.function.name, summarizeArgs(tc.function.name, args))

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

    const write = isWriteData(result.data) ? result.data : undefined
    if (write && result.ok) writes.push(write)
    cb.onToolEnd?.(tc.function.name, result.ok, result.text, write)
    session.messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: result.text,
    })
  }

  return writes
}

// ===================== plan 提取 =====================

function extractPlanFromText(text: string): AgentPlan | null {
  if (!PLAN_BLOCK_PATTERN.test(text)) return null
  return parsePlan(text)
}

/** 从本轮新产生的 assistant 消息中回溯查找 PLAN（仅扫描 fromIdx 之后，避免捞到旧 plan） */
function backtrackPlan(
  session: AgentSession,
  fromIdx: number,
): AgentPlan | null {
  for (let j = session.messages.length - 1; j >= fromIdx; j--) {
    const m = session.messages[j]
    if (
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      PLAN_BLOCK_PATTERN.test(m.content)
    ) {
      return parsePlan(m.content)
    }
  }
  return null
}

function setPhase(
  session: AgentSession,
  phase: SessionPhase,
  cb: ChatTurnCallbacks,
): void {
  session.phase = phase
  cb.onPhase?.(phase)
}

// ===================== 单轮对话 =====================

/**
 * 执行一轮对话：user 消息 → 工具循环（调研/写章）→ 文本。
 * 输出含 PLAN 块 → awaiting_confirmation（闸门）；否则当作对话回复收尾。
 */
export async function runChatTurn(
  session: AgentSession,
  input: ChatTurnInput,
  config: AgentConfig,
  cb: ChatTurnCallbacks,
): Promise<void> {
  try {
    // 首轮：构建 system prompt（小说简介/角色/前情/故事状态/当前章/目标字数/协作规则）
    if (session.messages.length === 0) {
      const storyState = await loadStoryState(session.novelId)
      const sys = buildChatSystemPrompt(session.novel, session.chapter, {
        storyStateText: summarizeStoryState(storyState),
        recentSummaries: recentChapterSummaries(session.novel, session.chapter),
        lengthTarget: config.lengthTarget,
        toolFree: !supportsToolCalling(config.model),
        chapterContent: session.liveContent?.() ?? session.chapterContent,
      })
      session.messages.push({ role: 'system', content: sys })
    }

    const forcedNote = session.forcedMentions.length
      ? `\n\n作者已强制指定：${session.forcedMentions.map((m) => m.raw).join(' ')}，规划与正文必须纳入。`
      : ''

    const turnStartIdx = session.messages.length
    session.messages.push({
      role: 'user',
      content: (input.llmText ?? input.visibleText) + forcedNote,
    })

    setPhase(session, 'planning', cb)
    cb.onStatus?.('正在思考…')

    const toolFree = !supportsToolCalling(config.model)
    const maxRounds = CHAT_TURN_MAX_TOOL_ROUNDS
    const halfRound = Math.max(1, Math.floor(maxRounds * 0.5))
    const recentRoundKeys: string[] = []

    // 每轮重置 tool 参数累积（index 每轮从 0 重新编号）
    const argsAcc = new Map<number, { name: string; args: string }>()
    const handleArgsDelta = (
      index: number,
      _id: string,
      name: string,
      delta: string,
    ) => {
      const acc = argsAcc.get(index) ?? { name: '', args: '' }
      if (name) acc.name = name
      acc.args += delta
      argsAcc.set(index, acc)
      if (isWriteTool(acc.name)) {
        const partial = extractPartialContent(acc.args)
        if (partial) cb.onWritePreview?.(acc.name, partial)
      }
    }

    for (let i = 0; i < maxRounds; i++) {
      const roundIndex = i + 1
      argsAcc.clear()

      if (input.forcePlan && roundIndex === halfRound) {
        session.messages.push({ role: 'user', content: NUDGE_OUTPUT_PLAN })
      }

      // 强制 plan 的最后一轮：关工具、逼出 PLAN；普通轮最后一轮也关工具（文本收尾）
      const finalRound = roundIndex === maxRounds
      const tools = toolFree || finalRound ? [] : CHAT_TOOLS

      const { text, toolCalls } = await runOneTurn(
        session,
        config,
        tools,
        1500,
        (delta) => cb.onTextDelta?.(delta),
        { onContextTrimmed: cb.onContextTrimmed, onStatus: cb.onStatus },
        handleArgsDelta,
      )

      if (toolCalls && toolCalls.length > 0) {
        await executeChatToolCalls(session, toolCalls, tools, cb)
        cb.onStatus?.('继续…')
        try {
          if (detectRepeatedRounds(recentRoundKeys, buildRoundKey(toolCalls))) {
            session.messages.push({ role: 'user', content: NUDGE_OUTPUT_PLAN })
          }
        } catch {
          // 忽略签名异常
        }
        continue
      }

      // 无工具调用 → 检查是否产出 plan
      const plan =
        extractPlanFromText(text) ?? backtrackPlan(session, turnStartIdx)
      if (plan) {
        session.plan = plan
        setPhase(session, 'awaiting_confirmation', cb)
        cb.onPlanReady?.(plan)
        cb.onDone?.()
        return
      }

      if (input.forcePlan) {
        cb.onError?.(new Error('Agent 未能产出规划，请补充概要细节后重试。'))
        cb.onDone?.()
        return
      }

      // 普通对话回复（文本已流式输出）
      setPhase(session, 'done', cb)
      cb.onDone?.()
      return
    }

    // 轮数用尽：回溯找 plan，找不到才报错
    const plan = backtrackPlan(session, turnStartIdx)
    if (plan) {
      session.plan = plan
      setPhase(session, 'awaiting_confirmation', cb)
      cb.onPlanReady?.(plan)
    } else {
      cb.onError?.(new Error('本轮超出最大工具调用轮数'))
    }
    cb.onDone?.()
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb)
      return
    }
    cb.onError?.(e)
  }
}

// ===================== plan 确认后的生成轮 =====================

function buildChatGenerateInstruction(
  plan: AgentPlan,
  lengthTarget?: number,
  toolFree?: boolean,
): string {
  const lines: string[] = [
    '请严格按以下作者已确认的章节规划写正文（作者可能已修订，以此为准）：',
    '',
  ]
  if (plan.outline?.trim())
    lines.push('【已确认大纲】', plan.outline.trim(), '')
  if (plan.approach?.trim())
    lines.push('【写法思路】', plan.approach.trim(), '')
  const target = lengthTarget
    ? `正文总量约 ${lengthTarget} 字（±15%），写到接近该体量即停笔。`
    : ''
  if (toolFree) {
    lines.push(
      `${target}用 <<<CONTENT>>>...<<<END>>> 包裹完整正文输出（系统会自动写入章节），不要在标记外输出正文或解释。`,
    )
  } else {
    lines.push(
      `${target}调用 append_to_chapter 工具把正文写入章节（正文较长时可分多次调用依次追加；需要重写结尾时用 replace_tail）。`,
      '正文不要出现 @提及 标记、章节标题或解释性文字。',
    )
  }
  return lines.join('\n')
}

/**
 * plan 确认后的生成轮：模型按已确认大纲调用写章工具落笔（或 toolFree 回吐 CONTENT 块），
 * 写章成功后进入 finalizing（故事状态 + 章节摘要，沿用既有语义）。
 */
export async function runChatGenerateTurn(
  session: AgentSession,
  config: AgentConfig,
  cb: ChatTurnCallbacks,
): Promise<void> {
  try {
    const plan = session.plan
    if (!plan) {
      cb.onError?.(new Error('没有已确认的规划'))
      return
    }

    setPhase(session, 'generating', cb)
    cb.onStatus?.('正在写入正文…')
    session.messages.push({
      role: 'user',
      content: buildChatGenerateInstruction(
        plan,
        config.lengthTarget,
        !supportsToolCalling(config.model),
      ),
    })

    const toolFree = !supportsToolCalling(config.model)
    const maxTokens = (config.lengthTarget ?? 1500) * 1.4 + 300
    let wrote = false

    const argsAcc = new Map<number, { name: string; args: string }>()
    const handleArgsDelta = (
      index: number,
      _id: string,
      name: string,
      delta: string,
    ) => {
      const acc = argsAcc.get(index) ?? { name: '', args: '' }
      if (name) acc.name = name
      acc.args += delta
      argsAcc.set(index, acc)
      if (isWriteTool(acc.name)) {
        const partial = extractPartialContent(acc.args)
        if (partial) cb.onWritePreview?.(acc.name, partial)
      }
    }

    for (let i = 0; i < CHAT_GENERATE_MAX_TOOL_ROUNDS && !wrote; i++) {
      argsAcc.clear()
      const tools = toolFree ? [] : CHAT_TOOLS
      const { text, toolCalls, finishReason } = await runOneTurn(
        session,
        config,
        tools,
        maxTokens,
        (delta) => cb.onTextDelta?.(delta),
        { onContextTrimmed: cb.onContextTrimmed, onStatus: cb.onStatus },
        handleArgsDelta,
      )

      if (toolCalls && toolCalls.length > 0) {
        const writes = await executeChatToolCalls(session, toolCalls, tools, cb)
        if (writes.length > 0) {
          wrote = true
          break
        }
        if (finishReason === 'length') {
          session.messages.push({
            role: 'user',
            content:
              '上面的输出因长度限制被截断。请继续：正文没写完就继续调用 append_to_chapter 分次写完；已写完则直接回复「完成」。',
          })
          cb.onStatus?.('正文被截断，继续写入…')
          continue
        }
        continue
      }

      if (toolFree) {
        const content = parseContentBlock(text)
        if (content) {
          cb.onVirtualWrite?.(content)
          wrote = true
          break
        }
        cb.onWarn?.('Agent 未输出正文块，请重试。')
        break
      }

      cb.onWarn?.('Agent 本轮未调用写入工具，可提示它继续写入。')
      break
    }

    if (wrote) {
      await runChatFinalize(session, config, cb)
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

// ===================== finalizing（故事状态 + 章节摘要） =====================

async function runChatFinalize(
  session: AgentSession,
  config: AgentConfig,
  cb: ChatTurnCallbacks,
): Promise<void> {
  const needState = config.autoUpdateStoryState
  const needSummary = config.autoChapterSummary
  if (!needState && !needSummary) return

  setPhase(session, 'finalizing', cb)
  const toolFree = !supportsToolCalling(config.model)
  const cbAdapter: AgentCallbacks = {
    onContextTrimmed: cb.onContextTrimmed,
    onStatus: cb.onStatus,
  }

  if (needState) {
    if (!toolFree) {
      cb.onStatus?.('正在更新故事状态…')
      session.messages.push({
        role: 'user',
        content:
          '请调用 update_story_state 工具，根据刚写入的正文以增量方式更新受影响角色的动态状态。',
      })
      for (let i = 0; i < CHAT_FINALIZE_MAX_TOOL_ROUNDS; i++) {
        const { toolCalls } = await runOneTurn(
          session,
          config,
          SIDE_EFFECT_TOOLS,
          1200,
          undefined,
          cbAdapter,
        )
        if (toolCalls && toolCalls.length > 0) {
          await executeChatToolCalls(session, toolCalls, SIDE_EFFECT_TOOLS, cb)
          continue
        }
        break
      }
    } else {
      // toolFree：<<<STATE>>> 协议 + 复用 update_story_state 执行器（单一合并来源）
      cb.onStatus?.('正在更新故事状态（无工具模式）…')
      session.messages.push({
        role: 'user',
        content: INLINE_STATE_INSTRUCTION,
      })
      const { text } = await runOneTurn(
        session,
        config,
        [],
        1200,
        undefined,
        cbAdapter,
      )
      const patch = parseStatePatch(text)
      const tool = findTool('update_story_state', SIDE_EFFECT_TOOLS)
      if (patch && tool) {
        // 注意：assistant 消息已由 runOneTurn 追加；这里不 push tool 消息
        // （无对应 assistant tool_calls 的孤立 tool 消息会被 API 拒绝）
        cb.onToolStart?.('update_story_state', '增量更新角色状态')
        const result = await tool.execute(patch, toolContext(session))
        cb.onToolEnd?.('update_story_state', result.ok, result.text)
      }
    }
  }

  if (needSummary) {
    cb.onStatus?.('正在生成章节摘要…')
    session.messages.push({
      role: 'user',
      content: buildChapterSummaryInstruction(),
    })
    const { text } = await runOneTurn(
      session,
      config,
      [],
      320,
      undefined,
      cbAdapter,
    )
    const summary = cleanChapterSummary(text)
    if (summary) cb.onChapterSummary?.(summary)
  }
}

// ===================== 快捷动作指令 =====================

/** 找当前章节的前一章（order 最大且小于当前） */
export function findPrevChapter(
  novel: Novel,
  chapter: ChapterMeta,
): ChapterMeta | undefined {
  return novel.chapters
    .filter((c) => c.order < chapter.order)
    .sort((a, b) => b.order - a.order)[0]
}

/**
 * 「续写上一章」任务：当前是新建的空章，以上一章结尾为起点续写本章。
 * 返回 null 表示无上一章（UI 置灰）。
 */
export async function buildContinuePrevTask(
  novel: Novel,
  chapter: ChapterMeta,
  lengthTarget?: number,
): Promise<{ visible: string; llm: string } | null> {
  const prev = findPrevChapter(novel, chapter)
  if (!prev) return null

  let tail = ''
  try {
    const content = await loadChapterContent(prev.filename)
    tail = sliceContextBeforeCursor(content, content.length, 2000)
  } catch {
    // 上一章读取失败不阻断：模型仍可用 search_chapters 等工具调研
  }

  const lines: string[] = [
    '【写作任务：续写上一章】',
    `当前章节《${chapter.title}》是新开的章节。请以上一章《${prev.title}》的结尾为起点，续写本新章节的正文。`,
  ]
  if (prev.summary?.trim())
    lines.push(`【上一章前情摘要】${prev.summary.trim()}`)
  if (tail.trim()) lines.push('【上一章结尾原文】', tail.trim())
  lines.push(
    lengthTarget
      ? `请基于以上规划本新章（正文约 ${lengthTarget} 字），自然衔接前文，输出 PLAN。`
      : '请基于以上规划本新章，自然衔接前文，输出 PLAN。',
  )

  return {
    visible: `续写上一章：从《${prev.title}》结尾开始写本章`,
    llm: lines.join('\n'),
  }
}

/** 「续写本章」任务：从当前章已有正文的结尾继续往下写 */
export function buildContinueCurrentTask(
  novel: Novel,
  chapter: ChapterMeta,
  liveContent: string,
  lengthTarget?: number,
): { visible: string; llm: string } {
  const tail = sliceContextBeforeCursor(liveContent, liveContent.length, 2000)
  const lines: string[] = [
    '【写作任务：续写本章】',
    `请从当前章节《${chapter.title}》已有正文的结尾继续往下写，自然衔接前文。`,
  ]
  if (tail.trim()) lines.push('【当前正文结尾】', tail.trim())
  else lines.push('（当前正文为空，按本章定位从头写起）')
  lines.push(
    lengthTarget
      ? `请规划续写内容（正文约 ${lengthTarget} 字）并输出 PLAN。`
      : '请规划续写内容并输出 PLAN。',
  )
  return {
    visible: '续写本章：接已有正文继续往下写',
    llm: lines.join('\n'),
  }
}

// ===================== 会话持久化 =====================

function chatFileRelPath(chapterId: string): string {
  return `agent-chat/${chapterId}.json`
}

export async function loadChatSessionFile(
  chapterId: string,
): Promise<ChatSessionFile | null> {
  try {
    const appService = await useAppService()
    const { base, pathPrefix: P } = getDataBase()
    const path = P + chatFileRelPath(chapterId)
    const exists = await appService.fs.exists(path, base).catch(() => false)
    if (!exists) return null
    const raw = await appService.fs
      .readFile(path, base, 'text')
      .catch(() => null)
    if (!raw || typeof raw !== 'string') return null
    const parsed = JSON.parse(raw) as ChatSessionFile
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.transcript) ||
      !Array.isArray(parsed.llmMessages)
    )
      return null
    return parsed
  } catch {
    return null
  }
}

/** 转录持久化前裁剪：工具细节限量 + 仅最近 3 条写章卡保留撤销快照 */
export function prepareTranscriptForPersist(transcript: ChatMsg[]): ChatMsg[] {
  type ToolMsg = Extract<ChatMsg, { kind: 'tool' }>
  const writeMsgs = transcript.filter(
    (m): m is ToolMsg => m.kind === 'tool' && !!m.write,
  )
  const keepSnapshot = new Set(writeMsgs.slice(-3).map((m) => m.id))

  return transcript.map((m) => {
    if (m.kind !== 'tool') return m
    const copy: ToolMsg = { ...m }
    if (copy.resultText && copy.resultText.length > 2000)
      copy.resultText = `${copy.resultText.slice(0, 2000)}…`
    if (copy.preview && copy.preview.length > 6000)
      copy.preview = `${copy.preview.slice(0, 6000)}…`
    if (copy.write && !keepSnapshot.has(m.id))
      copy.write = { ...copy.write, snapshot: undefined }
    if (copy.write?.snapshot && copy.write.snapshot.length > 20000) {
      copy.write = {
        ...copy.write,
        snapshot: copy.write.snapshot.slice(-20000),
      }
    }
    return copy
  })
}

export async function saveChatSessionFile(
  chapterId: string,
  chapterTitle: string,
  llmMessages: unknown[],
  transcript: ChatMsg[],
  phase: SessionPhase,
): Promise<void> {
  try {
    const appService = await useAppService()
    const { base, pathPrefix: P } = getDataBase()
    await appService.fs.createDir(P + 'agent-chat', base, true).catch(() => {})
    const file: ChatSessionFile = {
      version: 1,
      chapterId,
      chapterTitle,
      updatedAt: Date.now(),
      transcript: prepareTranscriptForPersist(transcript),
      llmMessages: llmMessages as ChatSessionFile['llmMessages'],
      phase,
    }
    await appService.fs.writeFile(
      P + chatFileRelPath(chapterId),
      base,
      JSON.stringify(file, null, 2),
    )
  } catch {
    // 持久化失败不阻断交互（内存会话仍可用）
  }
}

export async function deleteChatSessionFile(chapterId: string): Promise<void> {
  try {
    const appService = await useAppService()
    const { base, pathPrefix: P } = getDataBase()
    await appService.fs
      .removeFile(P + chatFileRelPath(chapterId), base)
      .catch(() => {})
  } catch {
    // ignore
  }
}

/** 虚拟写章（toolFree 模型的 CONTENT 块）：追加到最新正文并返回写入数据（snapshot 供撤销） */
export function buildVirtualWrite(
  session: AgentSession,
  content: string,
): ChatWriteData {
  const base = session.liveContent?.() ?? session.chapterContent
  const { next, addedChars } = applyAppendToChapter(base, content)
  return {
    chapterId: session.chapter.id,
    chapterTitle: session.chapter.title,
    newContent: next,
    addedChars,
    snapshot: base,
  }
}
