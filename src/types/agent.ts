/**
 * agent.ts
 * Agent 领域的共享数据结构。
 *
 * 这一层只描述数据，不依赖任何 service / store / Vue，避免 UI 状态类型反向依赖引擎实现。
 */

import type { ChatCompletionFunctionTool, ChatCompletionMessageParam } from '@/types/llm';
import type { ChapterMeta, Mention, Novel } from '@/types/novel';

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

/** Agent 会话的生命周期阶段 */
export type SessionPhase =
  'idle' | 'planning' | 'awaiting_confirmation' | 'generating' | 'finalizing' | 'done' | 'canceled';

/** 模型输出并由作者确认的章节规划 */
export interface AgentPlan {
  outline: string;
  /** 历史字段名为 selectedSkills，解析时兼容 */
  selectedCharacters: { id: string; name: string; reason: string }[];
  referencedLoreEntries: { id: string; name: string }[];
  approach: string;
}

/** 运行 Agent 所需的外部配置 */
export interface AgentConfig {
  apiKey: string;
  model: DeepSeekModel;
  /** 交互面板：目标字数（500/1000/1500/2000） */
  lengthTarget?: number;
}

/** 上下文裁剪结果（结构上兼容 contextBudget.ContextBudgetResult） */
export interface ContextTrimInfo {
  trimmed: number;
  estimatedTokens: number;
  originalTokens: number;
  trimmedUnits: number;
}

/** 运行时通知。只包含单次模型调用 / 工具执行真正需要的回调。 */
export interface AgentRuntimeCallbacks {
  onStatus?: (text: string) => void;
  onToolCall?: (log: { tool: string; status: 'running' | 'done'; text: string }) => void;
  onContextTrimmed?: (info: ContextTrimInfo) => void;
  onWarn?: (message: string) => void;
}

/** 写章工具 / toolFree 虚拟写章产生的写入数据 */
export interface ChatWriteData {
  chapterId: string;
  chapterTitle: string;
  /** 写入后的章节全文（用于同步编辑器） */
  newContent: string;
  addedChars: number;
  removedChars?: number;
  /** 写入前的正文快照（用于「撤销」；仅最近几条持久化） */
  snapshot?: string;
}

/** 模型会话。由页面编排层持有，不进入 Pinia。 */
export interface AgentSession {
  novelId: string;
  chapterId: string;
  novel: Novel;
  chapter: ChapterMeta;
  chapterContent: string;
  cursorPosition: number;
  phase: SessionPhase;
  messages: ChatCompletionMessageParam[];
  plan?: AgentPlan;
  forcedMentions: Mention[];
  abortController: AbortController;
  /** 取编辑器里的最新正文，避免工具写章时覆盖用户手动编辑 */
  liveContent?: () => string;
}

/** 交互面板一轮对话的输入 */
export interface ChatTurnInput {
  /** 转录里展示的用户消息 */
  visibleText: string;
  /** 实际发给模型的消息（快捷动作会附加隐藏上下文） */
  llmText?: string;
  /** 强制走规划路径 */
  forcePlan?: boolean;
}

/** 交互面板一轮对话的 UI 事件 */
export interface ChatTurnCallbacks extends AgentRuntimeCallbacks {
  onPhase?: (phase: SessionPhase) => void;
  onTextDelta?: (delta: string) => void;
  onToolStart?: (tool: string, argsSummary: string) => void;
  onWritePreview?: (tool: string, partial: string) => void;
  onToolEnd?: (tool: string, ok: boolean, resultText: string, write?: ChatWriteData) => void;
  onVirtualWrite?: (content: string) => void;
  onPlanReady?: (plan: AgentPlan) => void;
  onError?: (e: unknown) => void;
  onDone?: () => void;
}

/** 工具执行上下文 */
export interface ToolContext {
  novel: Novel;
  chapter: ChapterMeta;
  chapterContent: string;
  cursorPosition: number;
  liveContent?: () => string;
}

/** 工具执行结果。text 是回传模型的摘要，data 是可选的结构化结果。 */
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  text: string;
}

/** Function Calling 工具定义 */
export interface AgentTool {
  def: ChatCompletionFunctionTool;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export type ChatQuickAction = 'continue-prev' | 'continue-current';
