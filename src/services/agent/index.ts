/**
 * services/agent/index.ts
 * Agent 引擎对页面层暴露的唯一公共入口。
 *
 * 页面只依赖这个 barrel；内部模块（runtime / chat / tools / prompts）可以自由重组，
 * 不会把实现细节扩散到 UI。测试可以直接引入内部模块验证边界。
 */

export type {
  AgentConfig,
  AgentPlan,
  AgentRuntimeCallbacks,
  AgentSession,
  ChatQuickAction,
  ChatTurnCallbacks,
  ChatTurnInput,
  ChatWriteData,
  ContextTrimInfo,
  DeepSeekModel,
  SessionPhase,
  ToolContext,
  ToolResult,
} from '@/types/agent';
export type { ChatMsg, ChatSessionFile } from '@/types/agentChat';

// 交互面板：会话、引擎、快捷动作、文件 IO、无工具写章
export { runChatGenerateTurn, runChatTurn } from './chat/engine';
export {
  buildContinueCurrentTask,
  buildContinuePrevTask,
  findPrevChapter,
} from './chat/quickActions';
export { abortChatSession, createChatSession, restoreSessionMessages } from './chat/session';
export {
  deleteChatSessionFile,
  loadChatSessionFile,
  saveChatSessionFile,
} from './chat/sessionFile';
export { prepareTranscriptForPersist } from './chat/transcript';
export { buildVirtualWrite } from './chat/write';

// 本章定稿
export {
  FINALIZE_STEP_LABELS,
  type FinalizeCallbacks,
  type FinalizeInput,
  type FinalizeResult,
  type FinalizeStep,
  runChapterFinalize,
} from './finalize';

// 页面需要的纯协议 / 文本工具
export { PLAN_BLOCK_PATTERN } from './protocol';
export { parseMentions } from './text';
