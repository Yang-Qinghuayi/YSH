// 调色板配置（对应 Noctua app-shell.tsx 中的 palettes 和 paletteSeedMap）

export type PaletteId =
  | 'default'
  | 'material-rose-dawn'
  | 'material-sage-poem'
  | 'material-indigo-nocturne'
  | 'material-terracotta-muse'

export const palettes = [
  { id: 'default' as PaletteId, label: '星夜' },
  { id: 'material-rose-dawn' as PaletteId, label: '蔷薇晨雾' },
  { id: 'material-sage-poem' as PaletteId, label: '鼠尾草诗页' },
  { id: 'material-indigo-nocturne' as PaletteId, label: '靛蓝夜曲' },
  { id: 'material-terracotta-muse' as PaletteId, label: '陶土缪斯' },
] as const

export const paletteSeedMap: Record<PaletteId, string> = {
  'default': '#1f3c88',
  'material-rose-dawn': '#b05279',
  'material-sage-poem': '#5f7f63',
  'material-indigo-nocturne': '#4f5fa8',
  'material-terracotta-muse': '#b86545',
}

export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return palettes.some((item) => item.id === value)
}
