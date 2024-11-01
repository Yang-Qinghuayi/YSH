import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useMovieStore = defineStore('movie', {
  state: () => {
    return useLocalStorage('movie',{
      moviePath: '',
      movieAlbum:[],
    })
  },
  getters: {},
  actions: {
    SET_MoviePath(options) {
      this.moviePath = options
    },
    SET_MovieAlbum(options) {
      this.movieAlbum = options
    }
  },
})
