/**
 * contextBudget.test.ts
 * 上下文预算裁剪的回归测试（对应缺陷 7.5：长线会话撑爆上下文）。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  enforceContextBudget,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateTokens,
} from '../src/services/contextBudget.ts'

type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }

const system = (content: string): Msg => ({ role: 'system', content })
const user = (content: string): Msg => ({ role: 'user', content })
const assistant = (content: string | null, toolCalls?: unknown[]): Msg =>
  ({ role: 'assistant', content, tool_calls: toolCalls })
const tool = (id: string, content: string): Msg => ({ role: 'tool', tool_call_id: id, content })

/** 构造一轮「assistant 调工具 + 工具结果」 */
function toolRound(i: number, bodyChars = 400): Msg[] {
  return [
    assistant(null, [{ id: `call-${i}`, type: 'function', function: { name: 'query_lore', arguments: '{}' } }]),
    tool(`call-${i}`, '中'.repeat(bodyChars)),
  ]
}

test('estimateTokens：CJK 按 1 字 1 token，其他按 1/3 估算', () => {
  assert.equal(estimateTokens(''), 0)
  assert.equal(estimateTokens('中'.repeat(10)), 10)
  assert.equal(estimateTokens('a'.repeat(30)), 10)
  assert.ok(estimateTokens('中文abc') >= 3)
})

test('estimateMessagesTokens：计入结构开销与 tool_calls', () => {
  const plain = estimateMessageTokens(user('你好'))
  assert.ok(plain > estimateTokens('你好'), '应包含结构开销')
  const withCalls = estimateMessageTokens(
    assistant(null, [{ id: 'c1', type: 'function', function: { name: 'query_lore', arguments: '{}' } }]),
  )
  assert.ok(withCalls > 4, 'tool_calls 应计入 token')
  assert.equal(estimateMessagesTokens([]), 0)
})

test('未超预算时不做任何改动', () => {
  const messages = [system('你是小说家'), user('写一章'), ...toolRound(1)] as never[]
  const before = JSON.stringify(messages)
  const result = enforceContextBudget(messages, { contextLimitTokens: 65536 })
  assert.equal(result.trimmed, 0)
  assert.equal(JSON.stringify(messages), before, '消息数组应保持原样')
})

test('超预算时丢弃最旧的工具轮，保留 system、首条 user 与最近轮次', () => {
  const messages = [
    system('系统提示'),
    user('章节概要'),
    ...toolRound(1),
    ...toolRound(2),
    ...toolRound(3),
  ] as never[]

  const result = enforceContextBudget(messages, {
    contextLimitTokens: 1000,
    reservedOutputTokens: 100,
    safetyRatio: 1,
    minRecentUnits: 1,
  })

  assert.ok(result.trimmed > 0, '应发生裁剪')
  const kept = messages as unknown as Msg[]
  assert.equal(kept[0].role, 'system', 'system 必须保留')
  assert.equal(kept[1].role, 'user', '首条 user 必须保留')
  assert.equal(kept[1].content, '章节概要')

  // 最后一轮工具调用必须完整保留（assistant + tool 成对）
  const lastToolIndex = kept.findLastIndex((m) => m.role === 'tool')
  assert.ok(lastToolIndex > 0)
  const before = kept[lastToolIndex - 1]
  assert.equal(before.role, 'assistant')
  assert.ok(Array.isArray(before.tool_calls), 'tool 消息前的 assistant 必须保留（协议配对）')

  // 成对性：每条 tool 消息前都应有带 tool_calls 的 assistant
  kept.forEach((m, i) => {
    if (m.role === 'tool') {
      assert.ok(i > 0 && kept[i - 1].role === 'assistant', 'tool 消息不得与 assistant 拆散')
    }
  })
})

test('至少保留最近 N 个单元，即使仍然超预算', () => {
  const messages = [
    system('s'),
    user('u'),
    ...toolRound(1, 5000),
    ...toolRound(2, 5000),
  ] as never[]

  const result = enforceContextBudget(messages, {
    contextLimitTokens: 100,
    safetyRatio: 1,
    minRecentUnits: 2,
  })
  assert.equal(result.trimmed, 0, '受 minRecentUnits 保护，无可裁剪单元')
  assert.equal((messages as unknown as Msg[]).length, 6)
})

test('预算包含预留输出与工具 schema 开销', () => {
  const messages = [
    system('s'),
    user('u'),
    ...toolRound(1, 200),
    ...toolRound(2, 200),
    ...toolRound(3, 200),
  ] as never[]

  // 预留输出越大，可裁剪空间越小（同预算下裁剪更多）
  const small = enforceContextBudget(structuredClone(messages) as never[], {
    contextLimitTokens: 2000,
    reservedOutputTokens: 0,
    safetyRatio: 1,
    minRecentUnits: 1,
  })
  const large = enforceContextBudget(messages, {
    contextLimitTokens: 2000,
    reservedOutputTokens: 1200,
    safetyRatio: 1,
    toolsOverheadTokens: 600,
    minRecentUnits: 1,
  })
  assert.ok(large.trimmed >= small.trimmed, '预留越多应裁剪越多')
})

test('只有固定前缀时不裁剪', () => {
  const messages = [system('s'), user('u')] as never[]
  const result = enforceContextBudget(messages, { contextLimitTokens: 10, safetyRatio: 1 })
  assert.equal(result.trimmed, 0)
  assert.equal((messages as unknown as Msg[]).length, 2)
})
