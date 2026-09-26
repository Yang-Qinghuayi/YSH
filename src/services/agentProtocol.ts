/**
 * agentProtocol.ts
 * Agent 与模型之间的「协议层」：全部为纯函数（无 IO、无框架依赖，可直接单测）。
 *
 *   - PLAN 协议：规划阶段模型按 <<<PLAN>>>…<<<END>>> 输出章节规划
 *   - STATE 协议：无工具模式（reasoner）下模型按 <<<STATE>>>…<<<END>>> 回吐状态补丁
 *   - 生成指令拼装：把「已确认（作者可能改过）的大纲」显式写进消息
 *   - 循环守卫：稳定签名 + 连续重复轮检测，防止模型原地打转
 */

import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions'

/** 章节规划（规划阶段产出，可在确认面板中被作者编辑） */
export interface AgentPlan {
  outline: string
  /** 本章选用的角色档案（历史字段名为 selectedSkills，解析时兼容） */
  selectedCharacters: { id: string; name: string; reason: string }[]
  referencedLoreEntries: { id: string; name: string }[]
  approach: string
}

/** 兼容旧字段名 selectedSkills（模型可能沿用历史 schema） */
function pickSelectedCharacters(
  obj: Record<string, unknown>,
): AgentPlan['selectedCharacters'] {
  const value = obj.selectedCharacters ?? obj.selectedSkills
  return Array.isArray(value) ? (value as AgentPlan['selectedCharacters']) : []
}

/** 无工具模式下让模型回吐状态更新的指令 */
export const INLINE_STATE_INSTRUCTION = [
  '请根据以上正文，以增量方式更新受影响角色的动态状态。',
  '只提交发生变化的字段（mood/location/injuries/possessions/relationships/notes），未变化的字段请省略，不要填空字符串占位。',
  'timeline/foreshadowings 只做追加。',
  '输出格式必须严格为（不要输出标记外的任何内容）：',
  '<<<STATE>>>',
  '{"characterStates":[{"characterName":"","mood":"","location":"","injuries":"","possessions":[],"relationships":[{"target":"","relation":""}],"notes":""}],"timeline":[{"label":"","detail":""}],"foreshadowings":[{"description":"","status":"open"}]}',
  '<<<END>>>',
  '若本次正文没有产生任何状态变化，输出 <<<STATE>>>{}<<<END>>>。',
].join('\n')

/** 催促收束的统一文案（渐进催促与死循环检测共用） */
export const NUDGE_OUTPUT_PLAN =
  '你已经完成了多轮调研，请整合已知信息，现在用 <<<PLAN>>>...<<<END>>> 格式输出章节规划。'

/** 期望输出 PLAN 的提示正则（降级回溯时用于判断某条 assistant 消息是否含规划） */
export const PLAN_BLOCK_PATTERN = /<<<PLAN>>>\s*([\s\S]*?)\s*<<<END>>>/

/** 从模型输出解析 plan（容错：解析失败则把原文当 outline） */
export function parsePlan(text: string): AgentPlan {
  const match = text.match(PLAN_BLOCK_PATTERN)
  if (match) {
    try {
      const obj = JSON.parse(match[1]) as Record<string, unknown>
      return {
        outline: typeof obj.outline === 'string' ? obj.outline : text.trim(),
        selectedCharacters: pickSelectedCharacters(obj),
        referencedLoreEntries: Array.isArray(obj.referencedLoreEntries)
          ? (obj.referencedLoreEntries as AgentPlan['referencedLoreEntries'])
          : [],
        approach: typeof obj.approach === 'string' ? obj.approach : '',
      }
    } catch {
      // fallthrough
    }
  }
  return {
    outline: text.trim(),
    selectedCharacters: [],
    referencedLoreEntries: [],
    approach: '',
  }
}

