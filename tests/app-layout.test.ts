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

test('the reader hides every TOC control when the current book has no entries', () => {
  const reader = read('src/pages/book/book.vue');
  assert.match(
    reader,
    /const hasToc = computed\(\(\) => Boolean\(bookDoc\.value\?\.toc\?\.length\)\)/
  );
  assert.match(reader, /v-if="hasToc && lgAndUp"/);
  assert.match(reader, /v-if="hasToc && isMobile"/);
  assert.match(reader, /v-if="bookDoc && hasToc && showBigCatalog && lgAndUp"/);
  assert.match(reader, /v-if="hasToc && isMobile" v-model="showMobileTOC"/);
});

test('the writing page uses available layout height and the desktop TOC has an outer margin', () => {
  const novel = read('src/pages/novel/novel-page.css');
  const reader = read('src/pages/book/book.vue');
  assert.match(novel, /\.novel-root\s*\{\s*flex:\s*1 1 0;\s*min-height:\s*0/);
  assert.match(reader, /<TOCView[\s\S]*?class="mr-4\s/);
});
