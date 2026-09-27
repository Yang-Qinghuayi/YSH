/**
 * chapterFinalize.ts
 * 「本章定稿」流水线：作者确认本章写完后手动触发（不会在 AI 写入后自动运行）。
 *
 *   0. 快照：记录定稿前的记忆；同一章重新定稿时先恢复到「本章之前」（见 storyMemory.beginFinalize）
 *   1. 章节概要：写入 ChapterMeta.summary
 *   2. 短期记忆：update_short_term_memory —— 本章出场/得知新信息的角色，以其视角整段改写
 *   3. 长期记忆：模型判断是否有重大事件，必要时 update_long_term_memory 改写 Skill（自动写入、记日志可回滚）
 *   4. 整体进度：已有整体进度 + 各章概要（含本章）→ 重写主线梳理
 *
 * 定稿是独立的轻量会话：system prompt = 小说简介 + 整体进度 + 人物记忆 + 本章全文，
 * 不依赖交互面板的聊天记录。无工具模型（reasoner）下 2、3 步合并为一次 <<<MEMORY>>> 协议输出，
 * 解析后仍交给同一套工具执行器（合并逻辑单一来源）。
 */

import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions'
import type { Novel, ChapterMeta } from '@/types/novel'
import type { StoryState, LongTermChange } from '@/types/storyState'
import {
  createSession,
  runOneTurn,
  executeToolCalls,
  type AgentConfig,
  type AgentCallbacks,
  type AgentSession,
} from '@/services/agentService'
import {
  buildFinalizeSystemPrompt,
  buildChapterSummaryInstruction,
  buildShortTermInstruction,
  buildLongTermInstruction,
  buildMainlineInstruction,
  supportsToolCalling,
} from '@/services/deepseekService'
import {
  SHORT_TERM_TOOLS,
  LONG_TERM_TOOLS,
  FINALIZE_TOOLS,
  findTool,
  type AgentTool,
} from '@/services/agentTools'
import {
  cleanChapterSummary,
  INLINE_MEMORY_INSTRUCTION,
  parseMemoryBlock,
} from '@/services/agentProtocol'
import { beginFinalize, cleanMainline } from '@/services/storyMemory'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import { saveNovelMeta } from '@/services/novelService'
import type { ContextBudgetResult } from '@/services/contextBudget'

/** 每个工具步骤的最大轮数 */
const FINALIZE_STEP_MAX_ROUNDS = 3
/** 整体进度梳理时最多带多少章概要（更早的已沉淀在已有整体进度里） */
const MAINLINE_MAX_SUMMARIES = 30

export type FinalizeStep = 'summary' | 'short_term' | 'long_term' | 'mainline'

export const FINALIZE_STEP_LABELS: Record<FinalizeStep, string> = {
  summary: '章节概要',
  short_term: '短期记忆',
  long_term: '长期记忆',
  mainline: '整体进度',
}

export interface FinalizeCallbacks {
  onStatus?: (text: string) => void
  onStepStart?: (step: FinalizeStep) => void
  onStepEnd?: (step: FinalizeStep, ok: boolean, text: string) => void
  onContextTrimmed?: (info: ContextBudgetResult) => void
  onWarn?: (message: string) => void
}

export interface FinalizeInput {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string
  config: AgentConfig
  /** 由调用方持有，用于「停止」 */
  abortController?: AbortController
}

export interface FinalizeResult {
  /** 定稿后的小说（角色 Skill、本章 summary / finalizedAt 已更新，且已落盘） */
  novel: Novel
  state: StoryState
  summary: string
  mainline: string
  shortTermUpdated: string[]
  longTermChanges: LongTermChange[]
  /** 本次是否为同一章的重新定稿 */
  refinalized: boolean
}

function clone<T>(v: T): T {
  // 调用方传入的可能是 Vue 响应式代理，structuredClone 不能处理代理
  return JSON.parse(JSON.stringify(v)) as T
}

/**
 * 跑一个工具步骤：注入指令 → 模型调用工具 → 执行 → 直到模型不再调用工具。
 * 返回本步骤所有工具结果文本。
 */
async function runToolStep(
  session: AgentSession,
  config: AgentConfig,
  instruction: string,
  tools: AgentTool[],
  maxTokens: number,
  cbAdapter: AgentCallbacks,
): Promise<string[]> {
  const results: string[] = []
  session.messages.push({ role: 'user', content: instruction })
  for (let i = 0; i < FINALIZE_STEP_MAX_ROUNDS; i++) {
    const { toolCalls } = await runOneTurn(
      session,
      config,
      tools,
      maxTokens,
      undefined,
      cbAdapter,
    )
    if (!toolCalls || toolCalls.length === 0) break
    await executeToolCalls(
      session,
      toolCalls as ChatCompletionMessageFunctionToolCall[],
      tools,
      {
        ...cbAdapter,
        onToolCall: (log) => {
          if (log.status === 'done' && log.text) results.push(log.text)
        },
      },
    )
  }
  return results
}

