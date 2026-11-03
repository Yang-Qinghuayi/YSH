import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PublicationSearch } from '../src/services/publicationSearch';
import type { SearchPage } from 'react-native-readium';
const page = (hasMore = false): SearchPage => ({
  results: [
    { locator: { href: 'chapter.xhtml', type: 'application/xhtml+xml' }, highlight: '文字' },
  ],
  hasMore,
  isSupported: true,
});
test('search trims query, serializes iterator calls and accumulates pages', async () => {
  let called = '',
    loads = 0;
  const search = new PublicationSearch(
    () => ({
      async search(q) {
        called = q;
        return page(true);
      },
      async loadMoreSearchResults() {
        loads++;
        return page(false);
      },
      cancelSearch() {},
    }),
    () => {}
  );
  await search.run(' 文字 ');
  assert.equal(called, '文字');
  assert.equal(search.state.hasMore, true);
  await Promise.all([search.run(), search.run()]);
  assert.equal(loads, 1);
  assert.equal(search.state.results.length, 2);
  assert.equal(search.state.busy, false);
});
test('clear invalidates in-flight results without advancing the native iterator concurrently', async () => {
  let resolve!: (p: SearchPage) => void;
  let cancels = 0,
    calls = 0;
  const pending = new Promise<SearchPage>((r) => {
    resolve = r;
  });
  const search = new PublicationSearch(
    () => ({
      search() {
        calls++;
        return pending;
      },
      async loadMoreSearchResults() {
        return page();
      },
      cancelSearch() {
        cancels++;
      },
    }),
    () => {}
  );
  const operation = search.run('old');
  search.clear();
  await search.run('new');
  assert.equal(calls, 1);
  resolve(page());
  await operation;
  assert.equal(search.state.results.length, 0);
  assert.equal(search.state.busy, false);
  assert.equal(cancels, 1);
});
test('native search errors are visible; disposing ignores callbacks', async () => {
  let notifications = 0;
  const search = new PublicationSearch(
    () => ({
      async search() {
        throw new Error('native failure');
      },
      async loadMoreSearchResults() {
        return page();
      },
      cancelSearch() {},
    }),
    () => {
      notifications++;
    }
  );
  await search.run('x');
  assert.match(search.state.error, /native failure/);
  assert.equal(search.state.busy, false);
  search.dispose();
  const before = notifications;
  await search.run('y');
  assert.equal(notifications, before);
});
