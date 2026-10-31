import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { beforeEach, test } from 'node:test';

import { createHooks } from './stubs/loader.mjs';

// 仅替换 store / IO 边界，实际执行布局属性同步、模式互斥、宽度换算与保存逻辑。
const stubURL = `data:text/javascript,${encodeURIComponent(`
export const state = {
  viewSettings: null, config: null, settings: null, view: null,
  attrs: new Map(), attributes: [], styles: [], savedBooks: [], savedSettings: [],
  viewport: { width: 1200, height: 900 }, global: true, saving: 0, maxSaving: 0,
};
export const envConfig = {};
export const useReaderStore = () => ({
  getViewSettings: () => state.viewSettings,
  getView: () => state.view,
  setViewSettings: (_key, settings) => {
    state.viewSettings = settings;
    // 模拟真实 store 的整体替换，测试是否误写了旧 config。
    state.config = { ...state.config, viewSettings: settings };
  },
});
export const useBookDataStore = () => ({
  getConfig: () => state.config,
  saveConfig: async (_key, config) => {
    state.saving++;
    state.maxSaving = Math.max(state.maxSaving, state.saving);
    await new Promise(resolve => setTimeout(resolve, 1));
    state.savedBooks.push(structuredClone(config));
    state.saving--;
  },
});
export const useSettingsStore = () => ({
  get settings() { return state.settings },
  get isFontLayoutSettingsGlobal() { return state.global },
  setSettings: settings => { state.settings = settings },
  saveSettings: async (_env, settings) => { state.savedSettings.push(structuredClone(settings)) },
});
export const getStyles = settings => JSON.stringify(settings);
`)}`;
const stubs = new Set([
  '@/hooks/useEnv',
  '@/store/bookDataStore',
  '@/store/readerStore',
  '@/store/settingsStore',
  '@/utils/style',
]);
const hooks = createHooks({ root: new URL('..', import.meta.url).pathname, stubsDir: '' });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubs.has(specifier)) return { url: stubURL, shortCircuit: true };
    return hooks.resolve(specifier, context, nextResolve);
  },
});

const { state } = await import(stubURL);
const { applyReaderWidth, applyRendererSettings, saveViewSettings } =
  await import('../src/utils/viewSettingsHelper.ts');

beforeEach(() => {
  state.viewSettings = {
    scrolled: false,
    continuousScroll: false,
    maxColumnCount: 1,
    contentWidth: 100,
    maxInlineSize: 720,
    maxBlockSize: 1440,
    marginPx: 44,
    gapPercent: 5,
    defaultFontSize: 16,
    fontWeight: 400,
  };
  state.config = { viewSettings: structuredClone(state.viewSettings), updatedAt: 1 };
  state.settings = { globalViewSettings: structuredClone(state.viewSettings) };
  state.global = true;
  state.viewport = { width: 1200, height: 900 };
  state.attrs = new Map();
  state.attributes = [];
  state.styles = [];
  state.savedBooks = [];
  state.savedSettings = [];
  state.saving = state.maxSaving = 0;
  state.view = {
    renderer: {
      getBoundingClientRect: () => state.viewport,
      getAttribute: (name: string) => state.attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        state.attrs.set(name, value);
        state.attributes.push([name, value]);
      },
      removeAttribute: (name: string) => {
        state.attrs.delete(name);
        state.attributes.push([name, null]);
      },
      setStyles: (styles: string) => state.styles.push(styles),
    },
  };
});

test('开启双列同时退出连续滚动，renderer、书籍配置、全局设置一起更新', async () => {
  Object.assign(state.viewSettings, { scrolled: true, continuousScroll: true });
  applyRendererSettings(state.view, state.viewSettings);
  await saveViewSettings('book-1', 'maxColumnCount', 2);
  assert.equal(state.viewSettings.scrolled, false);
  assert.equal(state.viewSettings.continuousScroll, false);
  assert.equal(state.attrs.get('flow'), 'paginated');
  assert.equal(state.attrs.get('column-count'), '2');
  assert.equal(state.attrs.get('max-column-count'), '2');
  assert.equal(state.attrs.get('max-inline-size'), '600px');
  assert.ok(state.attrs.has('no-continuous-scroll'));
  assert.deepEqual(state.savedBooks.at(-1).viewSettings, state.viewSettings);
  assert.deepEqual(state.savedSettings.at(-1).globalViewSettings, state.viewSettings);
});

