import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useLibraryStore } from './libraryStore';
import { SystemSettings } from '@/types/settings';
import { Book, BookConfig, BookNote } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { BookDoc } from '@/libs/document';
import { useAppService } from '@/hooks/useEnv';

interface BookData {
  id: string;
  book: Book | null;
  file: File | null;
  config: BookConfig | null;
  bookDoc: BookDoc | null;
}

export const useBookDataStore = defineStore('bookData', () => {
  const booksData = ref<Record<string, BookData>>({});

  function getBookData(keyOrId: string): BookData | null {
    const id = keyOrId.split('-')[0];
    return booksData.value[id] || null;
  }

  function getConfig(key: string | null): BookConfig | null {
    if (!key) return null;
    const id = key.split('-')[0];
    return booksData.value[id]?.config || null;
  }

  function setConfig(key: string, partialConfig: Partial<BookConfig>) {
    const id = key.split('-')[0];
    const bookData = booksData.value[id];
    if (bookData) {
      bookData.config = { ...bookData.config, ...partialConfig } as BookConfig;
    }
  }

  async function saveConfig(
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) {
    const appService = await useAppService()
    const libraryStore = useLibraryStore();
    const { library } = libraryStore;
    const id = bookKey.split('-')[0];
    const bookIndex = library.findIndex((b) => b.hash === id);
    if (bookIndex === -1) return;

    const book = library.splice(bookIndex, 1)[0];
    book.progress = config.progress;
    book.updatedAt = Date.now();
    library.unshift(book);

    libraryStore.setLibrary(library);

    config.updatedAt = Date.now();
    await appService.saveBookConfig(book, config, settings);
    await appService.saveLibraryBooks(library);
  }

  function updateBooknotes(key: string, booknotes: BookNote[]): BookConfig | undefined {
    const id = key.split('-')[0];
    const book = booksData.value[id];
    if (!book) return;

    const dedupedBooknotes = Array.from(
      new Map(booknotes.map((item) => [`${item.id}-${item.type}-${item.cfi}`, item])).values()
    );

    const updatedConfig: BookConfig = {
      ...(book.config || {}),
      updatedAt: Date.now(),
      booknotes: dedupedBooknotes,
    };

    book.config = updatedConfig;
    return updatedConfig;
  }

  return {
    booksData,
    getBookData,
    getConfig,
    setConfig,
    saveConfig,
    updateBooknotes,
  };
});
