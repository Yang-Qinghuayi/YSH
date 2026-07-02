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
  // 字体
  uiFont: string;
  // AI 写作（DeepSeek）
  deepseekApiKey: string;
  deepseekModel: 'deepseek-chat' | 'deepseek-reasoner';
  // 工作区文件夹（null = 使用 AppData 默认位置）
  workspaceDir: string | null;
}

export const useSettingStore = defineStore('setting', {
  state: () => {
    return useLocalStorage<SettingState>(
      'setting',
      {
        locale: 'zhCN',
        palette: 'material-terracotta-muse',
        materialSeed: paletteSeedMap['material-terracotta-muse'],
        seedEnabled: true,
        rail: true,
        showBigCatalog: true,
        miniPlayer: false,
        navPosition: NavPosition.left,
        uiFont: 'LXGW WenKai',
        deepseekApiKey: '',
        deepseekModel: 'deepseek-chat',
        workspaceDir: null,
      },
      { mergeDefaults: true }
    )
  },
})
