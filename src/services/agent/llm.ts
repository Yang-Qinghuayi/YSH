/**
 * llm.ts
 * DeepSeek（OpenAI 兼容）流式调用边界。
 * 只负责创建 client、聚合 tool-call 增量、产出统一事件；不维护会话状态。
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

import type { DeepSeekModel } from '@/types/agent';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * deepseek-reasoner 不支持 Function Calling / JSON Output。
 * 工具循环必须据此降级为 CONTENT / MEMORY 协议。
 */
export function supportsToolCalling(model: DeepSeekModel): boolean {
  return model !== 'deepseek-reasoner';
}

/**
 * 流式事件：文本增量 / 工具调用（已聚合）/ 工具参数增量 / 结束。
 * tool_args_delta 供交互面板实时预览「正在写入的正文」（append_to_chapter 的 content 参数）。
 */
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_calls'; toolCalls: ChatCompletionMessageFunctionToolCall[] }
  | {
      type: 'tool_args_delta';
      index: number;
      id: string;
      name: string;
      delta: string;
    }
  | { type: 'done'; finishReason: string | null; usage?: unknown };

/** 创建 DeepSeek（OpenAI 兼容）client */
export function createOpenAIClient(apiKey: string): OpenAI {
  if (!apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key');
  }
  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

/** 流式 tool-use 调用，返回事件流（text delta 即时产出；tool_calls 聚合后产出） */
export async function* streamChatWithTools(
  client: OpenAI,
  params: {
    model: DeepSeekModel;
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    maxTokens?: number;
    signal?: AbortSignal;
  }
): AsyncGenerator<StreamEvent> {
  const stream = await client.chat.completions.create(
    {
      model: params.model,
      messages: params.messages,
      // 空数组也要转成 undefined：部分模型（reasoner）收到 tools 字段会直接报错
      tools: params.tools?.length ? params.tools : undefined,
      tool_choice: params.tools?.length ? 'auto' : undefined,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: params.signal }
  );

  const toolCallAcc = new Map<number, { id: string; name: string; arguments: string }>();
  let finishReason: string | null = null;
  let usage: unknown;

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (choice) {
      const delta = choice.delta;
      if (delta?.content) yield { type: 'text', delta: delta.content };
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          const acc = toolCallAcc.get(idx) ?? {
            id: '',
            name: '',
            arguments: '',
          };
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) {
            acc.arguments += tc.function.arguments;
            // 参数增量事件：交互面板用它实时预览 append_to_chapter 的 content
            yield {
              type: 'tool_args_delta',
              index: idx,
              id: acc.id,
              name: acc.name,
              delta: tc.function.arguments,
            };
          }
          toolCallAcc.set(idx, acc);
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
    const chunkUsage = (chunk as { usage?: unknown }).usage;
    if (chunkUsage) usage = chunkUsage;
  }

  if (toolCallAcc.size > 0) {
    const toolCalls: ChatCompletionMessageFunctionToolCall[] = [...toolCallAcc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        id: v.id,
        type: 'function' as const,
        function: { name: v.name, arguments: v.arguments },
      }));
    yield { type: 'tool_calls', toolCalls };
  }
  yield { type: 'done', finishReason, usage };
}
