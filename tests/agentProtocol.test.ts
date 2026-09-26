/**
 * agentProtocol.test.ts
 * 协议层（PLAN/STATE 解析、生成指令、循环守卫）的回归测试。
 * 运行：pnpm test（node --test，依赖 Node 22 的内建类型擦除）
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGenerateInstruction,
  buildRoundKey,
  cleanChapterSummary,
  detectRepeatedRounds,
  parsePlan,
  parseStatePatch,
  PLAN_BLOCK_PATTERN,
  INLINE_STATE_INSTRUCTION,
} from '../src/services/agentProtocol.ts'

const toolCall = (name: string, args: unknown, id = 'x') => ({
  id,
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
})

test('parsePlan：解析合法的 PLAN 块', () => {
  const text =
    '<<<PLAN>>>{"outline":"山谷相遇","selectedCharacters":[{"id":"c1","name":"李明","reason":"主角"}],"referencedLoreEntries":[{"id":"e1","name":"青城派"}],"approach":"冷峻白描"}<<<END>>>'
  const plan = parsePlan(text)
  assert.equal(plan.outline, '山谷相遇')
  assert.equal(plan.selectedCharacters[0]?.name, '李明')
  assert.equal(plan.referencedLoreEntries[0]?.name, '青城派')
  assert.equal(plan.approach, '冷峻白描')
})

test('parsePlan：兼容历史字段名 selectedSkills', () => {
  const plan = parsePlan('<<<PLAN>>>{"outline":"x","selectedSkills":[{"id":"c1","name":"李明","reason":"r"}]}<<<END>>>')
  assert.equal(plan.selectedCharacters.length, 1)
  assert.equal(plan.selectedCharacters[0]?.id, 'c1')
})

test('parsePlan：坏 JSON 与无标记时都能兜底', () => {
  const broken = parsePlan('<<<PLAN>>>{不是JSON<<<END>>>')
  assert.ok(broken.outline.includes('不是JSON'))
  assert.deepEqual(broken.selectedCharacters, [])
  assert.equal(broken.approach, '')

  assert.equal(parsePlan('  直接就是大纲  ').outline, '直接就是大纲')
  assert.equal(PLAN_BLOCK_PATTERN.test('前缀 <<<PLAN>>>{}<<<END>>> 后缀'), true)
  assert.equal(PLAN_BLOCK_PATTERN.test('没有规划'), false)
})

test('buildGenerateInstruction：必须携带作者确认（可能改过）的大纲', () => {
  const plan = {
    outline: '【作者改过的】先写雨夜重逢，再写决裂',
    approach: '多用短句',
    selectedCharacters: [],
    referencedLoreEntries: [],
  }
  const instruction = buildGenerateInstruction(plan)
  assert.ok(instruction.includes('【作者改过的】先写雨夜重逢，再写决裂'))
  assert.ok(instruction.includes('多用短句'))
  assert.ok(instruction.includes('不要沿用你此前输出的任何版本'))
  assert.ok(instruction.includes('只输出正文'))

  // 无 plan / 空 outline 时退回通用指令
  assert.ok(buildGenerateInstruction().includes('请按已确认大纲续写小说正文'))
  assert.ok(
    buildGenerateInstruction({
      outline: '  ',
      approach: '',
      selectedCharacters: [],
      referencedLoreEntries: [],
    }).includes('请按已确认大纲续写小说正文'),
  )
})

test('parseStatePatch：兼容标记、裸 JSON、夹带文字与垃圾输入', () => {
  assert.deepEqual(
    parseStatePatch('<<<STATE>>>{"characterStates":[{"characterName":"李明"}]}<<<END>>>'),
    { characterStates: [{ characterName: '李明' }] },
  )
  assert.deepEqual(parseStatePatch('{"timeline":[{"label":"下山"}]}'), {
    timeline: [{ label: '下山' }],
  })
  assert.deepEqual(parseStatePatch('好的，更新如下：{"notes":"x"} 以上。'), { notes: 'x' })
  assert.equal(parseStatePatch('完全无法解析'), null)
  assert.equal(parseStatePatch('123'), null)
  assert.deepEqual(parseStatePatch('<<<STATE>>>{}<<<END>>>'), {}, '空补丁应为 {} 而非 null')
  assert.ok(INLINE_STATE_INSTRUCTION.includes('<<<STATE>>>'))
  assert.ok(INLINE_STATE_INSTRUCTION.includes('不要填空字符串占位'))
})

test('cleanChapterSummary：去标记、压平换行、限长', () => {
  assert.equal(cleanChapterSummary('  「李明在雨夜与苏婉重逢。」\n'), '李明在雨夜与苏婉重逢。')
  assert.equal(cleanChapterSummary('```\n# 摘要\n\n正文\n```'), '摘要 正文')
  assert.ok(cleanChapterSummary('长'.repeat(500)).length <= 200)
})

test('buildRoundKey：与参数键序、同轮调用顺序无关', () => {
  const k1 = buildRoundKey([toolCall('query_lore', { b: 2, a: 1 })])
  const k2 = buildRoundKey([toolCall('query_lore', { a: 1, b: 2 })])
  assert.equal(k1, k2, '参数键序不同 → 签名应相同')

  const k3 = buildRoundKey([
    toolCall('query_lore', { query: '剑' }),
    toolCall('read_context', { chars: 100 }),
  ])
  const k4 = buildRoundKey([
    toolCall('read_context', { chars: 100 }),
    toolCall('query_lore', { query: '剑' }),
  ])
  assert.equal(k3, k4, '同轮调用顺序不同 → 签名应相同')

  assert.notEqual(k1, buildRoundKey([toolCall('query_lore', { a: 1, b: 3 })]), '参数不同应不同')
  assert.notEqual(k1, buildRoundKey([toolCall('search_chapters', { a: 1, b: 2 })]), '工具不同应不同')
})

test('buildRoundKey：无法解析的参数按空对象处理', () => {
  const raw = (name: string, rawArgs: string) => ({
    id: 'x',
    type: 'function' as const,
    function: { name, arguments: rawArgs },
  })
  assert.equal(
    buildRoundKey([raw('query_lore', '{坏参数')]),
    buildRoundKey([toolCall('query_lore', {})]),
  )
  assert.equal(
    buildRoundKey([raw('query_lore', '')]),
    buildRoundKey([toolCall('query_lore', {})]),
  )
})

test('detectRepeatedRounds：连续三轮相同才触发，触发后清空窗口', () => {
  const window: string[] = []
  assert.equal(detectRepeatedRounds(window, 'A'), false)
  assert.equal(detectRepeatedRounds(window, 'A'), false)
  assert.equal(detectRepeatedRounds(window, 'A'), true, '第三轮应触发催促')
  assert.equal(window.length, 0, '触发后窗口应清空')

  const alternating: string[] = []
  detectRepeatedRounds(alternating, 'A')
  detectRepeatedRounds(alternating, 'B')
  detectRepeatedRounds(alternating, 'A')
  assert.equal(detectRepeatedRounds(alternating, 'A'), false, '非连续重复不应触发')
})
