/**
 * 主题色令牌一致性守卫
 *
 * 色值链路是：
 *   utils/materialYou.ts（M3 角色色，唯一来源）
 *     → Vuetify 响应式 theme → --v-theme-*（三元组）
 *     → styles/tailwind.css 的 @theme 包成 --color-*（完整颜色）
 *     → Tailwind 颜色工具类（text-primary / bg-surface / text-on-surface/60 …）
 *       与组件里手写的 var(--color-*)
 *
 * 问题在于第 3 步是一份手写清单，而漏写不会报错、只会让对应的 Tailwind 类
 * 静默失效（和之前的 w-64 同类）。这里用测试把两边钉死，顺带守住几个
 * 「构建照样过、只有运行/肉眼能发现」的坑：
 *   · key 必须是 kebab-case（Vuetify 直接拿 key 拼 --v-theme-*）；
 *   · @theme 的值必须是 rgb(var(--v-theme-同名))，写成 var(...) 会让 /60
 *     这类透明度修饰符被静默丢弃；
 *   · @theme 与 @theme inline 不能同时出现在一个文件里（4.3.3 会把后面的
 *     @theme 块也按 inline 校验，rgb(var(--v-theme-x)) 直接编译失败）。
 *
 * 运行：pnpm test（node --test）。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createHooks } from './stubs/loader.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
registerHooks(createHooks({ root, stubsDir: path.join(here, 'stubs') }));

const { getMaterialYouThemeColors } = await import('@/utils/materialYou');

const ADAPTER = 'src/styles/tailwind.css';
const tailwindCss = fs.readFileSync(path.join(root, ADAPTER), 'utf8');

/** 取 @theme 块内容（文件里只允许有这一个 @theme / @theme inline 块） */
function themeBlock() {
  const blocks = [...tailwindCss.matchAll(/@theme(?: static| inline)?\s*\{/g)];
  assert.equal(blocks.length, 1, `${ADAPTER} 里应恰好有一个 @theme 块`);
  assert.match(blocks[0][0], /@theme static/, '必须是 @theme static，否则未被引用的令牌会被摇掉');
  const start = blocks[0].index;
  let i = tailwindCss.indexOf('{', start);
  let depth = 1;
  while (depth > 0) {
    i += 1;
    if (tailwindCss[i] === '{') depth += 1;
    else if (tailwindCss[i] === '}') depth -= 1;
  }
  return tailwindCss.slice(start, i);
}

/** @theme 里的颜色令牌：--color-x → 值 */
function colorTokens() {
  return new Map(
    [...themeBlock().matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  );
}

function srcFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // foliate-js 是 vendored 上游代码，不参与本项目主题
        if (entry.name !== 'foliate-js') walk(full);
        continue;
      }
      if (!/\.(vue|css|scss|ts|js)$/.test(entry.name)) continue;
      out.push([path.relative(root, full), full]);
    }
  };
  walk(path.join(root, 'src'));
  return out;
}

test('materialYou 的 color key 是 kebab-case（Vuetify 直接拿 key 拼 --v-theme-*）', () => {
  const camel = Object.keys(getMaterialYouThemeColors('#b85e4b')).filter((k) => /[A-Z]/.test(k));
  assert.deepEqual(
    camel,
    [],
    `这些 key 含大写字母，Vuetify 会生成 --v-theme-${camel[0] ?? ''}，与组件/CSS 里的 kebab 名字对不上`
  );
});

test('@theme 覆盖 materialYou 产出的每一个颜色 key', () => {
  const keys = Object.keys(getMaterialYouThemeColors('#b85e4b'));
  const tokens = colorTokens();

  const missing = keys.filter((k) => !tokens.has(k));
  assert.deepEqual(
    missing,
    [],
    `这些颜色没有对应的 --color-* 令牌，text-${missing[0] ?? ''} 之类会静默失效`
  );

  const extra = [...tokens.keys()].filter((k) => !keys.includes(k));
  assert.deepEqual(extra, [], `这些 --color-* 令牌在 materialYou 里已不存在：${extra.join(', ')}`);
});

test('@theme 的值必须是 rgb(var(--v-theme-同名))', () => {
  // 两个真实的坑：
  //   1. 批量替换脚本曾经把右侧也一起改了，变成自引用
  //      `--color-x: var(--color-x)` —— 循环引用在计算值阶段即失效，全站颜色
  //      会静默变成继承色，构建产物照常生成；
  //   2. 写成 var(--m3-x) 之类虽然合法，但 Tailwind 认不出它是颜色，
  //      text-x/60 这类透明度修饰符会被静默丢弃（不报任何错）。
  for (const [name, value] of colorTokens()) {
    assert.equal(
      value,
      `rgb(var(--v-theme-${name}))`,
      `--color-${name} 的值应为 rgb(var(--v-theme-${name}))，实际是 ${value}`
    );
  }
});

test('应用代码不再引用 --m3-*（颜色令牌统一为 --color-*）', () => {
  const offenders = srcFiles()
    .filter(([, full]) => fs.readFileSync(full, 'utf8').includes('--m3-'))
    .map(([rel]) => rel);
  assert.deepEqual(offenders, [], '这些文件还在引用已废弃的 --m3-*，应改用 var(--color-*)');
});

test('除适配层外，应用代码不再直接引用 --v-theme-*', () => {
  const offenders = srcFiles()
    .filter(
      ([rel, full]) => rel !== ADAPTER && fs.readFileSync(full, 'utf8').includes('var(--v-theme-')
    )
    .map(([rel]) => rel);
  assert.deepEqual(
    offenders,
    [],
    '这些文件还在直接引用 --v-theme-*，应改用 var(--color-*) 或 Tailwind 颜色类'
  );
});
