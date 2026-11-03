import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { LIMITS } from '../domain/publication';
import type { Book } from '../domain/models';
import type { Repository } from './repository';
import { ImportPipeline, type ImportSource } from './importPipeline';

const root = () => new Directory(Paths.document, 'library');
export const managedFile = (name: string) => {
  if (!/^[\da-f]{64}\.(epub|pdf|jpg|png|webp)$/.test(name)) throw new Error('无效的本地书籍路径');
  return new File(root(), name);
};
export const fileUri = (name: string) => managedFile(name).uri;
const imports = new ImportPipeline({
  async read(asset) {
    const dir = root();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(asset.uri);
    if (!file.exists || !file.size || file.size > LIMITS.file)
      throw new Error('文件不可读取、为空或超过 80 MB');
    return file.bytes();
  },
  has: (name) => managedFile(name).exists,
  put(name, bytes) {
    const file = managedFile(name);
    file.create({ overwrite: true });
    file.write(bytes);
  },
  remove(name) {
    const file = managedFile(name);
    if (file.exists) file.delete();
  },
});
export const importAsset = (repo: Repository, asset: ImportSource, signal?: AbortSignal) =>
  imports.import(repo, asset, signal);
export const pickBooks = () =>
  DocumentPicker.getDocumentAsync({
    type: ['application/epub+zip', 'application/pdf'],
    multiple: true,
    copyToCacheDirectory: true,
  });
export async function removeBook(repo: Repository, book: Book) {
  // Remove index first. A crash can leave an orphan, never a dangling live book record.
  await repo.deleteBook(book.id);
  for (const name of [book.fileName, book.coverName])
    if (name) {
      const file = managedFile(name);
      if (file.exists) file.delete();
    }
}
export async function reconcileLibrary(repo: Repository) {
  const dir = root();
  if (!dir.exists) return;
  const names = new Set(
    (await repo.books()).flatMap((b) => [b.fileName, b.coverName].filter((x): x is string => !!x))
  );
  for (const entry of dir.list()) {
    if (
      entry instanceof File &&
      /^[\da-f]{64}\.(epub|pdf|jpg|png|webp)$/.test(entry.name) &&
      !names.has(entry.name)
    )
      entry.delete();
  }
}
export function releasePickerCache(uri: string) {
  // Never delete user originals or app-managed documents, even if a provider returns an unexpected URI.
  if (!uri.startsWith(Paths.cache.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* OS may have already purged it. */
  }
}
