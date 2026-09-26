/**
 * agentChatProtocol.test.ts
 * 交互面板协议层纯函数（CONTENT 块解析、流式 tool 参数增量提取、写章合并）的回归测试。
 * 运行：pnpm test（node --test，依赖 Node 22 的内建类型擦除）
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAppendToChapter,
  applyReplaceTail,
  extractPartialContent,
  parseContentBlock,
} from '../src/services/agentProtocol.ts'

// ===================== extractPartialContent =====================

test('extractPartialContent：完整 JSON 提取', () => {
  const args = JSON.stringify({
    content: '雪夜。\n他推开了门。',
    position: 'end',
  })
  assert.equal(extractPartialContent(args), '雪夜。\n他推开了门。')
})

test('extractPartialContent：流式截断（字符串未闭合）返回已确定部分', () => {
  // 模拟只收到一半：结尾引号还没到（full 前 12 字符是键名部分，之后逐字符为正文）
  const full = JSON.stringify({ content: '第一段内容。第二段内容。' })
  const partial = full.slice(0, 20)
  const got = extractPartialContent(partial)
  assert.ok(got.length > 0)
  assert.equal(got, '第一段内容。第二')
})

test('extractPartialContent：处理 \\n / \\" / \\\\ 转义', () => {
  const args = JSON.stringify({ content: '他说："好"\n\\结束' })
  assert.equal(extractPartialContent(args), '他说："好"\n\\结束')
})

test('extractPartialContent：处理 \\uXXXX 转义', () => {
  const args = JSON.stringify({ content: '中\u004d文' })
  assert.equal(extractPartialContent(args), '中M文')
})

test('extractPartialContent：尾部停在半截 \\u 转义时不崩溃', () => {
  const args = '{"content":"开头\\u4e2' // \u4e2 缺 1 位 hex
  assert.equal(extractPartialContent(args), '开头')
})

test('extractPartialContent：尾部停在孤立反斜杠时不崩溃', () => {
  assert.equal(extractPartialContent('{"content":"abc\\'), 'abc')
})

test('extractPartialContent：content 键在其他键之后', () => {
  const args = JSON.stringify({ position: 'end', content: '正文' })
  assert.equal(extractPartialContent(args), '正文')
})

test('extractPartialContent：无 content 键 / 畸形输入返回空串', () => {
  assert.equal(extractPartialContent('{"chars":12}'), '')
  assert.equal(extractPartialContent(''), '')
  assert.equal(extractPartialContent('{"content": 123}'), '')
})

// ===================== parseContentBlock =====================

test('parseContentBlock：解析 CONTENT 块', () => {
  const text = '好的，我来续写。\n<<<CONTENT>>>\n雪夜。\n<<<END>>>\n写完。'
  assert.equal(parseContentBlock(text), '雪夜。')
})

test('parseContentBlock：无块 / 空块返回 null', () => {
  assert.equal(parseContentBlock('只是一段普通回复'), null)
  assert.equal(parseContentBlock('<<<CONTENT>>>   <<<END>>>'), null)
})

// ===================== applyAppendToChapter =====================

test('applyAppendToChapter：空章节直接写入', () => {
  const r = applyAppendToChapter('', '第一章正文\n第二段')
  assert.equal(r.next, '第一章正文\n第二段')
  assert.equal(r.addedChars, 9)
})

test('applyAppendToChapter：追加保留原文，去掉 addition 尾部空白', () => {
  // '\n\n  ' 整体都是尾部空白，会被去掉
  const r = applyAppendToChapter('原文。', '  新段落。\n\n  ')
  assert.equal(r.next, '原文。  新段落。')
  assert.equal(r.addedChars, 6)
})

test('applyAppendToChapter：空 addition 不改动', () => {
  const r = applyAppendToChapter('原文。', '   ')
  assert.equal(r.next, '原文。')
  assert.equal(r.addedChars, 0)
})

test('applyAppendToChapter：续接不加分隔（模型控制）', () => {
  const r = applyAppendToChapter('他推开门，', '看见了她。')
  assert.equal(r.next, '他推开门，看见了她。')
})

// ===================== applyReplaceTail =====================

test('applyReplaceTail：替换结尾 N 字', () => {
  const r = applyReplaceTail('一二三四五', 2, '四X')
  assert.equal(r.next, '一二三四X')
  assert.equal(r.removedChars, 2)
})

test('applyReplaceTail：chars 越界收敛（超过全文 = 全量替换）', () => {
  const r = applyReplaceTail('全文', 999, '重写后')
  assert.equal(r.next, '重写后')
  assert.equal(r.removedChars, 2)
})

test('applyReplaceTail：chars=0 等价于结尾插入；非法值按 0 处理', () => {
  assert.equal(applyReplaceTail('abc', 0, 'X').next, 'abcX')
  assert.equal(applyReplaceTail('abc', Number.NaN, 'X').next, 'abcX')
  assert.equal(applyReplaceTail('abc', -5, 'X').next, 'abcX')
})
