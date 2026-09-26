/**
 * modelScript.mjs — 假模型的“剧本”
 *
 * 测试把每一“轮”期望的模型响应推入队列，假 OpenAI client 按调用顺序取出。
 * 同时记录每次请求的完整参数（messages/tools/model/max_tokens），供断言使用
 * ——这是验证「作者编辑过的大纲是否真的进入请求」「是否注入前情提要」等的关键。
 */

export const state = {
  /** 待消费的轮次 */
  turns: [],
  /** 每次模型请求的入参（按顺序） */
  requests: [],
}

export function resetScript() {
  state.turns.length = 0
  state.requests.length = 0
}

/** 推入一轮响应 */
export function pushTurn(turn) {
  state.turns.push(turn)
}

/** 推入多轮响应 */
export function pushTurns(turns) {
  for (const t of turns) state.turns.push(t)
}

/**
 * 取下一轮（由假 client 调用）；脚本用尽时抛错，避免测试静默通过。
 *
 * 注意：真实调用把 session.messages **按引用**传下来，后续仍会被追加。
 * 因此这里必须快照，否则测试断言看到的会是会话结束后的最终消息列表。
 */
export function nextTurn(params) {
  state.requests.push({
    ...params,
    messages: (params.messages ?? []).map((m) => ({ ...m })),
    tools: params.tools ? params.tools.map((t) => ({ ...t })) : params.tools,
  })
  if (state.turns.length === 0) {
    throw new Error(
      `假模型脚本已用尽：收到了第 ${state.requests.length} 次请求（测试漏推了一轮响应）`,
    )
  }
  return state.turns.shift()
}

/** 便捷断言辅助：把某次请求的 messages 拍平成文本 */
export function requestText(index) {
  const req = state.requests[index]
  if (!req) return ''
  return (req.messages ?? [])
    .map((m) => {
      if (typeof m.content === 'string') return m.content
      if (Array.isArray(m.content)) return JSON.stringify(m.content)
      return ''
    })
    .join('\n')
}

/** 便捷断言辅助：某次请求是否带工具（tools 非空） */
export function requestToolNames(index) {
  const req = state.requests[index]
  if (!req?.tools) return []
  return req.tools.map((t) => t.function?.name)
}

/** 便捷断言辅助：某次请求的最后一条消息内容 */
export function lastMessageText(index) {
  const req = state.requests[index]
  if (!req) return ''
  const msgs = req.messages ?? []
  const last = msgs[msgs.length - 1]
  if (!last) return ''
  return typeof last.content === 'string' ? last.content : ''
}
