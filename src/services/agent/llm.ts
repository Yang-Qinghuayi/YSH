/**
 * llm.ts
 * DeepSeek（OpenAI 兼容）流式调用边界。
 * 只负责创建 client、发起 fetch/SSE 请求、聚合 tool-call 增量、产出统一事件；
 * 不维护会话状态。
 *
 * 直接用 fetch + SSE 而不是 `openai` SDK：协议够用、省掉 ~131 KB 体积，
 * 且 Tauri/Web 两端行为一致。
 */

import type { DeepSeekModel } from '@/types/agent';
import type {
  ChatCompletionChunk,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from '@/types/llm';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/** 单个请求的最长持续时间（DeepSeek 长文生成 + 工具轮次） */
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

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

export interface LlmClient {
  apiKey: string;
  baseURL: string;
}

/** 创建 DeepSeek（OpenAI 兼容）client 配置 */
export function createLlmClient(apiKey: string): LlmClient {
  if (!apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key');
  }
  return { apiKey, baseURL: DEEPSEEK_BASE_URL };
}

/** 兼容旧名（部分调用方仍按 OpenAI 语义命名） */
export const createOpenAIClient = createLlmClient;

/**
 * 把外部 AbortSignal 与超时合并成一个 signal。
 * 不用 AbortSignal.any：Tauri 在 macOS 12 上可能落到 Safari 15 内核，没有这个 API。
 */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let detach: (() => void) | null = null;

  const abort = (reason: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };

  timer = setTimeout(() => abort(new DOMException('请求超时', 'TimeoutError')), timeoutMs);

  if (signal) {
    if (signal.aborted) abort(signal.reason);
    else {
      const onAbort = () => abort(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      detach = () => signal.removeEventListener('abort', onAbort);
    }
  }

  return {
    signal: controller.signal,
    dispose() {
      if (timer) clearTimeout(timer);
      detach?.();
    },
  };
}

/**
 * 逐行读取 SSE 流，产出 `data:` 后的 JSON 文本。
 * 处理要点：跨 chunk 的半行、`[DONE]` 终止符、Windows 换行、注释行。
 */
async function* readSseData(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    for (;;) {
      if (signal.aborted) throw signal.reason ?? new DOMException('已取消', 'AbortError');
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      if (done) buffer += decoder.decode();

      let newlineIndex = buffer.search(/\r?\n/);
      while (newlineIndex >= 0) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(buffer[newlineIndex] === '\r' ? newlineIndex + 2 : newlineIndex + 1);
        const line = rawLine.trimEnd();
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          if (payload) yield payload;
        }
        newlineIndex = buffer.search(/\r?\n/);
      }
      if (done) break;
    }

    // 流结束时 buffer 里可能还有最后一行（没有换行结尾）
    const last = buffer.trim();
    if (last.startsWith('data:')) {
      const payload = last.slice(5).trim();
      if (payload && payload !== '[DONE]') yield payload;
    }
  } finally {
    reader.releaseLock();
  }
}

/** 流式 tool-use 调用，返回事件流（text delta 即时产出；tool_calls 聚合后产出） */
export async function* streamChatWithTools(
  client: LlmClient,
  params: {
    model: DeepSeekModel;
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    maxTokens?: number;
    signal?: AbortSignal;
  }
): AsyncGenerator<StreamEvent> {
  const timeout = withTimeout(params.signal, REQUEST_TIMEOUT_MS);

  const toolCallAcc = new Map<number, { id: string; name: string; arguments: string }>();
  let finishReason: string | null = null;
  let usage: ChatCompletionChunk['usage'] = null;

  try {
    const response = await fetch(`${client.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${client.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        // 空数组也要转成 undefined：部分模型（reasoner）收到 tools 字段会直接报错
        tools: params.tools?.length ? params.tools : undefined,
        tool_choice: params.tools?.length ? 'auto' : undefined,
        max_tokens: params.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: timeout.signal,
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `DeepSeek API 请求失败（${response.status} ${response.statusText}）${
          detail ? `：${detail.slice(0, 500)}` : ''
        }`
      );
    }

    for await (const payload of readSseData(response.body, timeout.signal)) {
      let chunk: ChatCompletionChunk;
      try {
        chunk = JSON.parse(payload) as ChatCompletionChunk;
      } catch {
        continue; // 心跳/注释等非 JSON 行直接跳过
      }

      const choice = chunk.choices?.[0];
      if (choice) {
        const delta = choice.delta;
        if (delta?.content) yield { type: 'text', delta: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            const acc = toolCallAcc.get(idx) ?? { id: '', name: '', arguments: '' };
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
      if (chunk.usage) usage = chunk.usage;
    }
  } finally {
    timeout.dispose();
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
