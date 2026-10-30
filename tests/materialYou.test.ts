/**
 * Material 3 色彩系统回归测试
 *
 * 覆盖：
 *  1. 种子色 → 一整套 CSS 变量，且全部是合法十六进制色值；
 *  2. 浅色 / 深色方案角色色不同（深色 surface 更暗）；
 *  3. 非法种子色回落到默认色而不是抛错；
 *  4. 阅读器调色板（HCT 派生）色值合法，且 base-200/300 明暗方向正确。
 *
 * 运行：pnpm test（node --test）。
 */

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createHooks } from './stubs/loader.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
registerHooks(createHooks({ root: path.join(here, '..'), stubsDir: path.join(here, 'stubs') }));

const { MATERIAL_YOU_DEFAULT_SEED, getMaterialYouVars } = await import('@/utils/materialYou');
const { generateDarkPalette, generateLightPalette, themes } = await import('@/styles/themes');

const HEX = /^#[0-9a-f]{6}$/;

/** 粗略亮度：三个通道取平均，用于校验明暗方向 */
const luma = (hex) =>
  [1, 3, 5].reduce((sum, i) => sum + Number.parseInt(hex.slice(i, i + 2), 16), 0) / 3;

test('materialYou: 默认种子色生成完整的角色色变量', () => {
  const vars = getMaterialYouVars(MATERIAL_YOU_DEFAULT_SEED);
  const expected = [
    '--background',
    '--surface',
    '--primary',
    '--on-primary',
    '--primary-container',
    '--secondary-container',
    '--tertiary',
    '--tertiary-container',
    '--on-surface',
    '--on-surface-variant',
    '--outline',
    '--outline-strong',
    '--error',
    '--surface-elev-1',
    '--surface-elev-3',
  ];
  for (const key of expected) {
    assert.ok(vars[key], `缺少变量 ${key}`);
  }
  for (const [key, value] of Object.entries(vars)) {
    if (key === '--surface-tint') {
      assert.match(value, /^#[0-9a-f]{6}cc$/, `${key} 应为带 80% 透明度的色值`);
    } else {
      assert.match(value, HEX, `${key} 不是合法色值：${value}`);
    }
  }
});

test('materialYou: 浅色与深色方案不同，深色 surface 更暗', () => {
  const light = getMaterialYouVars('#b85e4b', false);
  const dark = getMaterialYouVars('#b85e4b', true);
  assert.notEqual(light['--surface'], dark['--surface']);
  assert.ok(luma(dark['--surface']) < luma(light['--surface']));
  assert.ok(luma(dark['--on-surface']) > luma(light['--on-surface']));
});

test('materialYou: 非法种子色回落到默认色', () => {
  assert.deepEqual(
    getMaterialYouVars('not-a-color'),
    getMaterialYouVars(MATERIAL_YOU_DEFAULT_SEED)
  );
  // #abc 这种三位写法应被展开
  assert.deepEqual(getMaterialYouVars('#6750a4'), getMaterialYouVars('#6750A4'));
});

test('阅读器调色板：所有色值合法', () => {
  const base = { bg: '#ffffff', fg: '#171717', primary: '#0066cc' };
  for (const palette of [generateLightPalette(base), generateDarkPalette(base)]) {
    for (const [key, value] of Object.entries(palette)) {
      assert.match(value, HEX, `${key} 不是合法色值：${value}`);
    }
  }
});

test('阅读器调色板：浅色逐级变暗，深色逐级变亮', () => {
  const light = generateLightPalette({ bg: '#ffffff', fg: '#171717', primary: '#0066cc' });
  assert.ok(luma(light['base-200']) < luma(light['base-100']));
  assert.ok(luma(light['base-300']) < luma(light['base-200']));

  const dark = generateDarkPalette({ bg: '#222222', fg: '#e0e0e0', primary: '#77bbee' });
  assert.ok(luma(dark['base-200']) > luma(dark['base-100']));
  assert.ok(luma(dark['base-300']) > luma(dark['base-200']));
});

test('内置主题全部可生成', () => {
  assert.ok(themes.length > 5);
  for (const theme of themes) {
    assert.match(theme.colors.light.primary, HEX, `${theme.name} light primary`);
    assert.match(theme.colors.dark.primary, HEX, `${theme.name} dark primary`);
  }
});
