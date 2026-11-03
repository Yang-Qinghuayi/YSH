import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { inspectPublication } from '../domain/publication';
import type { Book } from '../domain/models';
import type { Repository } from './repository';
export interface ImportSource {
  uri: string;
  name: string;
}
export interface ImportStorage {
  read(source: ImportSource): Promise<Uint8Array>;
  has(name: string): boolean;
  put(name: string, bytes: Uint8Array): void;
  remove(name: string): void;
}
type ImportRepository = Pick<Repository, 'byHash' | 'book' | 'addBook'>;
/** Storage-independent import transaction. Files precede the index; failures roll back owned artifacts. */
export class ImportPipeline {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: ImportStorage) {}
  import(repo: ImportRepository, source: ImportSource, signal?: AbortSignal) {
    const operation = this.queue.then(async () => {
      const check = () => {
        if (signal?.aborted) throw new Error('已取消导入');
      };
      check();
      const bytes = await this.storage.read(source);
      check();
      const info = inspectPublication(bytes, source.name);
      check();
      const hash = bytesToHex(sha256(bytes));
      const existing = await repo.byHash(hash);
      check();
      if (existing) {
        const previous = await repo.book(existing.id);
        if (previous) {
          if (!this.storage.has(previous.fileName)) this.storage.put(previous.fileName, bytes);
          if (previous.coverName && info.cover && !this.storage.has(previous.coverName))
            this.storage.put(previous.coverName, info.cover);
        }
        return { duplicate: true, id: existing.id };
      }
      const fileName = `${hash}.${info.format}`;
      const coverName = info.cover ? `${hash}.${info.coverExtension}` : null;
      try {
        this.storage.put(fileName, bytes);
        if (coverName && info.cover) this.storage.put(coverName, info.cover);
        check();
        const book: Book = {
          id: hash,
          hash,
          format: info.format,
          title: info.title,
          author: info.author,
          fileName,
          coverName,
          createdAt: Date.now(),
          lastReadAt: 0,
          locator: null,
          progression: 0,
        };
        await repo.addBook(book);
        return { duplicate: false, id: hash };
      } catch (error) {
        // Best-effort rollback. Startup reconciliation retries cleanup after OS/storage errors.
        for (const name of [fileName, coverName])
          if (name) {
            try {
              this.storage.remove(name);
            } catch {
              /* preserve original failure */
            }
          }
        throw error;
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
