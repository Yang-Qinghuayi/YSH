/**
 * 三击复制的点击序列回归测试。
 * 运行：pnpm test（node --test）。
 *
 * 用 registerHooks 把环境相关模块替身掉，其余源码保持真实。
 */

import { registerHooks } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ysh-tripleclick-'))
const stubFile = path.join(tmp, 'stubs.mjs')
fs.writeFileSync(
  stubFile,
  `
export const state = {
  copyEnabled: true,
  selectionText: '三击选中的整段文字',
  posted: [],
}
export const useSettingStore = () => ({ get copyParagraphOnClick() { return state.copyEnabled } })
export const DOUBLE_CLICK_INTERVAL_THRESHOLD_MS = 250
export const DISABLE_DOUBLE_CLICK_ON_MOBILE = false
export const LONG_HOLD_THRESHOLD = 500
export const getOSPlatform = () => 'unknown'
export const eventDispatcher = { dispatch: () => {}, dispatchSync: () => false }
`,
)

const stubURL = pathToFileURL(stubFile).href
const stubbed = new Set([
  '@/services/constants',
  '@/store/setting',
  '@/utils/misc',
  '@/utils/event',
])

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubbed.has(specifier)) return { url: stubURL, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = path.join(root, 'src', specifier.slice(2))
      for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }
    return nextResolve(specifier, context)
  },
})
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }))

const { state } = await import(stubURL)
globalThis.window = {
  postMessage: (data: any) => { state.posted.push(data) },
  screenX: 0,
  innerWidth: 800,
}

const { handleClick, handleMousedown } = await import('../src/utils/iframeEventHandlers.ts')

const flush = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
  state.copyEnabled = true
  state.selectionText = '三击选中的整段文字'
  state.posted = []
})

/** 每个测试用不同的 x，避免跨测试被误判为同一次连续点击序列 */
function makeClick(detail: number, x: number) {
  const target: any = {
    tagName: 'P',
    textContent: '兜底段落文本',
    innerText: undefined,
    parentElement: null,
    classList: { contains: () => false },
    getAttribute: () => null,
    ownerDocument: {
      getSelection: () => ({
        isCollapsed: state.selectionText === '',
        toString: () => state.selectionText,
      }),
    },
  }
  return {
    detail,
    button: 0,
    clientX: x,
    clientY: 300,
    screenX: x,
    screenY: 300,
    offsetX: 0,
    offsetY: 0,
    target,
  } as any
}

const messages = (type: string) => state.posted.filter((m: any) => m.type === type)

test('三击：用浏览器选区文本发出 iframe-triple-click，且不发出单击翻页', async () => {
  const x = 100
  handleMousedown('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(2, x))
  handleClick('book-1', makeClick(3, x))
  await flush()

  const triple = messages('iframe-triple-click')
  assert.equal(triple.length, 1)
  assert.equal(triple[0].text, '三击选中的整段文字')
  assert.equal(triple[0].bookKey, 'book-1')
  assert.equal(messages('iframe-single-click').length, 0, '三击序列不应触发单击翻页')
})

test('开关关闭：三击只保留浏览器选段，不复制也不翻页', async () => {
  state.copyEnabled = false
  const x = 200
  handleMousedown('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(2, x))
  handleClick('book-1', makeClick(3, x))
  await flush()

  assert.equal(messages('iframe-triple-click').length, 0)
  assert.equal(messages('iframe-single-click').length, 0)
})

test('三击但选区为空（点在图片/空白）：退化到最近段落文本', async () => {
  state.selectionText = ''
  const x = 300
  handleMousedown('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(2, x))
  handleClick('book-1', makeClick(3, x))
  await flush()

  const triple = messages('iframe-triple-click')
  assert.equal(triple.length, 1)
  assert.equal(triple[0].text, '兜底段落文本')
})

test('无 event.detail 的 webview：本地点击计数也能识别三击', async () => {
  const x = 400
  handleMousedown('book-1', makeClick(0, x))
  handleClick('book-1', makeClick(0, x))
  handleClick('book-1', makeClick(0, x))
  handleClick('book-1', makeClick(0, x))
  await flush()
  assert.equal(messages('iframe-triple-click').length, 1)
})

test('单击：延迟后仍发出 iframe-single-click，翻页行为不受影响', async () => {
  const x = 500
  handleMousedown('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(1, x))
  await flush()

  assert.equal(messages('iframe-single-click').length, 1)
  assert.equal(messages('iframe-triple-click').length, 0)
})

test('双击：只发 iframe-double-click，不产生单击翻页', async () => {
  const x = 600
  handleMousedown('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(1, x))
  handleClick('book-1', makeClick(2, x))
  await flush()

  assert.equal(messages('iframe-double-click').length, 1)
  assert.equal(messages('iframe-single-click').length, 0)
  assert.equal(messages('iframe-triple-click').length, 0)
})
