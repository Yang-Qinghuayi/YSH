import type { BookDoc } from '@/libs/document';

import type { Book, BookConfig, BookContent } from './book';
import type { SystemSettings } from './settings';

export type AppPlatform = 'web' | 'tauri';
export type OsPlatform = 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown';
export type BaseDir = 'Books' | 'Settings' | 'Data' | 'Log' | 'Cache' | 'None';

export interface FileSystem {
  getURL(path: string): string;
  getBlobURL(path: string, base: BaseDir): Promise<string>;
  openFile(path: string, base: BaseDir, filename?: string): Promise<File>;
  copyFile(srcPath: string, dstPath: string, base: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  removeFile(path: string, base: BaseDir): Promise<void>;
  readDir(path: string, base: BaseDir): Promise<{ path: string; isDir: boolean }[]>;
  createDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  removeDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
  getPrefix(base: BaseDir): string | null;
}

export interface AppService {
  fs: FileSystem;
  osPlatform: OsPlatform;
  appPlatform: AppPlatform;
  hasTrafficLight: boolean;
  hasWindow: boolean;
  hasWindowBar: boolean;
  hasContextMenu: boolean;
  hasRoundedWindow: boolean;
  hasSafeAreaInset: boolean;
  hasHaptics: boolean;
  // hasSysFontsList: boolean;
  isMobile: boolean;
  isAppDataSandbox: boolean;
  isAndroidApp: boolean;
  isIOSApp: boolean;
  isMacOSApp: boolean;
  isLinuxApp: boolean;
  isWindowsApp: boolean;

  selectDirectory(): Promise<string>;
  selectFiles(name: string, extensions: string[]): Promise<string[]>;
  loadSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  importBook(
    file: string | File,
    books: Book[],
    saveBook?: boolean,
    saveCover?: boolean,
    overwrite?: boolean,
    transient?: boolean
  ): Promise<Book | null>;
  deleteBook(book: Book, includingUploaded?: boolean): Promise<void>;
  loadBookConfig(book: Book, settings: SystemSettings): Promise<BookConfig>;
  fetchBookDetails(book: Book, settings: SystemSettings): Promise<BookDoc['metadata']>;
  saveBookConfig(book: Book, config: BookConfig, settings?: SystemSettings): Promise<void>;
  loadBookContent(book: Book, settings: SystemSettings): Promise<BookContent>;
  loadLibraryBooks(): Promise<Book[]>;
  saveLibraryBooks(books: Book[]): Promise<void>;
  getCoverImageUrl(book: Book): string;
  getCoverImageBlobUrl(book: Book): Promise<string>;
  generateCoverImageUrl(book: Book): Promise<string>;
}
