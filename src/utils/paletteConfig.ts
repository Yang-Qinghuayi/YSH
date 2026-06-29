// 调色板配置

export type PaletteId =
  | 'material-terracotta-muse'
  | 'material-rose-dawn'
  | 'material-sage-poem'
  | 'material-indigo-nocturne'

export const palettes = [
  { id: 'material-terracotta-muse' as PaletteId, label: '陶土缪斯' },
  { id: 'material-rose-dawn' as PaletteId, label: '蔷薇晨雾' },
  { id: 'material-sage-poem' as PaletteId, label: '鼠尾草诗页' },
  { id: 'material-indigo-nocturne' as PaletteId, label: '靛蓝夜曲' },
] as const

export const paletteSeedMap: Record<PaletteId, string> = {
  'material-terracotta-muse': '#b86545',
  'material-rose-dawn': '#b05279',
  'material-sage-poem': '#5f7f63',
  'material-indigo-nocturne': '#4f5fa8',
}

export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return palettes.some((item) => item.id === value)
}