/** 解析无工具模式回吐的 <<<STATE>>>…<<<END>>> JSON（容错到首尾花括号） */
export function parseStatePatch(text: string): Record<string, unknown> | null {
  const match = text.match(/<<<STATE>>>\s*([\s\S]*?)\s*<<<END>>>/)
  const raw = match ? match[1] : text
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const obj = JSON.parse(s)
      return obj && typeof obj === 'object'
        ? (obj as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  const direct = tryParse(raw)
  if (direct) return direct
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) return tryParse(raw.slice(start, end + 1))
  return null
}

/** 正文因单次长度上限被截断时的续写指令 */
export const CONTINUE_INSTRUCTION = [
  '上面的正文因为单次长度上限被截断了。请从断点自然接着往下写：',
  '不要重复已经写过的内容，不要重新开头，不要写任何解释或标题，直接续接正文。',
].join('\n')

/**
 * 清理模型输出的章节摘要：去标记、去换行、限长。
 */
export function cleanChapterSummary(text: string): string {
  const flattened = text
    .replace(/<<<[\s\S]*?>>>/g, '')
    .replace(/```[a-zA-Z]*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  return flattened
    .replace(/^["'“”「」『』]+|["'“”「」『』]+$/g, '')
    .trim()
    .slice(0, 200)
}

/**
 * 构造生成阶段的用户指令。
 * 关键：把「已确认（作者可能改过）的大纲」显式写进消息。
 * 只写 session.plan 而无人读取时，模型会沿用它自己上一轮输出的 PLAN 原文，
 * 导致规划面板里的编辑不生效。
 */
export function buildGenerateInstruction(plan?: AgentPlan): string {
  const tail = '只输出正文，不要输出 @提及 标记、说明文字或标题。'
  const outline = plan?.outline?.trim()
  const approach = plan?.approach?.trim()
  if (!outline && !approach) return `请按已确认大纲续写小说正文。${tail}`

  const lines = [
    '请严格依据以下已确认的章节规划续写小说正文（作者可能已修订，一律以此为准，不要沿用你此前输出的任何版本）：',
    '',
  ]
  if (outline) {
    lines.push('【已确认大纲】', outline, '')
  }
  if (approach) {
    lines.push('【写法思路】', approach, '')
  }
  lines.push(tail)
  return lines.join('\n')
}

/** 稳定序列化（键名排序 + 递归归一 + 循环引用保护） */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet()
  const normalize = (v: any): any => {
    if (v === null || typeof v !== 'object') return v
    if (seen.has(v)) return '[Circular]'
    seen.add(v)
    if (Array.isArray(v)) return v.map(normalize)
    const obj: Record<string, unknown> = {}
    for (const key of Object.keys(v).sort()) {
      obj[key] = normalize(v[key])
    }
    return obj
  }
  try {
    return JSON.stringify(normalize(value))
  } catch {
    return String(value ?? '')
  }
}

/** 把一轮内的多次工具调用组合为稳定签名（与调用顺序、参数键序无关） */
export function buildRoundKey(
  tcs: ChatCompletionMessageFunctionToolCall[],
): string {
  const items = tcs.map((tc) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(tc.function.arguments || '{}')
    } catch {
      parsed = {}
    }
    return {
      name: tc.function.name,
      argsKey: stableStringify(parsed),
    }
  })
  items.sort((a, b) => {
    const na = a.name.localeCompare(b.name)
    if (na !== 0) return na
    return a.argsKey.localeCompare(b.argsKey)
  })
  return stableStringify(items)
}

// ===================== 交互面板（chat 模式）协议 =====================

/**
 * CONTENT 协议：无工具模式（deepseek-reasoner 等不支持 Function Calling 的模型）
 * 下，模型把「要写入章节的正文」包在 <<<CONTENT>>>…<<<END>>> 中回吐，
 * 客户端解析后按虚拟 append_to_chapter 落盘（与 STATE 协议同款思路）。
 */
export const CONTENT_BLOCK_PATTERN = /<<<CONTENT>>>\s*([\s\S]*?)\s*<<<END>>/

/** 从模型输出中解析 CONTENT 块（无工具模式下的写章正文）；未找到返回 null */
export function parseContentBlock(text: string): string | null {
  const match = text.match(CONTENT_BLOCK_PATTERN)
  if (!match) return null
  const content = match[1].trim()
  return content ? content : null
}

/**
 * 从「流式中的 tool 参数 JSON」增量提取 content 字段（纯函数）。
 *
 * 背景：streamChatWithTools 会把 tool_calls 的 arguments 以 delta 分片吐出，
 * 交互面板需要边收边渲染「正在写入的正文」预览。此函数对任意截断位置的
 * arguments 字符串做容错解析：
 * - 逐字符还原 JSON 字符串转义（\" \\ \n \t \r \uXXXX 等）
 * - 字符串未结束（流还没传完）时返回「已确定的部分」
 * - 尾部停在半截转义（如 \u 后不足 4 位 hex）时停在转义前
 */
export function extractPartialContent(args: string): string {
  const key = '"content"'
  const keyIdx = args.indexOf(key)
  if (keyIdx === -1) return ''

  let i = keyIdx + key.length
  while (i < args.length && /\s/.test(args[i])) i++
  if (args[i] !== ':') return ''
  i++
  while (i < args.length && /\s/.test(args[i])) i++
  if (args[i] !== '"') return ''
  i++

  let out = ''
  while (i < args.length) {
    const c = args[i]
    if (c !== '\\') {
      if (c === '"') break // 字符串正常结束
      out += c
      i++
      continue
    }
    const next = args[i + 1]
    if (next === undefined) break // 尾部停在孤立的反斜杠上
    switch (next) {
      case 'n':
        out += '\n'
        i += 2
        break
      case 't':
        out += '\t'
        i += 2
        break
      case 'r':
        out += '\r'
        i += 2
        break
      case 'b':
        out += '\b'
        i += 2
        break
      case 'f':
        out += '\f'
        i += 2
        break
      case '"':
        out += '"'
        i += 2
        break
      case '\\':
        out += '\\'
        i += 2
        break
      case '/':
        out += '/'
        i += 2
        break
      case 'u': {
        const hex = args.slice(i + 2, i + 6)
        const code = parseInt(hex, 16)
        // \uXXXX 不完整或非法：停在转义前（注意这里必须 return，break 只退出 switch）
        if (hex.length < 4 || Number.isNaN(code)) return out
        out += String.fromCharCode(code)
        i += 6
        break
      }
      default:
        // 未知转义：按字面保留（容错，不中断预览）
        out += next
        i += 2
    }
  }
  return out
}

/**
 * 追加写入章节正文（纯函数）。
 * 段落分隔由模型在 content 里自行控制（续接上文则不加空行，另起段落则自带换行），
 * 这里只做最外层归一：去掉 addition 尾部空白，避免落盘文件末尾堆空行。
 */
export function applyAppendToChapter(
  current: string,
  addition: string,
): { next: string; addedChars: number } {
  const add = addition.replace(/\s+$/, '')
  if (!add) return { next: current, addedChars: 0 }
  return { next: current + add, addedChars: add.length }
}

/**
 * 重写章节结尾（纯函数）：用 replacement 替换 current 的最后 chars 个字符。
 * chars 越界时收敛到 [0, current.length]；chars=0 等价于在结尾插入。
 */
export function applyReplaceTail(
  current: string,
  chars: number,
  replacement: string,
): { next: string; removedChars: number } {
  const removeLen = Math.max(
    0,
    Math.min(Math.floor(Number.isFinite(chars) ? chars : 0), current.length),
  )
  return {
    next: current.slice(0, current.length - removeLen) + replacement,
    removedChars: removeLen,
  }
}

/**
 * 连续重复轮检测：把本轮签名推入窗口，若最近 3 轮完全相同则返回 true
 * 并清空窗口（避免反复触发催促）。
 */
export function detectRepeatedRounds(
  window: string[],
  roundKey: string,
): boolean {
  window.push(roundKey)
  if (window.length > 3) window.shift()
  if (
    window.length === 3 &&
    window[0] === window[1] &&
    window[1] === window[2]
  ) {
    window.length = 0
    return true
  }
  return false
}
