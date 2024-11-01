import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useBookStore = defineStore('book', {
  state: () => {
    return {
      book: null,
    }
  },
  getters: {},
  actions: {
    SET_BOOK(options) {
      this.book = options
    },
  },
})
