// 移植自 Noctua 的 Material You 主题算法
// 原文件：src/lib/material-you.ts

const MATERIAL_YOU_KEYS = [
  '--background',
  '--foreground',
  '--bg-accent-a',
  '--bg-accent-b',
  '--bg-night',
  '--bg-main',
  '--bg-end',
  '--text-main',
  '--surface',
  '--surface-2',
  '--surface-tint',
  '--on-surface',
  '--on-surface-variant',
  '--primary',
  '--on-primary',
  '--primary-container',
  '--secondary-container',
  '--tertiary',
  '--on-tertiary',
  '--tertiary-container',
  '--inverse-surface',
  '--inverse-on-surface',
  '--outline',
  '--outline-strong',
  '--focus',
  '--error',
  '--surface-elev-1',
  '--surface-elev-2',
  '--surface-elev-3',
] as const

export const MATERIAL_YOU_DEFAULT_SEED = '#6750a4'

type Hsl = { h: number; s: number; l: number }

export function applyMaterialYouSeed(seedHex: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const vars = getMaterialYouVars(seedHex)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

export function clearMaterialYouSeedOverrides() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const key of MATERIAL_YOU_KEYS) {
    root.style.removeProperty(key)
  }
}

export function getMaterialYouVars(seedHex: string): Record<string, string> {
  const seed = hexToHsl(normalizeHex(seedHex) ?? MATERIAL_YOU_DEFAULT_SEED)
  const secondaryHue = rotate(seed.h, 28)
  const tertiaryHue = rotate(seed.h, -42)
  const nightHue = rotate(seed.h, -16)

  const primary = hslToHex({ h: seed.h, s: clamp(seed.s + 6, 26, 62), l: clamp(seed.l - 8, 36, 52) })
  const onPrimary = hslToHex({ h: seed.h, s: 78, l: 97 })
  const primaryContainer = hslToHex({ h: seed.h, s: clamp(seed.s + 14, 34, 70), l: 88 })
  const secondaryContainer = hslToHex({ h: secondaryHue, s: clamp(seed.s, 20, 44), l: 89 })
  const tertiary = hslToHex({ h: tertiaryHue, s: clamp(seed.s + 8, 28, 58), l: 44 })
  const onTertiary = hslToHex({ h: tertiaryHue, s: 80, l: 97 })
  const tertiaryContainer = hslToHex({ h: tertiaryHue, s: clamp(seed.s + 10, 30, 64), l: 88 })

  const background = hslToHex({ h: seed.h, s: 24, l: 97 })
  const surface = hslToHex({ h: seed.h, s: 20, l: 96 })
  const surface2 = hslToHex({ h: seed.h, s: 18, l: 99 })
  const onSurface = hslToHex({ h: seed.h, s: 26, l: 20 })
  const onSurfaceVariant = hslToHex({ h: seed.h, s: 18, l: 37 })
  const outline = hslToHex({ h: seed.h, s: 18, l: 76 })
  const outlineStrong = hslToHex({ h: seed.h, s: 22, l: 62 })
  const inverseSurface = hslToHex({ h: seed.h, s: 22, l: 25 })
  const inverseOnSurface = hslToHex({ h: seed.h, s: 14, l: 94 })

  const bgAccentA = hslToHex({ h: seed.h, s: clamp(seed.s + 10, 30, 66), l: 74 })
  const bgAccentB = hslToHex({ h: secondaryHue, s: clamp(seed.s + 2, 24, 52), l: 73 })
  const bgNight = hslToHex({ h: nightHue, s: clamp(seed.s + 6, 32, 62), l: 28 })
  const bgMain = hslToHex({ h: nightHue, s: clamp(seed.s + 5, 30, 58), l: 40 })
  const bgEnd = hslToHex({ h: secondaryHue, s: clamp(seed.s, 22, 46), l: 60 })

  return {
    '--background': background,
    '--foreground': onSurface,
    '--bg-accent-a': bgAccentA,
    '--bg-accent-b': bgAccentB,
    '--bg-night': bgNight,
    '--bg-main': bgMain,
    '--bg-end': bgEnd,
    '--text-main': hslToHex({ h: seed.h, s: 42, l: 95 }),
    '--surface': surface,
    '--surface-2': surface2,
    '--surface-tint': `${bgNight}cc`,
    '--on-surface': onSurface,
    '--on-surface-variant': onSurfaceVariant,
    '--primary': primary,
    '--on-primary': onPrimary,
    '--primary-container': primaryContainer,
    '--secondary-container': secondaryContainer,
    '--tertiary': tertiary,
    '--on-tertiary': onTertiary,
    '--tertiary-container': tertiaryContainer,
    '--inverse-surface': inverseSurface,
    '--inverse-on-surface': inverseOnSurface,
    '--outline': outline,
    '--outline-strong': outlineStrong,
    '--focus': hslToHex({ h: seed.h, s: clamp(seed.s + 18, 42, 74), l: 60 }),
    '--error': '#b3261e',
    '--surface-elev-1': colorMix(surface, '#000000', 6),
    '--surface-elev-2': colorMix(surface, '#000000', 10),
    '--surface-elev-3': colorMix(surface, '#000000', 14),
  }
}

function normalizeHex(hex: string): string | null {
  const cleaned = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(cleaned)) return cleaned
  if (/^#[0-9a-f]{3}$/.test(cleaned)) {
    return `#${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}${cleaned[3]}${cleaned[3]}`
  }
  return null
}

function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }

  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2

  let r = 0
  let g = 0
  let b = 0
  if (h >= 0 && h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  )
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function toHex(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
}

function rotate(h: number, delta: number): number {
  return (h + delta + 360) % 360
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function colorMix(base: string, overlay: string, overlayWeightPercent: number): string {
  const [r1, g1, b1] = hexToRgb(base)
  const [r2, g2, b2] = hexToRgb(overlay)
  const w = clamp(overlayWeightPercent, 0, 100) / 100
  return rgbToHex(
    Math.round(r1 * (1 - w) + r2 * w),
    Math.round(g1 * (1 - w) + g2 * w),
    Math.round(b1 * (1 - w) + b2 * w),
  )
}
