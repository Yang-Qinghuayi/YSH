#!/usr/bin/env node
/**
 * gen-vuetify-utilities.mjs
 *
 * 生成 `src/styles/vuetify-utilities.css`：从 Vuetify 官方的 utilities.css 中
 * 只挑出本项目模板里实际用到的工具类（d-flex / pa-3 / text-body-medium …）。
 *
 * 为什么要生成：完整 utilities.css 有 240 KB（gzip ~28 KB），而项目只用到 70 余个类。
 * 生成的规则与官方文件逐条一致，并保留 @layer / @media 包装，层叠顺序不变。
 *
 * 用法：node scripts/gen-vuetify-utilities.mjs
 * 注意：新增模板类名后需要重跑，否则样式不会生效（构建不会报错）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE = path.join(root, 'node_modules/vuetify/lib/styles/utilities.css');
const OUTPUT = path.join(root, 'src/styles/vuetify-utilities.css');
const SCAN_DIRS = ['src'];
const SKIP_DIRS = ['src/foliate-js'];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.some((skip) => path.relative(root, full).startsWith(skip))) continue;
      walk(full, acc);
    } else if (/\.(vue|ts|tsx|js|scss|css|html)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectUsedClasses() {
  const used = new Set();
  const files = [
    ...SCAN_DIRS.map((d) => path.join(root, d)).flatMap((d) => walk(d)),
    path.join(root, 'index.html'),
  ];
  const patterns = [/\bclass="([^"]*)"/g, /:class="([^"]*)"/g, /class:\s*'([^']*)'/g];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        // 绑定表达式里的字符串字面量也要算进去
        const literals = match[1].match(/'([^']*)'/g) ?? [match[1]];
        for (const literal of literals) {
          for (const token of literal.replace(/'/g, '').split(/\s+/)) {
            if (/^-?[a-z0-9-]+$/.test(token)) used.add(token);
          }
        }
      }
    }
  }
  return used;
}

function generate() {
  const used = collectUsedClasses();
  const css = fs.readFileSync(SOURCE, 'utf8');

  const output = [];
  const stack = [];
  let buffer = '';
  let kept = 0;
  let total = 0;

  for (const ch of css) {
    if (ch === '{') {
      stack.push(buffer.trim());
      buffer = '';
      continue;
    }
    if (ch === '}') {
      const body = buffer.trim();
      buffer = '';
      const prelude = stack.pop() ?? '';
      if (!prelude || prelude.startsWith('@')) continue;
      total += 1;
      const classesOf = (selector) =>
        new Set(selector.match(/\.(-?[_a-zA-Z][\w-]*)/g)?.map((s) => s.slice(1)) ?? []);
      const selectors = prelude
        .split(',')
        .map((s) => s.trim())
        .filter((s) => {
          const classes = classesOf(s);
          return classes.size > 0 && [...classes].every((c) => used.has(c));
        });
      if (selectors.length === 0) continue;
      kept += 1;
      let rule = `${selectors.join(', ')} { ${body} }`;
      for (const wrapper of stack.filter((p) => p.startsWith('@')).reverse()) {
        rule = `${wrapper} { ${rule} }`;
      }
      output.push(rule);
      continue;
    }
    buffer += ch;
  }

  const header = `/* ============================================================
 * Vuetify 工具类子集（自动生成，勿手改）
 *
 * Vuetify 完整 utilities.css 为 240 KB，本项目实际只用到其中一部分。
 * 这里只保留模板中出现的类，声明与官方文件逐条一致，并保留 @layer/@media
 * 包装，层叠顺序与官方一致。
 *
 * 重新生成：node scripts/gen-vuetify-utilities.mjs
 * ============================================================ */
`;
  fs.writeFileSync(OUTPUT, header + output.join('\n') + '\n', 'utf8');
  console.log(
    `[gen-vuetify-utilities] 保留 ${kept}/${total} 条规则 → ${path.relative(root, OUTPUT)}`
  );
}

generate();
