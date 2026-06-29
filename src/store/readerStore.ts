import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useSettingsStore } from './settingsStore';
import { useBookDataStore } from './bookDataStore';
import { useLibraryStore } from './libraryStore';
import { updateTocCFI, updateTocID } from '@/utils/toc';
import { getPrimaryLanguage } from '@/utils/book';

import type { ViewSettings, BookProgress, PageInfo, BookConfig, BookContent } from '@/types/book';
import type { FoliateView } from '@/types/view';
import { BookDoc, DocumentLoader, SectionItem, TOCItem } from '@/libs/document';
import { useAppService } from '@/hooks/useEnv';

interface ViewState {
  key: string;
  view: FoliateView | null;
  isPrimary: boolean;
  loading: boolean;
  error: string | null;
  progress: BookProgress | null;
  ribbonVisible: boolean;
  viewSettings: ViewSettings | null;
}

export const useReaderStore = defineStore('reader', () => {
  const viewStates = ref<Record<string, ViewState>>({});
  const bookKeys = ref<string[]>([]);
  const hoveredBookKey = ref<string | null>(null);
  const showMenu = ref<boolean>(false)

  const switchShowMenu = () => {
    showMenu.value = !showMenu.value;
  }

  const closeMenu = () => {
    showMenu.value = false;
  }

  const setBookKeys = (keys: string[]) => {
    bookKeys.value = keys;
  };

  const setHoveredBookKey = (key: string | null) => {
    hoveredBookKey.value = key;
  };

  const getView = (key: string | null) => {
    return key ? viewStates.value[key]?.view || null : null;
  };

  const setView = (key: string, view: FoliateView) => {
    const vs = viewStates.value[key];
    if (vs) {
      vs.view = view;
    }
  };

  const getViews = computed(() => {
    return Object.values(viewStates.value)
      .map(v => v.view)
      .filter(Boolean) as FoliateView[];
  });

  const getViewsById = (id: string) => {
    return Object.values(viewStates.value)
      .filter(v => v.key.startsWith(id))
      .map(v => v.view!)
      .filter(Boolean);
  };

  const clearViewState = (key: string) => {
    delete viewStates.value[key];
  };

  const getViewState = (key: string) => {
    return viewStates.value[key] || null;
  };

  const getViewSettings = (key: string) => {
    return viewStates.value[key]?.viewSettings || null;
  };

  const setViewSettings = (key: string, settings: ViewSettings) => {
    const id = key.split('-')[0]!;
    const bookDataStore = useBookDataStore();
    const bookData = bookDataStore.booksData[id];
    const vs = viewStates.value[key];

    if (!vs || !bookData) return;

    if (vs.isPrimary) {
      bookDataStore.booksData[id] = {
        ...bookData,
        config: {
          ...bookData.config,
          updatedAt: Date.now(),
          viewSettings: settings,
        },
      };
    }

    vs.viewSettings = settings;
  };

  const getProgress = (key: string) => {
    return viewStates.value[key]?.progress || null;
  };

  const setProgress = (
    key: string,
    location: string,
    tocItem: TOCItem,
    section: PageInfo,
    pageinfo: PageInfo,
    range: Range
  ) => {
    const id = key.split('-')[0]!;
    const bookDataStore = useBookDataStore();
    const viewState = viewStates.value[key];
    if (!viewState) return;

    const progress: [number, number] = [(pageinfo.next ?? pageinfo.current) + 1, pageinfo.total];

    const libraryStore = useLibraryStore();
    const idx = libraryStore.library.findIndex(b => b.hash === id);

    if (idx !== -1) {
      const updatedBook = {
        ...libraryStore.library[idx],
        progress,
        updatedAt: Date.now(),
      };
      libraryStore.library[idx] = updatedBook;
    }

    const bookData = bookDataStore.booksData[id];
    if (bookData) {
      const newConfig = {
        ...bookData.config,
        updatedAt: Date.now(),
        progress,
        location,
      };
      bookDataStore.booksData[id] = {
        ...bookData,
        config: viewState.isPrimary ? newConfig : bookData.config,
      };
    }

    viewState.progress = {
      location,
      sectionHref: tocItem?.href,
      sectionLabel: tocItem?.label,
      sectionId: tocItem?.id,
      section,
      pageinfo,
      range,
    };
  };

  const setBookmarkRibbonVisibility = (key: string, visible: boolean) => {
    const vs = viewStates.value[key];
    if (vs) {
      vs.ribbonVisible = visible;
    }
  };

  const initViewState = async (id: string, isPrimary = true) => {
    const bookDataStore = useBookDataStore();
    let bookData = bookDataStore.booksData[id];

    viewStates.value[id] = {
      key: '',
      view: null,
      isPrimary: false,
      loading: true,
      error: null,
      progress: null,
      ribbonVisible: false,
      viewSettings: null,
    };

    try {
      if (!bookData) {
        const appService = await useAppService()
        const { settings } = useSettingsStore();
        const { library } = useLibraryStore();

        const book = library.find(b => b.hash === id);
        if (!book) throw new Error('Book not found');

        const content = (await appService.loadBookContent(book, settings)) as BookContent;
        const { file, config } = content;

        const { book: loadedBookDoc } = await new DocumentLoader(file).open();
        const bookDoc = loadedBookDoc as BookDoc;

        if (bookDoc.toc?.length && bookDoc.sections?.length) {
          updateTocID(bookDoc.toc);
          const sections = bookDoc.sections.reduce((map: Record<string, SectionItem>, section) => {
            map[section.id] = section;
            return map;
          }, {});
          updateTocCFI(bookDoc, bookDoc.toc, sections);
        }

        book.primaryLanguage ??= getPrimaryLanguage(bookDoc.metadata.language);

        bookDataStore.booksData[id] = { id, book, file, config, bookDoc };
      }

      const currentConfig = bookDataStore.booksData[id]?.config as BookConfig;

      viewStates.value[id] = {
        key: id,
        view: null,
        isPrimary,
        loading: false,
        error: null,
        progress: null,
        ribbonVisible: false,
        viewSettings: JSON.parse(JSON.stringify(currentConfig.viewSettings!)),
      };
    } catch (error) {
      console.error(error);
      viewStates.value[id] = {
        key: '',
        view: null,
        isPrimary: false,
        loading: false,
        error: 'Failed to load book.',
        progress: null,
        ribbonVisible: false,
        viewSettings: null,
      };
    }
  };

  return {
    viewStates,
    bookKeys,
    hoveredBookKey,
    setBookKeys,
    setHoveredBookKey,
    getView,
    setView,
    getViews,
    getViewsById,
    clearViewState,
    getViewState,
    initViewState,
    getViewSettings,
    setViewSettings,
    getProgress,
    setProgress,
    setBookmarkRibbonVisibility,
    switchShowMenu,
    closeMenu,
    showMenu,
  };
});
