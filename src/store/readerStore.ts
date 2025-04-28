import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import { BookContent, BookConfig, PageInfo, BookProgress, ViewSettings } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { FoliateView } from '@/types/view';
import { BookDoc, DocumentLoader, SectionItem, TOCItem } from '@/libs/document';
import { updateTocCFI, updateTocID } from '@/utils/toc';
import { useSettingsStore } from './settingsStore';
import { useBookDataStore } from './bookDataStore';
import { useLibraryStore } from './libraryStore';
import { getPrimaryLanguage } from '@/utils/book';

export const useReaderStore = defineStore('reader', () => {
  const view = ref<FoliateView | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref<BookProgress | null>(null);
  const viewSettings = ref<ViewSettings | null>(null);

  const isLoaded = computed(() => !loading.value && view.value !== null);

  const getView = () => view.value;

  const setView = (newView: FoliateView) => {
    view.value = newView;
  };

  const getProgress = () => progress.value;

  const setProgress = (
    location: string,
    tocItem: TOCItem,
    section: PageInfo,
    pageinfo: PageInfo,
    range: Range,
  ) => {
    const id = view.value?.id;
    if (!id) return;

    const bookDataStore = useBookDataStore();
    const bookData = bookDataStore.booksData[id];
    if (!bookData) return;

    const newProgress: [number, number] = [(pageinfo.next ?? pageinfo.current) + 1, pageinfo.total];

    const libraryStore = useLibraryStore();
    const bookIndex = libraryStore.library.findIndex((b) => b.hash === id);
    if (bookIndex !== -1) {
      const updatedBook = { ...libraryStore.library[bookIndex], progress: newProgress, updatedAt: Date.now() };
      libraryStore.library.splice(bookIndex, 1, updatedBook);
    }

    const updatedConfig = {
      ...bookData.config,
      updatedAt: Date.now(),
      progress: newProgress,
      location,
    };

    bookDataStore.booksData[id] = {
      ...bookData,
      config: updatedConfig,
    };

    progress.value = {
      location,
      sectionHref: tocItem?.href,
      sectionLabel: tocItem?.label,
      sectionId: tocItem?.id,
      section,
      pageinfo,
      range,
    };
  };

  const getViewSettings = () => viewSettings.value;

  const setViewSettings = (newSettings: ViewSettings) => {
    const id = view.value?.id;
    if (!id) return;

    const bookDataStore = useBookDataStore();
    const bookData = bookDataStore.booksData[id];
    if (!bookData) return;

    bookDataStore.booksData[id] = {
      ...bookData,
      config: {
        ...bookData.config,
        updatedAt: Date.now(),
        viewSettings: newSettings,
      },
    };

    viewSettings.value = { ...newSettings };
  };

  const initViewState = async (envConfig: EnvConfigType, id: string) => {
    loading.value = true;
    error.value = null;
    const bookDataStore = useBookDataStore();
    const bookData = bookDataStore.booksData[id];

    try {
      if (!bookData) {
        const appService = await envConfig.getAppService();
        const settings = useSettingsStore().settings;
        const library = useLibraryStore().library;
        const book = library.find((b) => b.hash === id);
        if (!book) throw new Error('Book not found');

        const content = (await appService.loadBookContent(book, settings)) as BookContent;
        const { file, config } = content;
        const { book: loadedBookDoc } = await new DocumentLoader(file).open();
        const bookDoc = loadedBookDoc as BookDoc;

        if (bookDoc.toc?.length && bookDoc.sections?.length) {
          updateTocID(bookDoc.toc);
          const sections = Object.fromEntries(bookDoc.sections.map((s) => [s.id, s]));
          updateTocCFI(bookDoc, bookDoc.toc, sections);
        }

        book.primaryLanguage = book.primaryLanguage ?? getPrimaryLanguage(bookDoc.metadata.language);

        bookDataStore.booksData[id] = { id, book, file, config, bookDoc };
      }

      const config = bookDataStore.booksData[id].config as BookConfig;
      viewSettings.value = { ...config.viewSettings };
      loading.value = false;
    } catch (err) {
      console.error(err);
      error.value = 'Failed to load book.';
      loading.value = false;
    }
  };

  return {
    view,
    loading,
    error,
    progress,
    viewSettings,

    isLoaded,

    getView,
    setView,
    getProgress,
    setProgress,
    getViewSettings,
    setViewSettings,
    initViewState,
  };
});