/** 运行「本章定稿」。失败 / 取消时抛错（取消为 AbortError），由调用方处理 */
export async function runChapterFinalize(
  input: FinalizeInput,
  cb: FinalizeCallbacks = {},
): Promise<FinalizeResult> {
  const startedAt = Date.now()
  const novel = clone(input.novel)
  const chapter =
    novel.chapters.find((c) => c.id === input.chapter.id) ?? clone(input.chapter)
  const toolFree = !supportsToolCalling(input.config.model)
  const cbAdapter: AgentCallbacks = {
    onStatus: cb.onStatus,
    onContextTrimmed: cb.onContextTrimmed,
  }

  // ---- 0. 快照（重新定稿时恢复到本章之前） ----
  const loaded = await loadStoryState(novel.id)
  const begin = beginFinalize(novel.characters, loaded, chapter.id, startedAt)
  novel.characters = begin.characters
  let state = await saveStoryState(begin.state)
  if (begin.refinalized) {
    await saveNovelMeta(novel)
    cb.onStatus?.('本章已定稿过：已恢复到本章之前的记忆，重新定稿…')
  }

  const session = createSession({
    novel,
    chapter,
    chapterContent: input.chapterContent,
    cursorPosition: input.chapterContent.length,
    forcedMentions: [],
    skipConfirmation: true,
  })
  if (input.abortController) session.abortController = input.abortController
  session.messages = [
    {
      role: 'system',
      content: buildFinalizeSystemPrompt(novel, chapter, input.chapterContent, state),
    },
  ]

  // ---- 1. 章节概要 ----
  cb.onStepStart?.('summary')
  cb.onStatus?.('定稿 1/4：生成章节概要…')
  session.messages.push({ role: 'user', content: buildChapterSummaryInstruction() })
  const summaryTurn = await runOneTurn(session, input.config, [], 400, undefined, cbAdapter)
  const newSummary = cleanChapterSummary(summaryTurn.text)
  if (newSummary) chapter.summary = newSummary
  const summary = chapter.summary?.trim() ?? ''
  cb.onStepEnd?.(
    'summary',
    !!newSummary,
    newSummary ? newSummary : '未生成新的概要，保留原概要。',
  )

  // ---- 2 + 3. 短期记忆 / 长期记忆 ----
  if (toolFree) {
    cb.onStepStart?.('short_term')
    cb.onStepStart?.('long_term')
    cb.onStatus?.('定稿 2/4：更新人物记忆（无工具模式）…')
    session.messages.push({ role: 'user', content: INLINE_MEMORY_INSTRUCTION })
    const { text } = await runOneTurn(session, input.config, [], 3500, undefined, cbAdapter)
    const block = parseMemoryBlock(text)
    const ctx = {
      novel,
      chapter,
      chapterContent: input.chapterContent,
      cursorPosition: input.chapterContent.length,
    }
    if (!block) {
      cb.onStepEnd?.('short_term', false, '未解析到记忆更新，已跳过。')
      cb.onStepEnd?.('long_term', false, '未解析到记忆更新，已跳过。')
    } else {
      const st = findTool('update_short_term_memory', FINALIZE_TOOLS)
      const stResult = st ? await st.execute({ memories: block.shortTerm }, ctx) : null
      cb.onStepEnd?.('short_term', !!stResult?.ok, stResult?.text ?? '无')
      const lt = findTool('update_long_term_memory', FINALIZE_TOOLS)
      const ltTexts: string[] = []
      for (const change of block.longTerm) {
        if (!lt || !change.characterName) continue
        const r = await lt.execute(change, ctx)
        ltTexts.push(r.text)
      }
      cb.onStepEnd?.('long_term', true, ltTexts.join('\n') || '无需更新。')
    }
  } else {
    cb.onStepStart?.('short_term')
    cb.onStatus?.('定稿 2/4：改写角色短期记忆…')
    const stTexts = await runToolStep(
      session,
      input.config,
      buildShortTermInstruction(),
      SHORT_TERM_TOOLS,
      3500,
      cbAdapter,
    )
    cb.onStepEnd?.(
      'short_term',
      stTexts.length > 0,
      stTexts.join('\n') || '模型未提交短期记忆更新。',
    )

    cb.onStepStart?.('long_term')
    cb.onStatus?.('定稿 3/4：判断是否需要更新长期记忆…')
    const ltTexts = await runToolStep(
      session,
      input.config,
      buildLongTermInstruction(),
      LONG_TERM_TOOLS,
      3000,
      cbAdapter,
    )
    cb.onStepEnd?.('long_term', true, ltTexts.join('\n') || '无需更新。')
  }

  // ---- 4. 整体进度 ----
  cb.onStepStart?.('mainline')
  cb.onStatus?.('定稿 4/4：梳理整体进度…')
  const summaries = [...novel.chapters]
    .filter((c) => c.order <= chapter.order && c.summary?.trim())
    .sort((a, b) => a.order - b.order)
    .slice(-MAINLINE_MAX_SUMMARIES)
    .map((c) => ({ title: c.title, summary: c.summary!.trim() }))
  state = await loadStoryState(novel.id)
  session.messages.push({
    role: 'user',
    content: buildMainlineInstruction(summaries, state.mainline),
  })
  const mainlineTurn = await runOneTurn(session, input.config, [], 1600, undefined, cbAdapter)
  const mainline = cleanMainline(mainlineTurn.text)
  if (mainline) {
    state = await saveStoryState({
      ...state,
      mainline,
      mainlineUpdatedChapterId: chapter.id,
    })
  }
  cb.onStepEnd?.('mainline', !!mainline, mainline || '未生成整体进度，保留原内容。')

  // ---- 收尾：落盘本章 summary / finalizedAt（角色 Skill 已由工具写入 novel） ----
  chapter.finalizedAt = Date.now()
  await saveNovelMeta(novel)

  const finalState = await loadStoryState(novel.id)
  const longTermChanges = finalState.longTermLog.filter(
    (c) => c.chapterId === chapter.id && c.at >= startedAt && !c.revertedAt,
  )
  const shortTermUpdated = finalState.characterMemories
    .filter((m) => m.lastUpdatedChapterId === chapter.id && m.updatedAt >= startedAt)
    .map((m) => m.characterName)

  return {
    novel,
    state: finalState,
    summary,
    mainline: finalState.mainline,
    shortTermUpdated,
    longTermChanges,
    refinalized: begin.refinalized,
  }
}
