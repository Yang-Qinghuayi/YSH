import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Repository, type Database } from '../src/services/repository';
import type { Book, Mark } from '../src/domain/models';
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  const db: Database = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, ...params) {
      return sqlite.prepare(sql).run(...params);
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return (sqlite.prepare(sql).get(...params) as T) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
  };
  return { repo: new Repository(db), sqlite };
}
const book: Book = {
  id: 'a',
  hash: 'a',
  title: '一本书',
  author: '作者',
  format: 'epub',
  fileName: 'a.epub',
  coverName: null,
  locator: null,
  progression: 0,
  createdAt: 1,
  lastReadAt: 0,
};
const locator = {
  href: 'one.xhtml',
  type: 'application/xhtml+xml',
  locations: { totalProgression: 0.4, position: 5 },
};
test('schema is repeatable; unique book insertion, persisted locator and metadata', async () => {
  const { repo, sqlite } = setup();
  await repo.init();
  await repo.init();
  await repo.addBook(book);
  await assert.rejects(() => repo.addBook(book));
  assert.equal((await repo.books()).length, 1);
  await repo.progress('a', locator);
  await repo.metadata('a', '新标题', '新作者');
  const loaded = await repo.book('a');
  assert.deepEqual(loaded?.locator, locator);
  assert.equal(loaded?.progression, 0.4);
  assert.equal(loaded?.title, '新标题');
  assert.equal((await repo.byHash('a'))?.id, 'a');
  sqlite.close();
});
test('bookmarks/highlights CRUD and cascade deletion are real SQLite operations', async () => {
  const { repo, sqlite } = setup();
  await repo.init();
  await repo.addBook(book);
  const mark: Mark = {
    id: 'm',
    bookId: 'a',
    kind: 'highlight',
    locator,
    text: '原文',
    note: '笔记',
    color: '#abcdef',
    createdAt: 1,
  };
  await repo.saveMark(mark);
  await repo.saveMark({ ...mark, note: '修改笔记' });
  assert.equal((await repo.marks('a')).length, 1);
  assert.equal((await repo.marks('a'))[0]?.note, '修改笔记');
  await repo.deleteMark('m');
  assert.equal((await repo.marks('a')).length, 0);
  await repo.saveMark(mark);
  await repo.deleteBook('a');
  assert.equal((await repo.marks('a')).length, 0);
  await assert.rejects(() => repo.saveMark(mark));
  sqlite.close();
});
test('newer schema is not silently downgraded', async () => {
  const { repo, sqlite } = setup();
  sqlite.exec('PRAGMA user_version=99');
  await assert.rejects(() => repo.init(), /较新/);
  sqlite.close();
});
