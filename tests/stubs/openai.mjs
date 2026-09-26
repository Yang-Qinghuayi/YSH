/**
 * openai.mjs — `openai` 包的测试替身
 *
 * 只替换最外层的网络边界：真实的 deepseekService（含 streamChatWithTools 的
 * 流式聚合逻辑）、agentService、agentTools 全部原样运行，因此本测试覆盖的是
 * 真实的事件聚合与状态机，而不是重写的近似实现。
 *
 * 支持能力：
 * - text / toolCalls / finishReason（含 length → 触发截断续写分支）
 * - delayMs：逐块延迟，用于制造取消窗口
 * - AbortSignal：延迟期间被 abort 时抛出 AbortError（与真实 SDK 行为一致）
 */
import { nextTurn } from './modelScript.mjs'

function abortError() {
  const e = new Error('Request was aborted.')
  e.name = 'AbortError'
  return e
}

function sleepAbortable(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = () => {
      cleanup()
      reject(abortError())
    }
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** 把一轮“剧本”展开成 OpenAI 流式 chunk 序列 */
function toChunks(turn) {
  const chunks = []
  if (turn.text) {
    chunks.push({ choices: [{ delta: { content: turn.text }, finish_reason: null }] })
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
    })
  }
  const finishReason =
    turn.finishReason ?? (turn.toolCalls?.length ? 'tool_calls' : 'stop')
  chunks.push({
    choices: [{ delta: {}, finish_reason: finishReason }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  })
  return chunks
}

export default class OpenAI {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey
    this.baseURL = opts.baseURL
    this.chat = {
      completions: {
        create: async (params, opts2) => {
          const turn = nextTurn(params)
          const chunks = toChunks(turn)
          const signal = opts2?.signal
          const delayMs = turn.delayMs ?? 0
          return (async function* () {
            for (const chunk of chunks) {
              if (delayMs > 0) await sleepAbortable(delayMs, signal)
              if (signal?.aborted) throw abortError()
              yield chunk
            }
          })()
        },
      },
    }
  }
}
