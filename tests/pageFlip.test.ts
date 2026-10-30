/**
 * 阅读器点击行为回归测试。
 *
 * 需求（见需求说明）：
 *  1. 连续滚动（上下滑动翻页）模式下，点击正文左右两侧不再翻页；
 *  2. 分页模式下，点击左右两侧仍然上一页 / 下一页，并支持 swapClickArea；
 *  3. 正文中间点击不再弹菜单，菜单改由「书籍」路由项再次点击时弹出；
 *  4. 三击正文静默复制该段，与单击翻页互不干扰。
 *
 * 运行：pnpm test（node --test）。这里用 registerHooks 把涉及 Pinia /
 * Tauri / vue-router 的模块替换成内存替身，其余源码保持真实。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ysh-pageflip-'));
const stubFile = path.join(tmp, 'stubs.mjs');
fs.writeFileSync(
  stubFile,
  `
export const state = {
  bookId: 'book-1',
  routePath: '/library',
  settings: { scrolled: false, disableClick: false, swapClickArea: false },
  copied: [],
  hoveredBookKey: null,
  calls: { left: 0, right: 0, next: 0, prev: 0, menu: 0 },
}
export const useBookIdStore = () => ({ bookId: state.bookId })
export const useReaderStore = () => ({
  getViewSettings: () => state.settings,
  get hoveredBookKey() { return state.hoveredBookKey },
  setHoveredBookKey: (value) => { state.hoveredBookKey = value },
  switchShowMenu: () => { state.calls.menu++ },
})
export const isTauriAppPlatform = () => false
export const tauriGetWindowLogicalPosition = async () => ({ x: 0, y: 0 })
export const useRoute = () => ({ get path() { return state.routePath } })
export const useI18n = () => ({ t: (key) => key })
export const mdiCog = 'mdiCog'
export const mdiBookshelf = 'mdiBookshelf'
export const mdiBookOpenVariantOutline = 'mdiBookOpenVariantOutline'
export const mdiFeather = 'mdiFeather'
`
);

const stubURL = pathToFileURL(stubFile).href;
const stubbed = new Set([
  '@/store/bookIdStore',
  '@/store/readerStore',
  '@/store/setting',
  '@/services/environment',
  '@/utils/window',
  '@/utils/i18n',
  'vue-router',
  '@mdi/js',
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubbed.has(specifier)) return { url: stubURL, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const base = path.join(root, 'src', specifier.slice(2));
      for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

// useNavItems / usePageFlip 在 Vite 下由 unplugin-auto-import 注入 computed、window 等全局
const vueComputed = (getter) => ({
  get value() {
    return getter();
  },
});
globalThis.computed = vueComputed;
globalThis.window = { screenX: 0, innerWidth: 800 };

const { state } = await import(stubURL);
const { usePageFlip } = await import('../src/hooks/usePageFlip.ts');
const { useNavItems } = await import('../src/hooks/useNavItems.ts');

const resetState = () => {
  state.routePath = '/library';
  state.settings = { scrolled: false, disableClick: false, swapClickArea: false };
  state.copied = [];
  state.hoveredBookKey = null;
  state.calls = { left: 0, right: 0, next: 0, prev: 0, menu: 0 };
};

/** 构造一个 800px 宽的阅读区域，中线在 x=400 */
function setupPageFlip(withCopyCallback = true) {
  resetState();
  const view = {
    goLeft: () => {
      state.calls.left++;
    },
    goRight: () => {
      state.calls.right++;
    },
    next: () => {
      state.calls.next++;
    },
    prev: () => {
      state.calls.prev++;
    },
    history: { back() {}, forward() {} },
  };
  const container = { getBoundingClientRect: () => ({ left: 0, width: 800 }) };
  const { handlePageFlip } = usePageFlip(
    { value: view },
    { value: container },
    { value: null },
    withCopyCallback
      ? (text) => {
          state.copied.push(text);
        }
      : undefined
  );

  const click = (screenX: number) =>
    handlePageFlip(
      new MessageEvent('message', {
        data: { type: 'iframe-single-click', bookKey: state.bookId, screenX },
      })
    );
  const tripleClick = (text: string) =>
    handlePageFlip(
      new MessageEvent('message', {
        data: { type: 'iframe-triple-click', bookKey: state.bookId, text },
      })
    );
  const wheel = (deltaY: number) =>
    handlePageFlip(
      new MessageEvent('message', {
        data: { type: 'iframe-wheel', bookKey: state.bookId, deltaY },
      })
    );
  // foliate-view 外层容器上的原生 click（非 MessageEvent）
  const nativeClick = (clientX: number) => handlePageFlip({ clientX });

  return { click, tripleClick, wheel, nativeClick };
}

