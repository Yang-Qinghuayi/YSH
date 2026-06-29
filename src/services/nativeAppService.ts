import {
  exists,
  mkdir,
  open as openFile,
  readTextFile,
  readFile,
  writeTextFile,
  writeFile,
  readDir,
  remove,
  copyFile,
  BaseDirectory,
  WriteFileOptions,
} from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { join, basename, appDataDir, appCacheDir } from '@tauri-apps/api/path';
import { type as osType } from '@tauri-apps/plugin-os';

import { Book } from '@/types/book';
import { FileSystem, BaseDir, AppPlatform } from '@/types/system';
import { isContentURI, isValidURL } from '@/utils/misc';
import { getCoverFilename, getFilename } from '@/utils/book';
import { copyURIToPath } from '@/utils/bridge';
import { NativeFile, RemoteFile } from '@/utils/file';

import { BaseAppService } from './appService';
import { LOCAL_BOOKS_SUBDIR } from './constants';

declare global {
  interface Window {
    IS_ROUNDED?: boolean;
  }
}

const OS_TYPE = osType();

const resolvePath = (fp: string, base: BaseDir): { baseDir: number; base: BaseDir; fp: string } => {
  switch (base) {
    case 'Settings':
      return { baseDir: BaseDirectory.AppConfig, fp, base };
    case 'Data':
      return { baseDir: BaseDirectory.AppData, fp, base };
    case 'Cache':
      return { baseDir: BaseDirectory.AppCache, fp, base };
    case 'Log':
      return { baseDir: BaseDirectory.AppLog, fp, base };
    case 'Books':
      return {
        baseDir: BaseDirectory.AppData,
        fp: `${LOCAL_BOOKS_SUBDIR}/${fp}`,
        base,
      };
    case 'None':
      return {
        baseDir: 0, 
        fp,
        base,
      };
    default:
      return {
        baseDir: BaseDirectory.Temp,
        fp,
        base,
      };
  }
};

export const nativeFileSystem: FileSystem = {
  getURL(path: string) {
    return isValidURL(path) ? path : convertFileSrc(path);
  },
  async getBlobURL(path: string, base: BaseDir) {
    const content = await this.readFile(path, base, 'binary');
    return URL.createObjectURL(new Blob([content]));
  },
  async openFile(path: string, base: BaseDir, name?: string) {
    const { fp, baseDir } = resolvePath(path, base);
    let fname = name || getFilename(fp);
    if (isValidURL(path)) {
      return await new RemoteFile(path, fname).open();
    } else if (isContentURI(path)) {
      fname = await basename(path);
      if (path.includes('com.android.externalstorage')) {
        // If the URI is from shared internal storage (like /storage/emulated/0),
        // we can access it directly using the path — no need to copy.
        return await new NativeFile(fp, fname, base ? baseDir : null).open();
      } else {
        // Otherwise, for content:// URIs (e.g. from MediaStore, Drive, or third-party apps),
        // we cannot access the file directly — so we copy it to a temporary cache location.
        const prefix = this.getPrefix('Cache');
        const dst = `${prefix}/${fname}`;
        const res = await copyURIToPath({ uri: path, dst });
        if (!res.success) {
          console.error('Failed to open file:', res);
          throw new Error('Failed to open file');
        }
        return await new NativeFile(dst, fname, base ? baseDir : null).open();
      }
    } else {
      const prefix = this.getPrefix(base);
      const absolutePath = path.startsWith('/') ? path : prefix ? await join(prefix, path) : null;
      if (absolutePath && OS_TYPE !== 'android') {
        // NOTE: RemoteFile currently performs about 2× faster than NativeFile
        // due to an unresolved performance issue in Tauri (see tauri-apps/tauri#9190).
        // Once the bug is resolved, we should switch back to using NativeFile.
        // RemoteFile is not usable on Android due to unknown issues of range fetch with Android WebView.
        return await new RemoteFile(this.getURL(absolutePath), fname).open();
      } else {
        return await new NativeFile(fp, fname, base ? baseDir : null).open();
      }
    }
  },
  async copyFile(srcPath: string, dstPath: string, base: BaseDir) {
    if (isContentURI(srcPath)) {
      const prefix = this.getPrefix(base);
      if (!prefix) {
        throw new Error('Invalid base directory');
      }
      const res = await copyURIToPath({
        uri: srcPath,
        dst: `${prefix}/${dstPath}`,
      });
      if (!res.success) {
        console.error('Failed to copy file:', res);
        throw new Error('Failed to copy file');
      }
    } else {
      const { fp, baseDir } = resolvePath(dstPath, base);
      await copyFile(srcPath, fp, base && { toPathBaseDir: baseDir });
    }
  },
  async readFile(path: string, base: BaseDir, mode: 'text' | 'binary') {
    const { fp, baseDir } = resolvePath(path, base);
    const opts = baseDir ? { baseDir } : undefined;

    return mode === 'text'
      ? (readTextFile(fp, opts) as Promise<string>)
      : ((await readFile(fp, opts)).buffer as ArrayBuffer);
  },
  async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File) {
    // NOTE: this could be very slow for large files and might block the UI thread
    // so do not use this for large files
    const { fp, baseDir } = resolvePath(path, base);
    const opts = baseDir ? { baseDir } : undefined;

    if (typeof content === 'string') {
      return writeTextFile(fp, content, opts);
    } else if (content instanceof File) {
      // baseDir=0 ('None') 时不传 baseDir
      const writeOptions = baseDir
        ? ({ write: true, create: true, baseDir } as WriteFileOptions)
        : ({ write: true, create: true } as WriteFileOptions);
      const file = await openFile(fp, writeOptions);
      const reader = content.stream().getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await file.write(value);
        }
      } finally {
        reader.releaseLock();
        await file.close();
      }
    } else {
      return writeFile(fp, new Uint8Array(content), opts);
    }
  },
  async removeFile(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    return remove(fp, baseDir ? { baseDir } : undefined);
  },
  async createDir(path: string, base: BaseDir, recursive = false) {
    const { fp, baseDir } = resolvePath(path, base);

    // baseDir=0 ('None') 时不传 baseDir，让 Tauri 把 fp 当绝对路径处理
    await mkdir(fp, baseDir ? { baseDir, recursive } : { recursive });
  },
  async removeDir(path: string, base: BaseDir, recursive = false) {
    const { fp, baseDir } = resolvePath(path, base);

    await remove(fp, baseDir ? { baseDir, recursive } : { recursive });
  },
  async readDir(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    const list = await readDir(fp, baseDir ? { baseDir } : undefined);
    return list.map((entity) => {
      return {
        path: entity.name,
        isDir: entity.isDirectory,
      };
    });
  },
  async exists(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    try {
      const res = await exists(fp, baseDir ? { baseDir } : undefined);
      return res;
    } catch {
      return false;
    }
  },
  getPrefix() {
    return null;
  },
};

