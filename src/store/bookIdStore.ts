import { useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';

export const useBookIdStore = defineStore('bookId', () => {
  const bookId = useLocalStorage<string>('bookId', '');

  function setBookId(id: string) {
    bookId.value = id;
  }

  return {
    bookId,
    setBookId,
  };
});
