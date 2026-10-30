/**
 * tools/registry.ts
 * 工具注册表：按场景组合可用工具，并把定义转换成 OpenAI schema。
 * registry 必须与当轮传给模型的 tools 数组一致。
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

import type { AgentTool } from '@/types/agent';

import { updateLongTermMemoryTool, updateShortTermMemoryTool } from './memory';
import {
  queryLoreTool,
  readContextTool,
  readStoryStateTool,
  searchChaptersTool,
  selectCharactersTool,
} from './readonly';
import { appendToChapterTool, replaceTailTool } from './writing';

/** 只读工具（规划阶段） */
export const READONLY_TOOLS: AgentTool[] = [
  queryLoreTool,
  searchChaptersTool,
  readStoryStateTool,
  readContextTool,
  selectCharactersTool,
];

/** 定稿工具：改写短期记忆 */
export const SHORT_TERM_TOOLS: AgentTool[] = [updateShortTermMemoryTool];
/** 定稿工具：判断并改写长期记忆 */
export const LONG_TERM_TOOLS: AgentTool[] = [updateLongTermMemoryTool];
/** 全部定稿工具（无工具模式下按名字查执行器） */
export const FINALIZE_TOOLS: AgentTool[] = [updateShortTermMemoryTool, updateLongTermMemoryTool];

/** 写章工具（交互面板主循环可用） */
const CHAT_WRITE_TOOLS: AgentTool[] = [appendToChapterTool, replaceTailTool];

/** 交互面板主循环的完整工具集 = 只读调研 + 写章 */
export const CHAT_TOOLS: AgentTool[] = [...READONLY_TOOLS, ...CHAT_WRITE_TOOLS];

/** 按 name 查找工具执行器 */
export function findTool(name: string, tools: AgentTool[]): AgentTool | undefined {
  return tools.find((t) => t.def.function.name === name);
}

/** 把 AgentTool[] 转为 OpenAI tool schema 数组 */
export function toToolSchemas(tools: AgentTool[]): ChatCompletionTool[] {
  return tools.map((t) => t.def);
}
