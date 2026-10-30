/**
 * agentChat.ts 类型
 * Agent 交互面板的 UI 转录消息与会话文件结构。
 *
 * 领域数据结构统一放在 types/agent.ts；本文件只描述 UI 层看到的消息形状。
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { AgentPlan, ChatWriteData, SessionPhase } from '@/types/agent';

export type { ChatWriteData } from '@/types/agent';

export type ChatMsg =
  | { id: string; kind: 'user'; text: string; ts: number }
  | {
      id: string;
      kind: 'assistant';
      text: string;
      streaming: boolean;
      ts: number;
    }
  | {
      id: string;
      kind: 'tool';
      tool: string;
      status: 'running' | 'done' | 'error';
      /** 参数摘要（默认展示的一行说明） */
      argsSummary: string;
      /** 工具返回文本（展开看细节） */
      resultText?: string;
      /** 写章工具：正在写入的正文实时预览 */
      preview?: string;
      /** 写章工具：写入数据 */
      write?: ChatWriteData;
      ts: number;
    }
  | {
      id: string;
      kind: 'plan';
      plan: AgentPlan;
      /** 大纲草稿（用户可编辑，确认时以它为准） */
      outlineDraft: string;
      status: 'pending' | 'confirmed' | 'cancelled' | 'superseded';
      ts: number;
    }
  | { id: string; kind: 'system'; text: string; ts: number };

/** 存到 <小说文件夹>/agent-chat/<chapterId>.json 的会话文件 */
export interface ChatSessionFile {
  version: 1;
  chapterId: string;
  chapterTitle: string;
  updatedAt: number;
  /** UI 转录（持久化前会裁剪工具细节与快照） */
  transcript: ChatMsg[];
  /** LLM 消息历史（恢复多轮上下文） */
  llmMessages: ChatCompletionMessageParam[];
  /** 保存时的阶段（awaiting_confirmation 时重开面板恢复待确认 plan 卡） */
  phase: SessionPhase;
}
