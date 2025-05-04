import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Book } from '@/types/book';

export const useLibraryStore = defineStore('library', () => {
  const library = ref<Book[]>([]);
  const checkOpenWithBooks = ref(true);

  // 过滤掉已删除的书籍
  const getVisibleLibrary = computed(() => {
    return library.value.filter((book) => !book.deletedAt);
  });

  // 设置是否检测 open with books
  function setCheckOpenWithBooks(check: boolean) {
    checkOpenWithBooks.value = check;
  }

  // 设置整个图书馆数据
  function setLibrary(books: Book[]) {
    library.value = books;
  }

  // 更新单本书籍，并同步保存
  async function updateBook(book: Book) {
    const appService = await useAppService()
    const index = library.value.findIndex((b) => b.hash === book.hash);
    if (index !== -1) {
      library.value[index] = book;
    }
    await appService.saveLibraryBooks(library.value);
  }

  return {
    library,
    checkOpenWithBooks,
    getVisibleLibrary,
    setCheckOpenWithBooks,
    setLibrary,
    updateBook,
  };
});
