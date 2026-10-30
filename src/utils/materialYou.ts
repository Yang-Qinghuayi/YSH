// Material You 主题（Material 3 官方色彩系统）
//
// 由 Google 官方的 @material/material-color-utilities 生成角色色：
// SchemeTonalSpot 就是 Android 12/13 默认的「动态取色」方案。
// 这里把 M3 的 role（primary / surface / outline …）映射到应用既有的
// CSS 变量命名上，替换原先手写的 HSL 近似算法（移植自 Noctua）。

import type { TonalPalette } from '@material/material-color-utilities';
import { argbFromHex, Hct, hexFromArgb, SchemeTonalSpot } from '@material/material-color-utilities';

/** 需要清理的 CSS 变量（与 getMaterialYouVars 的 key 保持一致） */
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
  '--success',
  '--success-container',
  '--info',
  '--warning',
  '--surface-elev-1',
  '--surface-elev-2',
  '--surface-elev-3',
] as const;

export const MATERIAL_YOU_DEFAULT_SEED = '#6750a4';

/** 应用种子色：把生成的 M3 角色色写成 :root 内联变量 */
export function applyMaterialYouSeed(seedHex: string, isDark = false) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = getMaterialYouVars(seedHex, isDark);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

/** 清除种子色覆盖，回落到 global.scss 中静态定义的调色板 */
export function clearMaterialYouSeedOverrides() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of MATERIAL_YOU_KEYS) {
    root.style.removeProperty(key);
  }
}

/**
 * 生成一整套 Material 3 颜色变量
 * @param seedHex 种子色（#rgb 或 #rrggbb）
 * @param isDark  是否深色方案（M3 深色角色色阶与浅色不同）
 */
export function getMaterialYouVars(seedHex: string, isDark = false): Record<string, string> {
  const seed = argbFromHex(normalizeHex(seedHex) ?? MATERIAL_YOU_DEFAULT_SEED);
  const scheme = new SchemeTonalSpot(Hct.fromInt(seed), isDark, 0);

  const primaryPalette = scheme.primaryPalette;
  const secondaryPalette = scheme.secondaryPalette;
  const tertiaryPalette = scheme.tertiaryPalette;
  const neutralVariantPalette = scheme.neutralVariantPalette;

  // 装饰性渐变色阶（顶部渐变卡片 / 阅读页背景），M3 无对应 role，
  // 由 primary/secondary/tertiary 的色阶在深浅色下分别取合适 tone
  const tone = (palette: TonalPalette, value: number) => hexFromArgb(palette.tone(value));

  return {
    '--background': hexFromArgb(scheme.background),
    '--foreground': hexFromArgb(scheme.onBackground),
    '--bg-accent-a': tone(primaryPalette, isDark ? 30 : 80),
    '--bg-accent-b': tone(tertiaryPalette, isDark ? 35 : 82),
    '--bg-night': tone(primaryPalette, isDark ? 12 : 30),
    '--bg-main': tone(primaryPalette, isDark ? 20 : 40),
    '--bg-end': tone(secondaryPalette, isDark ? 30 : 60),
    '--text-main': hexFromArgb(scheme.onPrimary),
    '--surface': hexFromArgb(scheme.surface),
    '--surface-2': hexFromArgb(scheme.surfaceContainerLow),
    '--surface-tint': `${hexFromArgb(scheme.surfaceTint)}cc`,
    '--on-surface': hexFromArgb(scheme.onSurface),
    '--on-surface-variant': hexFromArgb(scheme.onSurfaceVariant),
    '--primary': hexFromArgb(scheme.primary),
    '--on-primary': hexFromArgb(scheme.onPrimary),
    '--primary-container': hexFromArgb(scheme.primaryContainer),
    '--secondary-container': hexFromArgb(scheme.secondaryContainer),
    '--tertiary': hexFromArgb(scheme.tertiary),
    '--on-tertiary': hexFromArgb(scheme.onTertiary),
    '--tertiary-container': hexFromArgb(scheme.tertiaryContainer),
    '--inverse-surface': hexFromArgb(scheme.inverseSurface),
    '--inverse-on-surface': hexFromArgb(scheme.inverseOnSurface),
    // 细分隔线用 outlineVariant，强调描边用 outline
    '--outline': hexFromArgb(scheme.outlineVariant),
    '--outline-strong': hexFromArgb(scheme.outline),
    '--focus': tone(tertiaryPalette, isDark ? 80 : 40),
    '--error': hexFromArgb(scheme.error),
    // M3 没有语义状态色，按固定色相 + 与当前 scheme 一致的 tone 生成
    '--success': hexFromArgb(Hct.from(150, 32, isDark ? 72 : 40).toInt()),
    '--success-container': tone(neutralVariantPalette, isDark ? 30 : 90),
    '--info': hexFromArgb(Hct.from(250, 40, isDark ? 76 : 42).toInt()),
    '--warning': hexFromArgb(Hct.from(75, 48, isDark ? 78 : 38).toInt()),
    // 卡片层叠阴影：M3 surface container 系列
    '--surface-elev-1': hexFromArgb(scheme.surfaceContainerLowest),
    '--surface-elev-2': hexFromArgb(scheme.surfaceContainer),
    '--surface-elev-3': hexFromArgb(scheme.surfaceContainerHigh),
  };
}

/** 归一化为 #rrggbb；非法输入返回 null */
function normalizeHex(hex: string): string | null {
  const cleaned = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(cleaned)) return cleaned;
  if (/^#[0-9a-f]{3}$/.test(cleaned)) {
    return `#${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}${cleaned[3]}${cleaned[3]}`;
  }
  return null;
}
