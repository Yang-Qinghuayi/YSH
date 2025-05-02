import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";

export const useBookIdStore = defineStore("bookId", () => {
  const bookId = useLocalStorage<string>("bookId", "");

  function setBookId(id: string) {
    bookId.value = id;
  }

  return {
    bookId,
    setBookId,
  };
});
