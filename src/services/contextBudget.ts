/**
 * contextBudget.ts
 * 上下文预算管理（纯函数：无 IO、无框架依赖，可直接单测）。
 *
 * 背景：Agent 的 messages 只增不减——planning 最多 12 轮 × 每轮多次工具调用，
 * 其中 query_lore 单次最多 20 条（major 条目各 800 字）。长线会话可能撑爆
 * 模型上下文（DeepSeek 64K），触发 API 报错。
 *
 * 策略：按「单元」从最旧开始丢弃，绝不拆散 assistant(tool_calls) 与其后的
 * tool 消息（协议要求 tool 消息必须紧跟对应的 tool_call_id）。
 * 丢弃的对象是「早期的工具调研结果」，system prompt、首条用户消息与最近若干轮
 * 一律保留。
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

/** 模型上下文窗口（DeepSeek 为 64K） */
export const DEFAULT_CONTEXT_LIMIT_TOKENS = 65536

/** 安全系数：留出估算误差与工具 schema 的余量 */
export const DEFAULT_SAFETY_RATIO = 0.85

export interface ContextBudgetOptions {
  /** 模型上下文窗口上限 */
  contextLimitTokens?: number
  /** 本轮预留给输出的 token（max_tokens） */
  reservedOutputTokens?: number
  /** 安全系数（0-1） */
  safetyRatio?: number
  /** 工具 schema 占用的估算 token */
  toolsOverheadTokens?: number
  /** 至少保留的最近单元数（不参与裁剪） */
  minRecentUnits?: number
}

export interface ContextBudgetResult {
  /** 被丢弃的消息条数 */
  trimmed: number
  /** 裁剪后的估算总 token */
  estimatedTokens: number
  /** 裁剪前的估算总 token */
  originalTokens: number
  /** 被丢弃的单元数 */
  trimmedUnits: number
}

/** 中日韩字符（这类字符约 1 字 1 token，其余字符约 3 字 1 token） */
function isCJKChar(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x3000 && c <= 0x303f) || // CJK 标点
    (c >= 0x3040 && c <= 0x30ff) || // 日文假名
    (c >= 0x3400 && c <= 0x4dbf) || // CJK 扩展 A
    (c >= 0x4e00 && c <= 0x9fff) || // CJK 基本区
    (c >= 0xf900 && c <= 0xfaff) || // CJK 兼容
    (c >= 0xff00 && c <= 0xffef) // 全角
  )
}

/** 估算文本 token（保守略高估计：CJK 按 1 token/字，其他按 1/3） */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  let other = 0
  for (const ch of text) {
    if (isCJKChar(ch)) cjk++
    else other++
  }
  return Math.ceil(cjk + other / 3)
}

/** 估算单条消息的 token（含结构开销） */
export function estimateMessageTokens(msg: ChatCompletionMessageParam): number {
  const anyMsg = msg as { content?: unknown; tool_calls?: unknown[] }
  let tokens = 4 // 角色与结构开销
  if (typeof anyMsg.content === 'string') {
    tokens += estimateTokens(anyMsg.content)
  } else if (anyMsg.content !== undefined && anyMsg.content !== null) {
    tokens += estimateTokens(JSON.stringify(anyMsg.content))
  }
  if (Array.isArray(anyMsg.tool_calls)) {
    tokens += estimateTokens(JSON.stringify(anyMsg.tool_calls))
  }
  return tokens
}

/** 估算整个消息数组的 token */
export function estimateMessagesTokens(messages: ChatCompletionMessageParam[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

/**
 * 把消息切成「不可拆分单元」：
 *   - system 消息各自成单元
 *   - assistant 消息与其后紧跟的 tool 消息组成一个单元（协议绑定）
 *   - 其他消息各自成单元
 */
function toUnits(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[][] {
  const units: ChatCompletionMessageParam[][] = []
  for (const msg of messages) {
    if (msg.role === 'tool' && units.length > 0) {
      const last = units[units.length - 1]
      const head = last[0]
      // 仅在紧跟 assistant 时并入同一单元
      if (head && head.role === 'assistant') {
        last.push(msg)
        continue
      }
    }
    units.push([msg])
  }
  return units
}

/**
 * 计算「固定前缀」长度：开头的 system 消息 + 首条 user 消息（会话基线，永不裁剪）。
 * 返回需要保留的消息条数。
 */
function pinnedCount(messages: ChatCompletionMessageParam[]): number {
  let i = 0
  while (i < messages.length && messages[i].role === 'system') i++
  if (i < messages.length && messages[i].role === 'user') i++
  return i
}

/**
 * 就地裁剪 messages 以适配上下文预算。
 * 返回裁剪统计；未超预算时不做任何改动（trimmed = 0）。
 */
export function enforceContextBudget(
  messages: ChatCompletionMessageParam[],
  opts: ContextBudgetOptions = {},
): ContextBudgetResult {
  const {
    contextLimitTokens = DEFAULT_CONTEXT_LIMIT_TOKENS,
    reservedOutputTokens = 0,
    safetyRatio = DEFAULT_SAFETY_RATIO,
    toolsOverheadTokens = 0,
    minRecentUnits = 2,
  } = opts

  const originalTokens = estimateMessagesTokens(messages) + toolsOverheadTokens
  const budget = Math.floor(contextLimitTokens * safetyRatio) - reservedOutputTokens

  if (originalTokens <= budget) {
    return { trimmed: 0, estimatedTokens: originalTokens, originalTokens, trimmedUnits: 0 }
  }

  const pinned = pinnedCount(messages)
  const head = messages.slice(0, pinned)
  const tail = messages.slice(pinned)
  const units = toUnits(tail)
  const keepFrom = Math.max(0, units.length - minRecentUnits)

  // 从最旧的可裁剪单元开始丢弃，直到进入预算
  let keptTokens = estimateMessagesTokens(head) + toolsOverheadTokens
  for (const unit of units) {
    keptTokens += unit.reduce((s, m) => s + estimateMessageTokens(m), 0)
  }

  let trimmed = 0
  let trimmedUnits = 0
  let cut = 0
  for (let i = 0; i < keepFrom && keptTokens > budget; i++) {
    const unitTokens = units[i].reduce((s, m) => s + estimateMessageTokens(m), 0)
    keptTokens -= unitTokens
    trimmed += units[i].length
    trimmedUnits++
    cut = i + 1
  }

  if (trimmedUnits === 0) {
    // 全是固定前缀与最近单元，无法再裁
    return { trimmed: 0, estimatedTokens: originalTokens, originalTokens, trimmedUnits: 0 }
  }

  const kept = units.slice(cut).flat()
  messages.length = 0
  messages.push(...head, ...kept)

  const estimatedTokens = estimateMessagesTokens(messages) + toolsOverheadTokens
  return { trimmed, estimatedTokens, originalTokens, trimmedUnits }
}
