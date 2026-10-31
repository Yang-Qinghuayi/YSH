import assert from 'node:assert/strict';
import test from 'node:test';

import type { ViewSettings } from '../src/types/book.ts';
import { getColumnCount, getMaxInlineSize } from '../src/utils/config.ts';
import { deserializeConfig, serializeConfig } from '../src/utils/serializer.ts';

const settings = (overrides: Partial<ViewSettings> = {}) =>
  ({
    scrolled: false,
    vertical: false,
    maxColumnCount: 1,
    maxInlineSize: 720,
    contentWidth: 100,
    ...overrides,
  }) as ViewSettings;

const viewport = { width: 1200, height: 900 };

test('正文宽度按阅读器可用空间计算，单列不再被 700px 上限覆盖', () => {
  assert.equal(getMaxInlineSize(settings(), viewport), 1200);
  assert.equal(getMaxInlineSize(settings({ contentWidth: 70 }), viewport), 840);
  assert.equal(getMaxInlineSize(settings({ contentWidth: 70 }), { width: 800, height: 900 }), 560);
});

test('单双列与连续滚动共享总宽度，双列不会把正文区域扩大两倍', () => {
  const single = getMaxInlineSize(settings({ contentWidth: 80 }), viewport);
  const dual = getMaxInlineSize(settings({ contentWidth: 80, maxColumnCount: 2 }), viewport);
  assert.equal(single, dual * 2);
  assert.equal(
    getMaxInlineSize(settings({ contentWidth: 80, maxColumnCount: 2, scrolled: true }), viewport),
    single
  );
  assert.equal(getColumnCount(settings({ scrolled: true, maxColumnCount: 2 })), 1);
});

test('正文宽度随手机旋转和竖排尺寸变化，并为旧配置 / 隐藏容器提供安全默认值', () => {
  const narrow = { width: 390, height: 844 };
  assert.equal(getMaxInlineSize(settings({ contentWidth: 80 }), narrow), 312);
  assert.equal(getMaxInlineSize(settings({ contentWidth: 80, vertical: true }), narrow), 675);
  assert.equal(getMaxInlineSize(settings({ contentWidth: undefined }), viewport), 1200);
  assert.equal(getMaxInlineSize(settings({ contentWidth: NaN }), viewport), 1200);
  assert.equal(getMaxInlineSize(settings({ contentWidth: 20 }), viewport), 600);
  assert.equal(getMaxInlineSize(settings({ contentWidth: 150 }), viewport), 1200);
  assert.equal(getMaxInlineSize(settings(), { width: 0, height: 0 }), 720);
  assert.equal(getMaxInlineSize(settings()), 720);
});

test('新宽度设置兼容旧书籍配置，并通过现有序列化机制保存与恢复', () => {
  const globalSettings = settings();
  const searchConfig = {
    scope: 'book' as const,
    matchCase: false,
    matchWholeWords: false,
    matchDiacritics: false,
  };
  const legacy = deserializeConfig(
    '{"viewSettings":{"defaultFontSize":20}}',
    globalSettings,
    searchConfig
  );
  assert.equal(legacy.viewSettings?.contentWidth, 100);
  const local = { ...legacy, viewSettings: { ...legacy.viewSettings, contentWidth: 65 } };
  const serialized = serializeConfig(local, globalSettings, searchConfig);
  assert.equal(JSON.parse(serialized).viewSettings.contentWidth, 65);
  assert.equal(
    deserializeConfig(serialized, globalSettings, searchConfig).viewSettings?.contentWidth,
    65
  );
});

// 只加载 paginator 中的纯布局函数，不构造浏览器自定义元素。
const originalNodeFilter = globalThis.NodeFilter;
const originalHTMLElement = globalThis.HTMLElement;
const originalCustomElements = globalThis.customElements;
Object.assign(globalThis, {
  NodeFilter: {
    SHOW_ELEMENT: 1,
    SHOW_TEXT: 4,
    SHOW_CDATA_SECTION: 8,
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
  },
  HTMLElement: class {},
  customElements: { define() {} },
});
const { getColumnCount: getPaginatorColumnCount, Paginator } =
  await import('../src/foliate-js/paginator.js');
Object.assign(globalThis, {
  NodeFilter: originalNodeFilter,
  HTMLElement: originalHTMLElement,
  customElements: originalCustomElements,
});

const layout = (overrides = {}) => ({
  flow: 'paginated',
  columnCount: 0,
  maxColumnCount: 2,
  maxInlineSize: 720,
  size: 390,
  vertical: false,
  ...overrides,
});

test('显式双列在窄屏 / 竖屏同样生效，不再被 max-inline-size 阈值吞掉', () => {
  assert.ok(Paginator.observedAttributes.includes('column-count'));
  assert.equal(getPaginatorColumnCount(layout({ columnCount: 2 })), 2);
  assert.equal(getPaginatorColumnCount(layout({ columnCount: 2, size: 1200 })), 2);
  assert.equal(getPaginatorColumnCount(layout({ columnCount: 1, size: 1200 })), 1);
  assert.equal(getPaginatorColumnCount(layout({ columnCount: 1, vertical: true })), 1);
});

test('未指定列数时保留上游自适应行为，滚动模式始终只有一列', () => {
  assert.equal(getPaginatorColumnCount(layout()), 1);
  assert.equal(getPaginatorColumnCount(layout({ size: 1200 })), 2);
  assert.equal(
    getPaginatorColumnCount(layout({ flow: 'scrolled', columnCount: 2, size: 1200 })),
    1
  );
  assert.equal(getPaginatorColumnCount(layout({ columnCount: 5 })), 2);
  assert.equal(getPaginatorColumnCount(layout({ columnCount: NaN })), 1);
  assert.equal(getPaginatorColumnCount(layout({ size: 0 })), 1);
});
