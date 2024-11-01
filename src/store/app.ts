import { defineStore } from 'pinia'
import { reactive, toRefs } from 'vue'

import { useUserStore } from '@/store/user'

export interface AppState {
  showControlCenter: boolean
  showLogin: boolean
  showCommandPalette: boolean
  showPlaying: boolean
  showLyric: boolean
  showSearch: boolean
}
export const useAppStore = defineStore('app', {
  state: () => {
    const state = reactive<AppState>({
      showControlCenter: false,
      showLogin: false,
      showPlaying: false,
      showCommandPalette: false,
      showLyric: false,
      showSearch: false,
    })
    return {
      ...toRefs(state),
    }
  },
  actions: {
    async init() {
      const userStore = useUserStore()
      await userStore.fetch()
    },
  },
})
