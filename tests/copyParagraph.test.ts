/**
 * 「三击复制该段」纯函数回归测试。
 * 运行：pnpm test（node --test）。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findParagraphElement,
  getParagraphText,
  MAX_PARAGRAPH_CHARS,
  normalizeParagraphText,
} from '../src/utils/paragraph.ts'
import { writeTextToClipboard } from '../src/utils/clipboard.ts'

// ===================== 段落文本 =====================

test('normalizeParagraphText：压缩行内空白、保留换行、去首尾', () => {
  assert.equal(normalizeParagraphText('  你好\t  世界  '), '你好 世界')
  assert.equal(normalizeParagraphText('第一行\n\n第二行'), '第一行\n第二行')
  assert.equal(normalizeParagraphText('中文\u00a0中间'), '中文 中间')
  assert.equal(normalizeParagraphText('   '), '')
})

test('normalizeParagraphText：超长内容被截断，避免把整章当一段', () => {
  const result = normalizeParagraphText('字'.repeat(MAX_PARAGRAPH_CHARS + 100))
  assert.equal(result.length, MAX_PARAGRAPH_CHARS)
})

/** 造一个极简的 DOM 节点替身 */
function el(tag: string, content: string, parent: any = null) {
  return {
    tagName: tag.toUpperCase(),
    textContent: content,
    innerText: undefined,
    parentElement: parent,
  } as any
}

test('findParagraphElement：优先命中最近的语义段落 p', () => {
  const p = el('p', '这是要复制的一段。')
  const span = el('span', '这是要复制的一段。', p)
  assert.equal(findParagraphElement(span), p)
  assert.equal(getParagraphText(findParagraphElement(span)), '这是要复制的一段。')
})

test('findParagraphElement：跳过空块级元素，找到有文字的那一层', () => {
  const p = el('p', '有内容的段落')
  const emptyDiv = el('div', '', p)
  const span = el('span', '', emptyDiv)
  assert.equal(findParagraphElement(span), p)
})

test('findParagraphElement：只有 div 排版时用最近的 div 兜底', () => {
  const outerDiv = el('div', '第一段第二段')
  const innerDiv = el('div', '第一段', outerDiv)
  const span = el('span', '第一段', innerDiv)
  assert.equal(findParagraphElement(span), innerDiv)
  const spanInOuter = el('span', '第一段第二段', outerDiv)
  assert.equal(findParagraphElement(spanInOuter), outerDiv)
})

test('findParagraphElement：遇到 body/html 停止，不会把整章当成一段', () => {
  const html = el('html', '整本书')
  const body = el('body', '整本书', html)
  const span = el('span', '整本书', body)
  assert.equal(findParagraphElement(span), null)
})

test('getParagraphText：innerText 优先，否则用 textContent', () => {
  const node = el('p', '纯文本内容')
  assert.equal(getParagraphText(node), '纯文本内容')
  node.innerText = '带\n换行的文本'
  assert.equal(getParagraphText(node), '带\n换行的文本')
  assert.equal(getParagraphText(null), '')
})

// ===================== 剪贴板（静默：只有返回值，无 UI 反馈） =====================

const setGlobals = (navigatorValue: any, documentValue?: any) => {
  Object.defineProperty(globalThis, 'navigator', {
    value: navigatorValue,
    configurable: true,
    writable: true,
  })
  ;(globalThis as any).document = documentValue
}

test('writeTextToClipboard：优先用 navigator.clipboard.writeText', async () => {
  const written: string[] = []
  setGlobals({ clipboard: { writeText: async (t: string) => { written.push(t) } } })
  assert.equal(await writeTextToClipboard('要复制的一段'), true)
  assert.deepEqual(written, ['要复制的一段'])
})

test('writeTextToClipboard：clipboard API 抛错时回退到 execCommand', async () => {
  const calls: string[] = []
  const fakeTextarea: any = {
    value: '',
    style: {},
    setAttribute: () => {},
    select: () => { calls.push('select') },
    remove: () => { calls.push('remove') },
  }
  setGlobals(
    { clipboard: { writeText: async () => { throw new Error('permission denied') } } },
    {
      createElement: () => fakeTextarea,
      body: { appendChild: () => { calls.push('append') } },
      execCommand: (cmd: string) => { calls.push(cmd); return true },
    },
  )
  assert.equal(await writeTextToClipboard('兜底复制'), true)
  assert.equal(fakeTextarea.value, '兜底复制')
  assert.deepEqual(calls, ['append', 'select', 'copy', 'remove'])
})

test('writeTextToClipboard：两条路径都不可用/失败时返回 false（静默）', async () => {
  setGlobals({}, {
    createElement: () => ({
      value: '', style: {}, setAttribute: () => {}, select: () => {}, remove: () => {},
    }),
    body: { appendChild: () => {} },
    execCommand: () => false,
  })
  assert.equal(await writeTextToClipboard('复制不了'), false)
})
