import type { Locator } from 'react-native-readium';
import { progressionOf, type Book, type Mark } from '../domain/models';
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
}
type BookRow = Omit<Book, 'locator'> & { locator: string | null };
type MarkRow = Omit<Mark, 'locator'> & { locator: string };
function decodeLocator(s: string | null): Locator | null {
  try {
    const x = s ? JSON.parse(s) : null;
    return x && typeof x.href === 'string' && typeof x.type === 'string' ? x : null;
  } catch {
    return null;
  }
}
export class Repository {
  constructor(private db: Database) {}
  async init() {
    const version = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('本地数据库来自较新版本，请升级应用');
    try {
      await this.db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, format TEXT NOT NULL CHECK(format IN ('epub','pdf')),
        title TEXT NOT NULL, author TEXT NOT NULL, fileName TEXT NOT NULL UNIQUE, coverName TEXT,
        createdAt INTEGER NOT NULL, lastReadAt INTEGER NOT NULL, locator TEXT, progression REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY, bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('bookmark','highlight')), locator TEXT NOT NULL,
        text TEXT NOT NULL, note TEXT NOT NULL, color TEXT NOT NULL, createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS marks_book ON marks(bookId);
      PRAGMA user_version=1; COMMIT;`);
    } catch (error) {
      try {
        await this.db.execAsync('ROLLBACK');
      } catch {
        /* already rolled back or not begun */
      }
      throw error;
    }
  }
  async books(): Promise<Book[]> {
    return (
      await this.db.getAllAsync<BookRow>(
        'SELECT * FROM books ORDER BY lastReadAt DESC, createdAt DESC'
      )
    ).map((b) => ({ ...b, locator: decodeLocator(b.locator) }));
  }
  async book(id: string): Promise<Book | null> {
    const b = await this.db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id=?', id);
    return b ? { ...b, locator: decodeLocator(b.locator) } : null;
  }
  async byHash(hash: string) {
    return this.db.getFirstAsync<{ id: string }>('SELECT id FROM books WHERE hash=?', hash);
  }
  async addBook(b: Book) {
    await this.db.runAsync(
      'INSERT INTO books (id,hash,format,title,author,fileName,coverName,createdAt,lastReadAt,locator,progression) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      b.id,
      b.hash,
      b.format,
      b.title,
      b.author,
      b.fileName,
      b.coverName,
      b.createdAt,
      b.lastReadAt,
      null,
      0
    );
  }
  async metadata(id: string, title: string, author: string) {
    await this.db.runAsync('UPDATE books SET title=?, author=? WHERE id=?', title, author, id);
  }
  async progress(id: string, locator: Locator) {
    await this.db.runAsync(
      'UPDATE books SET locator=?, progression=?, lastReadAt=? WHERE id=?',
      JSON.stringify(locator),
      progressionOf(locator),
      Date.now(),
      id
    );
  }
  async touch(id: string) {
    await this.db.runAsync('UPDATE books SET lastReadAt=? WHERE id=?', Date.now(), id);
  }
  async deleteBook(id: string) {
    await this.db.runAsync('DELETE FROM books WHERE id=?', id);
  }
  async marks(id: string): Promise<Mark[]> {
    return (
      await this.db.getAllAsync<MarkRow>(
        'SELECT * FROM marks WHERE bookId=? ORDER BY createdAt DESC',
        id
      )
    ).flatMap((m) => {
      const locator = decodeLocator(m.locator);
      return locator ? [{ ...m, locator }] : [];
    });
  }
  async saveMark(m: Mark) {
    await this.db.runAsync(
      `INSERT INTO marks (id,bookId,kind,locator,text,note,color,createdAt) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET note=excluded.note,color=excluded.color`,
      m.id,
      m.bookId,
      m.kind,
      JSON.stringify(m.locator),
      m.text,
      m.note,
      m.color,
      m.createdAt
    );
  }
  async deleteMark(id: string) {
    await this.db.runAsync('DELETE FROM marks WHERE id=?', id);
  }
}