test('旧配置即使已经 maxColumnCount=2，在滚动模式重新开启双列仍会切换模式', async () => {
  Object.assign(state.viewSettings, { maxColumnCount: 2, scrolled: true, continuousScroll: true });
  await saveViewSettings('book-1', 'maxColumnCount', 2);
  assert.equal(state.viewSettings.scrolled, false);
  assert.equal(state.attrs.get('column-count'), '2');
});

test('开启连续滚动自动关闭双列并允许跨章；关闭滚动后保持单页分页', async () => {
  await saveViewSettings('book-1', 'maxColumnCount', 2);
  state.attributes = [];
  await saveViewSettings('book-1', 'scrolled', true);
  assert.equal(state.viewSettings.maxColumnCount, 1);
  assert.equal(state.viewSettings.continuousScroll, true);
  assert.equal(state.attrs.get('flow'), 'scrolled');
  assert.equal(state.attrs.get('column-count'), '1');
  assert.equal(state.attrs.get('max-inline-size'), '1200px');
  assert.equal(state.attrs.has('no-continuous-scroll'), false);
  const removePreloadBlock = state.attributes.findIndex(
    ([name, value]: string[]) => name === 'no-continuous-scroll' && value === null
  );
  const changeFlow = state.attributes.findIndex(([name]: string[]) => name === 'flow');
  assert.ok(removePreloadBlock < changeFlow, '先允许预加载，再切换到滚动模式');
  await saveViewSettings('book-1', 'scrolled', false);
  assert.equal(state.attrs.get('flow'), 'paginated');
  assert.equal(state.attrs.get('column-count'), '1');
  assert.equal(state.viewSettings.continuousScroll, false);
});

test('宽度实时重排，窗口 / 目录尺寸变化后按比例重算，相同尺寸不重复重排', async () => {
  await saveViewSettings('book-1', 'contentWidth', 70);
  assert.equal(state.attrs.get('max-inline-size'), '840px');
  assert.equal(state.styles.length, 0, '宽度更新不需要重新注入字体样式');
  state.viewport.width = 800;
  applyReaderWidth(state.view, state.viewSettings);
  assert.equal(state.attrs.get('max-inline-size'), '560px');
  const count = state.attributes.length;
  applyReaderWidth(state.view, state.viewSettings);
  assert.equal(state.attributes.length, count);
  state.viewport.width = 0;
  applyReaderWidth(state.view, state.viewSettings);
  assert.equal(state.attrs.get('max-inline-size'), '560px', '隐藏容器不应破坏上一次布局');
});

test('字号 / 字重即时更新样式，并保存替换后的最新 config 而非旧快照', async () => {
  const staleConfig = state.config;
  await saveViewSettings('book-1', 'defaultFontSize', 24);
  await saveViewSettings('book-1', 'fontWeight', 600);
  assert.equal(staleConfig.viewSettings.defaultFontSize, 16);
  assert.equal(JSON.parse(state.styles.at(-1)).defaultFontSize, 24);
  assert.equal(JSON.parse(state.styles.at(-1)).fontWeight, 600);
  assert.equal(state.savedBooks.at(-1).viewSettings.defaultFontSize, 24);
  assert.equal(state.savedBooks.at(-1).viewSettings.fontWeight, 600);
});

test('快速连续拖动的保存串行执行，最后一次设置不会被旧写入覆盖', async () => {
  const saves = [60, 70, 80, 90].map((width) => saveViewSettings('book-1', 'contentWidth', width));
  assert.equal(state.viewSettings.contentWidth, 90, '渲染与 store 更新不等待 IO');
  await Promise.all(saves);
  assert.equal(state.maxSaving, 1);
  assert.equal(state.savedBooks.length, 1, '合并尚未执行的同书籍保存，避免拖动时堆积 IO');
  assert.equal(state.savedBooks.at(-1).viewSettings.contentWidth, 90);
  assert.equal(state.savedSettings.at(-1).globalViewSettings.contentWidth, 90);
});

test('仅本书设置不会覆盖全局偏好，重复值和未加载书籍不会触发保存', async () => {
  await saveViewSettings('book-1', 'contentWidth', 60, true);
  assert.equal(state.settings.globalViewSettings.contentWidth, 100);
  const saves = state.savedBooks.length;
  await saveViewSettings('book-1', 'contentWidth', 60, true);
  assert.equal(state.savedBooks.length, saves);
  state.viewSettings = null;
  await saveViewSettings('book-1', 'contentWidth', 80);
  assert.equal(state.savedBooks.length, saves);
});
