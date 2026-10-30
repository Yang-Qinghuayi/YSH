/**
 * fetch.mjs — 网络边界替身（替代原来的 `openai` 包替身）
 *
 * `src/services/agent/llm.ts` 直接用 `fetch` + SSE 调用 DeepSeek，所以测试只需替换
 * 全局 `fetch`：真实的 SSE 解析、chunk 聚合、状态机、工具执行全部原样运行，
 * 覆盖的仍是真实逻辑，而不是重写的近似实现。
 *
 * 支持能力：
 * - text / toolCalls / finishReason（含 length → 触发截断续写分支）
 * - delayMs：逐块延迟，用于制造取消窗口
 * - AbortSignal：延迟期间被 abort 时以 AbortError 结束流（与真实 fetch 一致）
 */
import { nextTurn } from './modelScript.mjs';

const encoder = new TextEncoder();

function abortError() {
  const e = new Error('The operation was aborted.');
  e.name = 'AbortError';
  return e;
}

function sleepAbortable(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 把一轮“剧本”展开成 OpenAI 流式 chunk 序列 */
function toChunks(turn) {
  const chunks = [];
  if (turn.text) {
    chunks.push({ choices: [{ delta: { content: turn.text }, finish_reason: null }] });
  }
  if (turn.toolCalls?.length) {
    chunks.push({
      choices: [
        {
          delta: {
            tool_calls: turn.toolCalls.map((tc, i) => ({
              index: i,
              id: tc.id ?? `call_${i}`,
              function: {
                name: tc.name,
                arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {}),
              },
            })),
          },
          finish_reason: null,
        },
      ],
    });
  }
  const finishReason = turn.finishReason ?? (turn.toolCalls?.length ? 'tool_calls' : 'stop');
  chunks.push({
    choices: [{ delta: {}, finish_reason: finishReason }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  return chunks;
}

function sseLine(chunk) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * 安装 fetch 替身，返回卸载函数。
 * 任何非 `/chat/completions` 的请求都会抛错，避免测试静默联网。
 */
export function installFetchStub() {
  const original = globalThis.fetch;

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    if (!url.includes('/chat/completions')) {
      throw new Error(`[fetch stub] 未预期的网络请求：${url}`);
    }
    const params = init.body ? JSON.parse(String(init.body)) : {};
    const turn = nextTurn(params);
    const signal = init.signal;
    const delayMs = turn.delayMs ?? 0;
    const chunks = toChunks(turn);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const chunk of chunks) {
            if (delayMs > 0) await sleepAbortable(delayMs, signal);
            if (signal?.aborted) throw abortError();
            controller.enqueue(encoder.encode(sseLine(chunk)));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (e) {
          try {
            controller.error(e);
          } catch {
            /* 流可能已被取消 */
          }
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  return () => {
    globalThis.fetch = original;
  };
}
