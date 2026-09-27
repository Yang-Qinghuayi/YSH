import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

import type { PaletteId } from '@/utils/paletteConfig'
import { paletteSeedMap } from '@/utils/paletteConfig'

export enum NavPosition {
  left,
  top,
}

export interface SettingState {
  locale: string
  // Material You 主题系统（从 Noctua 移植）
  palette: PaletteId
  materialSeed: string
  seedEnabled: boolean
  // 布局
  rail: boolean
  showBigCatalog: boolean
  miniPlayer: boolean
  navPosition: NavPosition
  // 字体
  uiFont: string
  editorFontSize: number
  // AI 写作（DeepSeek）
  // 注意：API Key 不在此持久化，见 @/hooks/useApiKey（区分「记住/仅本次会话」）
  deepseekModel: 'deepseek-chat' | 'deepseek-reasoner'
  /** 是否把 API Key 持久化到本机（关闭则仅本次会话有效） */
  rememberApiKey: boolean
  /** Agent 交互面板：单章目标字数（500 的梯度） */
  agentWriteLength: 500 | 1000 | 1500 | 2000
  // 工作区文件夹（null = 使用 AppData 默认位置）
  workspaceDir: string | null
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
        editorFontSize: 17,
        deepseekModel: 'deepseek-chat',
        rememberApiKey: true,
        agentWriteLength: 1500,
        workspaceDir: null,
      },
      { mergeDefaults: true },
    )
  },
})
