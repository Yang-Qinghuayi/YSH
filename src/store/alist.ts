import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useAlistStore = defineStore('alist', {
  state: () => {
    return useLocalStorage('alist', {
      username: '',
      token: '',
      logged: false,
    })
  },
  getters: {},
  actions: {
    setUsername(username: string) {
      this.username = username
    },
    setToken(token: string) {
      this.token = token
    },
    setLogged(logged: boolean) {
      this.logged = logged
    },  
  },
})
