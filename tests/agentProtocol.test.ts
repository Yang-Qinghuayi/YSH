/**
 * agentProtocol.test.ts
 * 协议层（PLAN/MEMORY 解析、生成指令、循环守卫）的回归测试。
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
  parseMemoryBlock,
  PLAN_BLOCK_PATTERN,
  INLINE_MEMORY_INSTRUCTION,
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

test('parseMemoryBlock：兼容标记、夹带文字、缺字段与垃圾输入', () => {
  const block = parseMemoryBlock(
    '<<<MEMORY>>>{"shortTerm":[{"characterName":"李明","shortTerm":"我刚得知师父未死"}],"longTerm":[]}<<<END>>>',
  )
  assert.deepEqual(block, {
    shortTerm: [{ characterName: '李明', shortTerm: '我刚得知师父未死' }],
    longTerm: [],
  })

  // 夹带文字 + 缺 longTerm 字段
  const loose = parseMemoryBlock('好的：{"shortTerm":[{"characterName":"苏婉","shortTerm":"x"}]} 以上')
  assert.equal(loose?.shortTerm[0]?.characterName, '苏婉')
  assert.deepEqual(loose?.longTerm, [])

  // 非对象元素被过滤；字段缺失补空串
  const odd = parseMemoryBlock(
    '<<<MEMORY>>>{"shortTerm":[1,null,{"characterName":"李明"}],"longTerm":[{"characterName":"李明","reason":"师父之死"}]}<<<END>>>',
  )
  assert.deepEqual(odd?.shortTerm, [{ characterName: '李明', shortTerm: '' }])
  assert.deepEqual(odd?.longTerm, [{ characterName: '李明', reason: '师父之死', revisedSkill: '' }])

  assert.equal(parseMemoryBlock('完全无法解析'), null)
  assert.equal(parseMemoryBlock('[1,2]'), null)
  assert.ok(INLINE_MEMORY_INSTRUCTION.includes('<<<MEMORY>>>'))
  assert.ok(INLINE_MEMORY_INSTRUCTION.includes('只写 TA 能知道的信息'))
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
