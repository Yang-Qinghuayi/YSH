/**
 * 最小 OpenAI 兼容协议类型（DeepSeek）
 *
 * 只保留本项目实际用到的字段，取代 `openai` SDK 的体积（打包 131 KB / 31.6 KB gzip）
 * 与 16 MB 安装体积。DeepSeek 的 `/chat/completions` 与 OpenAI 协议一致，
 * 这里给出的是「够用且可校验」的子集。
 */

export interface ChatCompletionFunctionCall {
  name: string;
  arguments: string;
}

export interface ChatCompletionMessageFunctionToolCall {
  id: string;
  type: 'function';
  function: ChatCompletionFunctionCall;
}

/** 传给模型的工具声明（JSON Schema） */
export interface ChatCompletionFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    // JSON Schema 是任意结构，用 unknown 记录更贴切
    parameters: Record<string, unknown>;
  };
}

export type ChatCompletionTool = ChatCompletionFunctionTool;

export interface ChatCompletionSystemMessageParam {
  role: 'system';
  content: string;
  name?: string;
}

export interface ChatCompletionUserMessageParam {
  role: 'user';
  content: string;
  name?: string;
}

export interface ChatCompletionAssistantMessageParam {
  role: 'assistant';
  content?: string | null;
  tool_calls?: ChatCompletionMessageFunctionToolCall[];
  name?: string;
}

export interface ChatCompletionToolMessageParam {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export type ChatCompletionMessageParam =
  | ChatCompletionSystemMessageParam
  | ChatCompletionUserMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionToolMessageParam;

/** 流式 chunk（只声明用到的字段） */
export interface ChatCompletionChunk {
  id?: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}
