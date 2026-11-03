import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8 } from 'fflate';
import { ImportPipeline } from '../src/services/importPipeline';
import type { Book } from '../src/domain/models';
function setup() {
  const files = new Map<string, Uint8Array>(),
    books = new Map<string, Book>();
  const repo = {
    async byHash(hash: string) {
      return books.has(hash) ? { id: hash } : null;
    },
    async book(id: string) {
      return books.get(id) ?? null;
    },
    async addBook(b: Book) {
      books.set(b.id, b);
    },
  };
  const pipeline = new ImportPipeline({
    async read() {
      return strToU8('%PDF-1.7\nself-contained document');
    },
    has(name) {
      return files.has(name);
    },
    put(name, bytes) {
      files.set(name, bytes);
    },
    remove(name) {
      files.delete(name);
    },
  });
  return { pipeline, files, books, repo };
}
test('concurrent imports serialized; same content deduplicates without resetting progress', async () => {
  const { pipeline, files, books, repo } = setup();
  const source = { uri: 'content://temporary', name: 'test.pdf' };
  const results = await Promise.all([pipeline.import(repo, source), pipeline.import(repo, source)]);
  assert.deepEqual(
    results.map((r) => r.duplicate),
    [false, true]
  );
  assert.equal(files.size, 1);
  assert.equal(books.size, 1);
  const book = [...books.values()][0]!;
  book.progression = 0.7;
  await pipeline.import(repo, source);
  assert.equal(book.progression, 0.7);
  files.clear();
  await pipeline.import(repo, source);
  assert.equal(files.size, 1);
  assert.equal(book.progression, 0.7);
});
test('index failure rolls back files and does not poison subsequent imports', async () => {
  const { pipeline, files, repo } = setup();
  await assert.rejects(
    () =>
      pipeline.import(
        {
          ...repo,
          async addBook() {
            throw new Error('disk full');
          },
        },
        { uri: 'x', name: 'x.pdf' }
      ),
    /disk full/
  );
  assert.equal(files.size, 0);
  await pipeline.import(repo, { uri: 'x', name: 'x.pdf' });
  assert.equal(files.size, 1);
});
test('cancellation before or during reading never commits files or rows', async () => {
  const { pipeline, files, books, repo } = setup();
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    () => pipeline.import(repo, { uri: 'x', name: 'x.pdf' }, abort.signal),
    /取消/
  );
  assert.equal(files.size, 0);
  assert.equal(books.size, 0);
  const second = new AbortController();
  const interrupted = new ImportPipeline({
    async read() {
      second.abort();
      return strToU8('%PDF-1.7');
    },
    has() {
      return false;
    },
    put() {
      assert.fail('must not write');
    },
    remove() {},
  });
  await assert.rejects(
    () => interrupted.import(repo, { uri: 'x', name: 'x.pdf' }, second.signal),
    /取消/
  );
});
