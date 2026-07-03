/**
 * deepseekService.ts
 * DeepSeek API 封装（兼容 OpenAI 格式）
 *
 * 重构后职责：
 * - parseMentions：解析 @提及（角色档案）
 * - sliceContextBeforeCursor：取光标前 N 字前文（供 read_context 工具与 prompt 复用）
 * - buildAgentSystemPrompt：按 Agent 阶段构建 system prompt
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
import type { Novel, Mention } from '@/types/novel'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
// 发给 AI 的前文上下文最大字符数
const MAX_CONTEXT_CHARS = 2000

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner'

export type AgentPhase = 'planning' | 'generating' | 'finalizing'

/** 流式事件：文本增量 / 工具调用（已聚合）/ 结束 */
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_calls'; toolCalls: ChatCompletionMessageFunctionToolCall[] }
  | { type: 'done'; finishReason: string | null; usage?: unknown }

// ===================== @提及解析 =====================

/** 解析编辑器文本中的 @提及 */
export function parseMentions(text: string, novel: Novel): Mention[] {
  const mentions: Mention[] = []
  // 角色档案合并后，仅支持 @角色名（文风 voice 随角色整体激活）
  const pattern = /@([一-龥\w]+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const [raw, name] = match

    // 找角色
    const character = novel.characters.find((c) => c.name === name)
    if (character) {
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

/** 构建 Agent system prompt（按阶段） */
export function buildAgentSystemPrompt(
  phase: AgentPhase,
  novel: Novel,
  storyStateText?: string,
): string {
  const lines: string[] = [
    '你是一位专业的中文小说创作 Agent，能自主调用工具调研上下文、规划章节并撰写正文。',
    '',
    '【小说简介】',
    novel.synopsis || '（无简介）',
    '',
  ]

  // 可用角色档案清单
  if (novel.characters.length > 0) {
    lines.push('【可用角色档案】')
    for (const c of novel.characters) {
      const brief = c.literaryReference
        ? `参考形象：${c.literaryReference}`
        : c.profile
          ? c.profile.slice(0, 60) + (c.profile.length > 60 ? '...' : '')
          : '（无描述）'
      lines.push(`- @${c.name}：${brief}`)
    }
    lines.push('')
  }

  // 故事状态摘要
  if (storyStateText && storyStateText.trim()) {
    lines.push('【当前故事状态】')
    lines.push(storyStateText)
    lines.push('')
  }

  // 阶段指令
  if (phase === 'planning') {
    lines.push('【当前任务：规划】')
    lines.push('1. 调用只读工具（query_lore / search_chapters / read_story_state / read_context / select_skill）调研本章所需上下文。')
    lines.push('2. 选定本章要调用的角色档案（select_skill），并引用相关 Lore 条目。')
    lines.push('3. 调研完成后，输出章节大纲。输出格式必须严格为：')
    lines.push('<<<PLAN>>>')
    lines.push('{"outline":"章节大纲（分场景/分段的写作要点）","selectedSkills":[{"id":"技能id","name":"名称","reason":"为何选用"}],"referencedLoreEntries":[{"id":"条目id","name":"名称"}],"approach":"整体写法思路"}')
    lines.push('<<<END>>>')
    lines.push('不要在 PLAN 标记之外输出正文。')
  } else if (phase === 'generating') {
    lines.push('【当前任务：生成正文】')
    lines.push('按已确认大纲续写小说正文。只输出正文，不要输出 @提及 标记、说明文字或标题。自然衔接前文，风格保持一致。')
  } else if (phase === 'finalizing') {
    lines.push('【当前任务：更新故事状态】')
    lines.push('根据本次生成的正文，调用 update_story_state 工具，以增量方式更新受影响的角色动态状态（心情/位置/伤势/持有物品/关系/经历 notes 等）。')
    lines.push('只提交发生变化的角色状态；lastUpdatedChapterId 设为当前章节 id。不要重复输出正文。')
  }

  return lines.join('\n')
}

/** 把故事状态摘要成供 system prompt 用的文本 */
export function summarizeStoryState(state: {
  characterStates: { characterName: string; mood?: string; location?: string; injuries?: string; possessions?: string[]; relationships: { target: string; relation: string }[]; notes?: string; lastUpdatedChapterId?: string }[]
  timeline?: { label: string }[]
  foreshadowings?: { description: string; status: string }[]
}): string {
  const lines: string[] = []
  if (state.characterStates.length > 0) {
    lines.push('角色状态：')
    for (const c of state.characterStates) {
      const parts: string[] = []
      if (c.mood) parts.push(`心情=${c.mood}`)
      if (c.location) parts.push(`位置=${c.location}`)
      if (c.injuries) parts.push(`伤势=${c.injuries}`)
      if (c.possessions?.length) parts.push(`持有=${c.possessions.join('/')}`)
      if (c.relationships?.length) parts.push(`关系=${c.relationships.map((r) => `${r.target}:${r.relation}`).join(',')}`)
      if (c.notes) parts.push(`notes=${c.notes}`)
      lines.push(`- ${c.characterName}：${parts.join('；') || '无变化'}`)
    }
  }
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
      tools: params.tools,
      tool_choice: params.tools?.length ? 'auto' : undefined,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: params.signal },
  )

  const toolCallAcc = new Map<number, { id: string; name: string; arguments: string }>()
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
          const acc = toolCallAcc.get(idx) ?? { id: '', name: '', arguments: '' }
          if (tc.id) acc.id = tc.id
          if (tc.function?.name) acc.name = tc.function.name
          if (tc.function?.arguments) acc.arguments += tc.function.arguments
          toolCallAcc.set(idx, acc)
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason
    }
    const chunkUsage = (chunk as { usage?: unknown }).usage
    if (chunkUsage) usage = chunkUsage
  }

  if (toolCallAcc.size > 0) {
    const toolCalls: ChatCompletionMessageFunctionToolCall[] = [...toolCallAcc.entries()]
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
