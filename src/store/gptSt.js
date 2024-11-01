import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useGPTStore = defineStore('gpt', {
  state: () => {
    return useLocalStorage('gpt', {
      modelIndex: 1,
      list: [],
      loggedIn: false,
      site:'',
      key:'',
    })
  },
  getters: {},
  actions: {
    Set_ModelIndex(modelIndex) {
      this.modelIndex = modelIndex
    },
    Set_List(list) {
      this.list = list
    },
    Set_LoggedIn(loggedIn) {
      this.loggedIn = loggedIn
    },
    Set_Site(site) {
      this.site = site
    },
    Set_Key(key) {
      this.key = key
    },
  },
})