export class NativeAppService extends BaseAppService {
  fs = nativeFileSystem;
  override appPlatform = 'tauri' as AppPlatform;
  override isAppDataSandbox = ['android', 'ios'].includes(OS_TYPE);
  override isMobile = ['android', 'ios'].includes(OS_TYPE);
  override isAndroidApp = OS_TYPE === 'android';
  override isIOSApp = OS_TYPE === 'ios';
  override isMacOSApp = OS_TYPE === 'macos';
  override hasTrafficLight = OS_TYPE === 'macos';
  override hasWindow = !(OS_TYPE === 'ios' || OS_TYPE === 'android');
  override hasWindowBar = !(OS_TYPE === 'ios' || OS_TYPE === 'android');
  override hasContextMenu = !(OS_TYPE === 'ios' || OS_TYPE === 'android');
  override hasRoundedWindow = !(OS_TYPE === 'ios' || OS_TYPE === 'android') && !!window.IS_ROUNDED;
  override hasSafeAreaInset = OS_TYPE === 'ios' || OS_TYPE === 'android';
  override hasHaptics = OS_TYPE === 'ios' || OS_TYPE === 'android';
  override hasUpdater = OS_TYPE !== 'ios';

  override resolvePath(fp: string, base: BaseDir): { baseDir: number; base: BaseDir; fp: string } {
    return resolvePath(fp, base);
  }

  async getInitBooksDir(): Promise<string> {
    return join(await appDataDir(), LOCAL_BOOKS_SUBDIR);
  }

  async getCacheDir(): Promise<string> {
    return await appCacheDir();
  }

  async selectDirectory(): Promise<string> {
    const selected = await openDialog({
      directory: true,
      multiple: false,
    });
    return selected as string;
  }

  async selectFiles(name: string, extensions: string[]): Promise<string[]> {
    const selected = await openDialog({
      multiple: true,
      filters: [{ name, extensions }],
    });
    return Array.isArray(selected) ? selected : selected ? [selected] : [];
  }

  getCoverImageUrl = (book: Book): string => {
    return this.fs.getURL(`${this.localBooksDir}/${getCoverFilename(book)}`);
  };

  getCoverImageBlobUrl = async (book: Book): Promise<string> => {
    return this.fs.getBlobURL(`${this.localBooksDir}/${getCoverFilename(book)}`, 'None');
  };
}
