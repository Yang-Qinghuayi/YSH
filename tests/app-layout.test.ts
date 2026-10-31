import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the application shell fills the viewport on every route', () => {
  const home = read('src/pages/Home.vue');
  const layout = read('src/pages/layout/View.vue');
  assert.match(home, /\.v-application__wrap\s*\{\s*min-height:\s*100dvh/);
  assert.match(layout, /\.v-main\s*\{\s*height:\s*100dvh/);
  assert.doesNotMatch(layout, /calc\(100vh\s*-\s*16px\)/);
  assert.match(layout, /viewport-container.*isBook \|\| isNovel/);
});

test('the writing page uses available layout height and the desktop TOC has an outer margin', () => {
  const novel = read('src/pages/novel/novel-page.css');
  const reader = read('src/pages/book/book.vue');
  assert.match(novel, /\.novel-root\s*\{\s*flex:\s*1 1 0;\s*min-height:\s*0/);
  assert.match(reader, /<TOCView[\s\S]*?class="mr-4\s/);
});
