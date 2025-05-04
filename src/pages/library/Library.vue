<template>
  <div class="h-[88vh]">
    <v-btn variant="tonal" class="ml-3" color="primary" @click="handleImportBooks">
      上传书籍
    </v-btn>
    <div class="mt-2">
      <card-row>
        <v-card @click="goToRead(book.hash)" v-for="book in libraryBooks" :flat="true">
          <v-img class="cover-image" :cover="true" :src="book.coverImageUrl" style="aspect-ratio: 1" :aspect-ratio="1"
            :lazy-src="placeholderUrl">
          </v-img>
          <!-- 名称 -->
          <v-card-title :class="[lgAndUp ? '' : 'text-sm']">
            {{ book.title }}
            <v-menu open-on-hover open-delay=100 close-delay="100">
              <template v-slot:activator="{ props }">
                <v-btn variant="text" color="primary" icon size="small" v-bind="props">
                  <v-icon class="text-[#777c7a]">{{ mdiDotsHorizontal }}</v-icon>
                </v-btn>
              </template>

              <v-list elevation=6 class="p-0">
                <v-list-item class=" px-6 py-4 text-center" v-for="(item, index) in items" :key="index" :value="index"
                  @click="item.function(book.hash)">
                  {{ item.title }}
                </v-list-item>
              </v-list>
            </v-menu>
          </v-card-title>
        </v-card>
      </card-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseOpenWithFiles } from '@/helpers/openWith';
import { FILE_ACCEPT_FORMATS, SUPPORTED_FILE_EXTS } from '@/services/constants';
import { isTauriAppPlatform } from '@/services/environment';
import { useToast } from "vue-toastification";
const toast = useToast();
import { useDisplay } from "vuetify";
const display = useDisplay();
const { lgAndUp } = display;

import { useAppService, initLibrary, libraryLoaded } from "@/hooks/useEnv";
import { useBookIdStore } from '@/store/bookIdStore';
const { setBookId } = useBookIdStore()
import { useTranslation } from '@/hooks/useTranslation';
const _ = useTranslation();
const loading = ref(false)

import { useLibraryStore } from "@/store/libraryStore"
const libraryStore = useLibraryStore()
const {
  updateBook,
  setLibrary,
  checkOpenWithBooks,
  setCheckOpenWithBooks,
} = libraryStore

const { library: libraryBooks } = storeToRefs(libraryStore)

import { getFilename, listFormater } from '@/utils/book';

const processOpenWithFiles = async (appService: AppService, openWithFiles: string[], libraryBooks: Book[]) => {
  const settings = await appService.loadSettings();
  const bookIds: string[] = [];

  for (const file of openWithFiles) {
    console.log('Open with book:', file);
    try {
      const temp = appService.isMobile ? false : !settings.autoImportBooksOnOpen;
      const book = await appService.importBook(file, libraryBooks, true, true, false, temp);
      if (book) {
        bookIds.push(book.hash);
      }
    } catch (error) {
      console.log('Failed to import book:', file, error);
    }
  }

  setLibrary(libraryBooks);
  appService.saveLibraryBooks(libraryBooks);

  console.log('Opening books:', bookIds);
  if (bookIds.length > 0) {
    setTimeout(() => {
      // navigateToReader(router, bookIds);
      // todo 跳转到书籍阅读页面
    }, 0);
  }
};


const handleOpenWithBooks = async (appService: AppService, libraryBooks: Book[]) => {
  const openWithFiles = (await parseOpenWithFiles()) || [];

  if (openWithFiles.length > 0) {
    await processOpenWithFiles(appService, openWithFiles, libraryBooks);
  } else {
    setCheckOpenWithBooks(false);
    setLibrary(libraryBooks);
  }
};


onMounted(async () => {
  const appService = await useAppService()
  await initLibrary()

  if (checkOpenWithBooks && isTauriAppPlatform()) {
    await handleOpenWithBooks(appService, libraryBooks.value);
  }

});

onBeforeUnmount(() => {
  setCheckOpenWithBooks(false);
});

const importBooks = async (files: (string | File)[]) => {
  const appService = await useAppService()
  loading.value = true;
  const failedFiles = [];
  const errorMap: [string, string][] = [
    ['No chapters detected.', _('No chapters detected.')],
    ['Failed to parse EPUB.', _('Failed to parse the EPUB file.')],
    ['Unsupported format.', _('This book format is not supported.')],
  ];
  for (const file of files) {
    try {
      const books = libraryBooks.value
      await appService.importBook(file, books);
      libraryBooks.value = books
    } catch (error: any) {
      const filename = typeof file === 'string' ? file : file.name;
      const baseFilename = getFilename(filename);
      failedFiles.push(baseFilename);
      const errorMessage =
        error instanceof Error
          ? errorMap.find(([substring]) => error.message.includes(substring))?.[1] || ''
          : '';
      toast.error(
        _('Failed to import book(s): {{filenames}}', {
          filenames: listFormater(false).format(failedFiles),
        }) + (errorMessage ? `\n${errorMessage}` : ''),
      );
      console.error('Failed to import book:', filename, error);
    }
  }
  appService.saveLibraryBooks(libraryBooks.value);
  loading.value = false;
};

const selectFilesTauri = async () => {
  const appService = await useAppService()
  const exts = appService.isAndroidApp ? [] : SUPPORTED_FILE_EXTS;
  const files = (await appService.selectFiles(_('Select Books'), exts)) || [];
  // Cannot filter out files on Android since some content providers may not return the file name
  return files;
};

const selectFilesWeb = () => {
  return new Promise((resolve) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = FILE_ACCEPT_FORMATS;
    fileInput.multiple = true;
    fileInput.click();

    fileInput.onchange = () => {
      resolve(fileInput.files);
    };
  });
};

const handleImportBooks = async () => {
  const appService = await useAppService()
  let files;
  if (isTauriAppPlatform()) {
    if (appService.isIOSApp) {
      files = (await selectFilesWeb()) as [File];
    } else {
      files = (await selectFilesTauri()) as [string];
    }
  } else {
    files = (await selectFilesWeb()) as [File];
  }
  importBooks(files);
};



const items = [
  {
    title: '删除', function: () => {
    }
  },
]

// goto read
const router = useRouter();
const goToRead = (id: string) => {
  console.log(id)
  setBookId(id)
  router.push({
    path: "/book",
  });
};

// @ts-ignore
import placeholderUrl from "@/assets/placeholder.png";
import { mdiDotsHorizontal } from "@mdi/js";
import { AppService } from '@/types/system';
import { Book } from '@/types/book';
import { storeToRefs } from 'pinia';

</script>
