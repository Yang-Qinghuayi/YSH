// Material You 主题（Material 3 官方色彩系统）
//
// 由 Google 官方的 @material/material-color-utilities 生成角色色：
// SchemeTonalSpot 就是 Android 12/13 默认的「动态取色」方案。
//
// 【这里是全应用唯一的色值来源】
// 输出一份以 Vuetify theme 的 color key 命名的 hex 表，由
// hooks/useMaterialYouTheme.ts 直接写进 Vuetify 的响应式主题；Vuetify 再把它
// 烘焙成 --v-theme-* 变量，供 Vuetify 组件、Tailwind 的 --color-* 与手写 CSS 消费。
//
// 以前这里先产出 --primary / --surface… 一套自有变量、写进 DOM，再用
// getComputedStyle 读回来喂给 Vuetify，中间那层搬运已经删掉了。

import {
  argbFromHex,
  Hct,
  hexFromArgb,
  SchemeTonalSpot,
  type TonalPalette,
} from '@material/material-color-utilities';

export const MATERIAL_YOU_DEFAULT_SEED = '#6750a4';

/**
 * 生成一套 Material 3 角色色，key 直接就是 Vuetify theme 的 color key。
 *
 * ⚠️ key 必须是 kebab-case：Vuetify 生成 --v-theme-* 时直接把 key 拼进去，不做
 *    任何大小写转换（见 composables/theme.js 的 genCssVariables）。写成 onPrimary
 *    只会得到 --v-theme-onPrimary，而 Vuetify 自己的默认主题用的是
 *    --v-theme-on-primary —— 两套并存时，组件与 CSS 里写的 kebab 名字会静默读到
 *    Vuetify 的默认色，而不是这里的 Material You 色。
 * @param seedHex 种子色（#rgb 或 #rrggbb）
 * @param isDark  是否深色方案（M3 深色角色色阶与浅色不同）
 */
export function getMaterialYouThemeColors(seedHex: string, isDark = false): Record<string, string> {
  const seed = argbFromHex(normalizeHex(seedHex) ?? MATERIAL_YOU_DEFAULT_SEED);
  const scheme = new SchemeTonalSpot(Hct.fromInt(seed), isDark, 0);

  const neutralVariantPalette = scheme.neutralVariantPalette;
  const tone = (palette: TonalPalette, value: number) => hexFromArgb(palette.tone(value));

  return {
    // —— M3 主体角色色 ——
    primary: hexFromArgb(scheme.primary),
    'on-primary': hexFromArgb(scheme.onPrimary),
    'primary-container': hexFromArgb(scheme.primaryContainer),
    // M3 的 onPrimaryContainer 在本项目里一直用 onSurface 顶替（保持既有观感）
    'on-primary-container': hexFromArgb(scheme.onSurface),
    // 项目没有独立的 secondary，沿用既有映射：用 tertiary 顶上
    secondary: hexFromArgb(scheme.tertiary),
    'on-secondary': hexFromArgb(scheme.onTertiary),
    'secondary-container': hexFromArgb(scheme.secondaryContainer),
    'on-secondary-container': hexFromArgb(scheme.onSurface),
    tertiary: hexFromArgb(scheme.tertiary),
    'on-tertiary': hexFromArgb(scheme.onTertiary),
    'tertiary-container': hexFromArgb(scheme.tertiaryContainer),
    'on-tertiary-container': hexFromArgb(scheme.onSurface),

    // —— 表面 / 背景 / 描边 ——
    background: hexFromArgb(scheme.background),
    'on-background': hexFromArgb(scheme.onSurface),
    surface: hexFromArgb(scheme.surface),
    'on-surface': hexFromArgb(scheme.onSurface),
    'surface-variant': hexFromArgb(scheme.surfaceContainerLowest),
    'on-surface-variant': hexFromArgb(scheme.onSurfaceVariant),
    // 注意：细分隔线用 outlineVariant、强调描边用 outline（沿用既有映射）
    outline: hexFromArgb(scheme.outlineVariant),
    'outline-variant': hexFromArgb(scheme.outline),
    'inverse-surface': hexFromArgb(scheme.inverseSurface),
    'inverse-on-surface': hexFromArgb(scheme.inverseOnSurface),
    'inverse-primary': hexFromArgb(scheme.primaryContainer),

    // —— 语义色 ——
    // M3 只有 error，其余（success / info / warning）按固定色相 + 与当前
    // scheme 一致的 tone 生成，保证深浅色下都有可读对比度
    error: hexFromArgb(scheme.error),
    'error-container': '#ffdad4',
    'on-error': '#ffffff',
    'on-error-container': '#410001',
    success: hexFromArgb(Hct.from(150, 32, isDark ? 72 : 40).toInt()),
    'on-success': '#ffffff',
    'success-container': tone(neutralVariantPalette, isDark ? 30 : 90),
    info: hexFromArgb(Hct.from(250, 40, isDark ? 76 : 42).toInt()),
    'on-info': '#ffffff',
    warning: hexFromArgb(Hct.from(75, 48, isDark ? 78 : 38).toInt()),
    'on-warning': '#ffffff',
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
