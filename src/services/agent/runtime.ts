/**
 * runtime.ts
 * 一次模型调用的公共运行时：上下文预算、流式请求、工具结果回填。
 * 不实现具体业务流程；多轮对话与定稿流程都在各自模块中组合这些原语。
 */

import { DEFAULT_CONTEXT_LIMIT_TOKENS, enforceContextBudget } from '@/services/agent/contextBudget';
import { createOpenAIClient, streamChatWithTools } from '@/services/agent/llm';
import { findTool, toToolSchemas } from '@/services/agent/tools/registry';
import type {
  AgentConfig,
  AgentRuntimeCallbacks,
  AgentSession,
  AgentTool,
  ToolContext,
  ToolResult,
} from '@/types/agent';
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
} from '@/types/llm';

export interface RunOneTurnOptions {
  tools?: AgentTool[];
  maxTokens: number;
  onTextDelta?: (delta: string) => void;
  onToolArgsDelta?: (index: number, id: string, name: string, delta: string) => void;
  callbacks?: AgentRuntimeCallbacks;
}

export interface OneTurnResult {
  text: string;
  toolCalls: ChatCompletionMessageFunctionToolCall[] | null;
  finishReason: string | null;
}

function sessionToolContext(session: AgentSession): ToolContext {
  return {
    novel: session.novel,
    chapter: session.chapter,
    chapterContent: session.chapterContent,
    cursorPosition: session.cursorPosition,
    liveContent: session.liveContent,
  };
}

/**
 * 执行一批 tool_calls，并把结果以 role='tool' 回填到会话。
 * registry 必须与产生这批调用时传给模型的 tools 列表完全一致。
 */
export async function executeToolCalls(
  session: AgentSession,
  toolCalls: ChatCompletionMessageFunctionToolCall[],
  registry: AgentTool[],
  callbacks: AgentRuntimeCallbacks = {}
): Promise<void> {
  const ctx = sessionToolContext(session);
  for (const call of toolCalls) {
    const tool = findTool(call.function.name, registry);
    callbacks.onToolCall?.({
      tool: call.function.name,
      status: 'running',
      text: '',
    });

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
    } catch {
      args = {};
    }

    let result: ToolResult;
    if (!tool) {
      result = { ok: false, text: `未知工具：${call.function.name}` };
    } else {
      try {
        result = await tool.execute(args, ctx);
      } catch (e) {
        result = {
          ok: false,
          error: String(e),
          text: `工具 ${call.function.name} 执行失败：${e}`,
        };
      }
    }

    callbacks.onToolCall?.({
      tool: call.function.name,
      status: 'done',
      text: result.text,
    });
    session.messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: result.text,
    } as ChatCompletionMessageParam);
  }
}

/** 单次流式模型调用；返回聚合文本、工具调用和 finish_reason */
export async function runOneTurn(
  session: AgentSession,
  config: AgentConfig,
  options: RunOneTurnOptions
): Promise<OneTurnResult> {
  const tools = options.tools ?? [];
  applyContextBudget(session, tools, options.maxTokens, options.callbacks);

  const client = createOpenAIClient(config.apiKey);
  let text = '';
  let toolCalls: ChatCompletionMessageFunctionToolCall[] | null = null;
  let finishReason: string | null = null;

  for await (const event of streamChatWithTools(client, {
    model: config.model,
    messages: session.messages,
    tools: toToolSchemas(tools),
    maxTokens: options.maxTokens,
    signal: session.abortController.signal,
  })) {
    if (event.type === 'text') {
      text += event.delta;
      options.onTextDelta?.(event.delta);
    } else if (event.type === 'tool_calls') {
      toolCalls = event.toolCalls;
    } else if (event.type === 'tool_args_delta') {
      options.onToolArgsDelta?.(event.index, event.id, event.name, event.delta);
    } else if (event.type === 'done') {
      finishReason = event.finishReason;
    }
  }

  session.messages.push({
    role: 'assistant',
    content: text || null,
    tool_calls: toolCalls ?? undefined,
  } as ChatCompletionMessageParam);

  return { text, toolCalls, finishReason };
}

/** 超预算时从最旧的工具调研单元开始裁剪，不拆散 assistant/tool 配对 */
function applyContextBudget(
  session: AgentSession,
  tools: AgentTool[],
  maxTokens: number,
  callbacks?: AgentRuntimeCallbacks
): void {
  const info = enforceContextBudget(session.messages, {
    contextLimitTokens: DEFAULT_CONTEXT_LIMIT_TOKENS,
    reservedOutputTokens: maxTokens,
    toolsOverheadTokens: tools.length * 120,
  });
  if (info.trimmed > 0) {
    callbacks?.onContextTrimmed?.(info);
    callbacks?.onStatus?.('上下文接近上限，已省略部分早期调研结果…');
  }
}
