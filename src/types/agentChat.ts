/**
 * agentChat.ts 类型
 * 交互面板（chat 模式）的转录消息与持久化文件结构。
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { AgentPlan, SessionPhase } from '@/services/agentService'

/** 写章工具（append_to_chapter / replace_tail）产生的写入数据 */
export interface ChatWriteData {
  chapterId: string
  chapterTitle: string
  /** 写入后的章节全文（用于同步编辑器） */
  newContent: string
  addedChars: number
  removedChars?: number
  /** 写入前的正文快照（用于「撤销」；仅保留最近几条，防文件膨胀） */
  snapshot?: string
}

export type ChatMsg =
  | { id: string; kind: 'user'; text: string; ts: number }
  | {
      id: string
      kind: 'assistant'
      text: string
      streaming: boolean
      ts: number
    }
  | {
      id: string
      kind: 'tool'
      tool: string
      status: 'running' | 'done' | 'error'
      /** 参数摘要（默认展示的一行说明） */
      argsSummary: string
      /** 工具返回文本（展开看细节） */
      resultText?: string
      /** 写章工具：正在写入的正文实时预览 */
      preview?: string
      /** 写章工具：写入数据 */
      write?: ChatWriteData
      ts: number
    }
  | {
      id: string
      kind: 'plan'
      plan: AgentPlan
      /** 大纲草稿（用户可编辑，确认时以它为准） */
      outlineDraft: string
      status: 'pending' | 'confirmed' | 'cancelled' | 'superseded'
      ts: number
    }
  | { id: string; kind: 'system'; text: string; ts: number }

/** 存到 <小说文件夹>/agent-chat/<chapterId>.json 的会话文件 */
export interface ChatSessionFile {
  version: 1
  chapterId: string
  chapterTitle: string
  updatedAt: number
  /** UI 转录（持久化前会裁剪：工具细节与快照限量） */
  transcript: ChatMsg[]
  /** LLM 消息历史（恢复多轮上下文） */
  llmMessages: ChatCompletionMessageParam[]
  /** 保存时的阶段（awaiting_confirmation 时重开面板恢复待确认 plan 卡） */
  phase: SessionPhase
}
