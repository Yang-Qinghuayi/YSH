import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

import type { PaletteId } from '@/utils/paletteConfig'
import { paletteSeedMap } from '@/utils/paletteConfig'

export enum NavPosition {
  left,
  top,
}

export interface SettingState {
  locale: string;
  // Material You 主题系统（从 Noctua 移植）
  palette: PaletteId;
  materialSeed: string;
  seedEnabled: boolean;
  // 布局
  rail: boolean;
  showBigCatalog: boolean;
  miniPlayer: boolean;
  navPosition: NavPosition;
}

export const useSettingStore = defineStore('setting', {
  state: () => {
    return useLocalStorage<SettingState>(
      'setting',
      {
        locale: 'zhCN',
        palette: 'default',
        materialSeed: paletteSeedMap['default'],
        seedEnabled: false,
        rail: true,
        showBigCatalog: true,
        miniPlayer: false,
        navPosition: NavPosition.left,
      },
      { mergeDefaults: true }
    )
  },
})