test('分页模式：点击左侧上一页、右侧下一页', async () => {
  const { click } = setupPageFlip();
  await click(100);
  await click(700);
  assert.deepEqual(
    [state.calls.left, state.calls.right],
    [1, 1],
    '左右两侧应分别触发 goLeft / goRight'
  );
});

test('分页模式：正文中间点击不再弹菜单，而是按中线翻页', async () => {
  const { click } = setupPageFlip();
  await click(390);
  await click(410);
  assert.equal(state.calls.menu, 0, '正文任何位置点击都不应再弹出菜单');
  assert.deepEqual([state.calls.left, state.calls.right], [1, 1]);
});

test('连续滚动模式：正文点击左右两侧完全无反应', async () => {
  const { click, nativeClick } = setupPageFlip();
  state.settings.scrolled = true;
  await click(100);
  await click(700);
  await click(400);
  nativeClick(100);
  nativeClick(700);
  assert.equal(state.calls.left, 0);
  assert.equal(state.calls.right, 0);
  assert.equal(state.calls.menu, 0, '上下滑动模式下点击也不应弹菜单');
});

test('连续滚动模式：滚轮翻页同样交给原生滚动处理', async () => {
  const { wheel } = setupPageFlip();
  state.settings.scrolled = true;
  await wheel(120);
  await wheel(-120);
  assert.deepEqual([state.calls.next, state.calls.prev], [0, 0]);
  state.settings.scrolled = false;
  await wheel(120);
  await wheel(-120);
  assert.deepEqual([state.calls.next, state.calls.prev], [1, 1], '分页模式仍支持滚轮翻页');
});

test('swapClickArea / disableClick 依旧生效', async () => {
  const { click } = setupPageFlip();
  state.settings.swapClickArea = true;
  await click(100);
  assert.deepEqual([state.calls.left, state.calls.right], [0, 1], '左侧点击应翻下一页');
  await click(700);
  assert.deepEqual([state.calls.left, state.calls.right], [1, 1], '右侧点击应翻上一页');

  resetState();
  state.settings.disableClick = true;
  await click(100);
  await click(700);
  assert.deepEqual([state.calls.left, state.calls.right], [0, 0]);
  assert.equal(state.calls.menu, 0);
});

test('三击：静默复制浏览器选中的段落，且不翻页', async () => {
  const { tripleClick } = setupPageFlip();
  await tripleClick('三击选中的整段文字');
  assert.deepEqual(state.copied, ['三击选中的整段文字']);
  assert.deepEqual([state.calls.left, state.calls.right], [0, 0], '三击不应触发翻页');
  assert.equal(state.calls.menu, 0, '三击不应弹菜单');
});

test('三击复制与翻页是独立功能：scrolled / disableClick 下依然生效', async () => {
  const { tripleClick } = setupPageFlip();
  state.settings.scrolled = true;
  await tripleClick('滚动模式下的一段');
  state.settings.scrolled = false;
  state.settings.disableClick = true;
  await tripleClick('禁用点击翻页下的一段');
  assert.deepEqual(state.copied, ['滚动模式下的一段', '禁用点击翻页下的一段']);
  assert.deepEqual([state.calls.left, state.calls.right], [0, 0]);
});

test('未接复制回调时三击无副作用', async () => {
  const { tripleClick } = setupPageFlip(false);
  await tripleClick('任意文本');
  assert.deepEqual(state.copied, []);
  assert.deepEqual([state.calls.left, state.calls.right], [0, 0]);
});

test('导航项：首次点击「书籍」只跳转，已在书籍页再次点击才弹/收菜单', () => {
  resetState();
  const { nav, onNavItemClick } = useNavItems();
  const bookItem = nav.value.find((item) => item.val === 'book')!;

  state.routePath = '/library';
  onNavItemClick(bookItem);
  assert.equal(state.calls.menu, 0, '不在书籍页时不应弹菜单');

  state.routePath = '/book';
  onNavItemClick(bookItem);
  onNavItemClick(bookItem);
  assert.equal(state.calls.menu, 2, '在书籍页每次点击都应切换菜单（开→关）');

  onNavItemClick({ ...bookItem, val: 'library', to: '/library' });
  assert.equal(state.calls.menu, 2, '其他导航项不应触发菜单');
});
