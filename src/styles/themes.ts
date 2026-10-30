// 书籍阅读器内容配色方案（注入到 foliate 书本 iframe 内）
// 与 Material You 应用主题系统（utils/materialYou.ts）是两套独立的系统

import { argbFromHex, Hct, hexFromArgb, TonalPalette } from '@material/material-color-utilities';

import { stubTranslation as _ } from '../utils/misc';

export interface BaseColor {
  bg: string;
  fg: string;
  primary: string;
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Palette {
  'base-100': string;
  'base-200': string;
  'base-300': string;
  'base-content': string;
  neutral: string;
  'neutral-content': string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface Theme {
  name: string;
  label: string;
  colors: {
    light: Palette;
    dark: Palette;
  };
  isCustomizale?: boolean;
}

export interface CustomTheme {
  name: string;
  label: string;
  colors: {
    light: BaseColor;
    dark: BaseColor;
  };
}

// ---- HCT 色彩工具（Material 3 官方色彩空间，替代已停止维护的 tinycolor2） ----

const clampTone = (tone: number) => Math.min(100, Math.max(0, tone));

/** 保持色相/彩度，仅按 delta 调整明度（tone 0-100） */
const shiftTone = (hex: string, delta: number, maxChroma?: number) => {
  const c = Hct.fromInt(argbFromHex(hex));
  const chroma = maxChroma === undefined ? c.chroma : Math.min(c.chroma, maxChroma);
  return hexFromArgb(Hct.from(c.hue, chroma, clampTone(c.tone + delta)).toInt());
};

/** 由 primary 派生出关联色：旋转色相 + 缩放彩度 + 平移明度 */
const relatedTone = (hex: string, hueDelta: number, chromaScale: number, toneDelta: number) => {
  const c = Hct.fromInt(argbFromHex(hex));
  const palette = TonalPalette.fromHueAndChroma(
    (c.hue + hueDelta + 360) % 360,
    Math.max(c.chroma * chromaScale, 8)
  );
  return hexFromArgb(palette.tone(clampTone(c.tone + toneDelta)));
};

export const generateLightPalette = ({ bg, fg, primary }: BaseColor) => {
  return {
    'base-100': bg,
    'base-200': shiftTone(bg, -5),
    'base-300': shiftTone(bg, -12),
    'base-content': fg,
    neutral: shiftTone(bg, -15, 6),
    'neutral-content': shiftTone(fg, 20, 6),
    primary: primary,
    secondary: relatedTone(primary, 0, 0.45, 20),
    // M3 tertiary：色相 +60°，与 primary 形成同族但可区分的强调色
    accent: relatedTone(primary, 60, 0.85, 0),
  } as Palette;
};

export const generateDarkPalette = ({ bg, fg, primary }: BaseColor) => {
  return {
    'base-100': bg,
    'base-200': shiftTone(bg, 5),
    'base-300': shiftTone(bg, 12),
    'base-content': fg,
    neutral: shiftTone(bg, 15, 6),
    'neutral-content': shiftTone(fg, -20, 6),
    primary: primary,
    secondary: relatedTone(primary, 0, 0.45, -20),
    // 深色下用 120° 补色作为强调色，保证在暗底上仍然醒目
    accent: relatedTone(primary, 120, 0.8, 0),
  } as Palette;
};

export const themes = [
  {
    name: 'default',
    label: _('Default'),
    colors: {
      light: generateLightPalette({ fg: '#171717', bg: '#ffffff', primary: '#0066cc' }),
      dark: generateDarkPalette({ fg: '#e0e0e0', bg: '#222222', primary: '#77bbee' }),
    },
  },
  {
    name: 'gray',
    label: _('Gray'),
    colors: {
      light: generateLightPalette({ fg: '#222222', bg: '#e0e0e0', primary: '#4488cc' }),
      dark: generateDarkPalette({ fg: '#c6c6c6', bg: '#444444', primary: '#88ccee' }),
    },
  },
  {
    name: 'sepia',
    label: _('Sepia'),
    colors: {
      light: generateLightPalette({ fg: '#5b4636', bg: '#f1e8d0', primary: '#008b8b' }),
      dark: generateDarkPalette({ fg: '#ffd595', bg: '#342e25', primary: '#48d1cc' }),
    },
  },
  {
    name: 'grass',
    label: _('Grass'),
    colors: {
      light: generateLightPalette({ fg: '#232c16', bg: '#d7dbbd', primary: '#177b4d' }),
      dark: generateDarkPalette({ fg: '#d8deba', bg: '#333627', primary: '#a6d608' }),
    },
  },
  {
    name: 'cherry',
    label: _('Cherry'),
    colors: {
      light: generateLightPalette({ fg: '#4e1609', bg: '#f0d1d5', primary: '#de3838' }),
      dark: generateDarkPalette({ fg: '#e5c4c8', bg: '#462f32', primary: '#ff646e' }),
    },
  },
  {
    name: 'sky',
    label: _('Sky'),
    colors: {
      light: generateLightPalette({ fg: '#262d48', bg: '#cedef5', primary: '#2d53e5' }),
      dark: generateDarkPalette({ fg: '#babee1', bg: '#282e47', primary: '#ff646e' }),
    },
  },
  {
    name: 'solarized',
    label: _('Solarized'),
    colors: {
      light: generateLightPalette({ fg: '#586e75', bg: '#fdf6e3', primary: '#268bd2' }),
      dark: generateDarkPalette({ fg: '#93a1a1', bg: '#002b36', primary: '#268bd2' }),
    },
  },
  {
    name: 'gruvbox',
    label: _('Gruvbox'),
    colors: {
      light: generateLightPalette({ fg: '#3c3836', bg: '#fbf1c7', primary: '#076678' }),
      dark: generateDarkPalette({ fg: '#ebdbb2', bg: '#282828', primary: '#83a598' }),
    },
  },
  {
    name: 'nord',
    label: _('Nord'),
    colors: {
      light: generateLightPalette({ fg: '#2e3440', bg: '#eceff4', primary: '#5e81ac' }),
      dark: generateDarkPalette({ fg: '#d8dee9', bg: '#2e3440', primary: '#88c0d0' }),
    },
  },
  {
    name: 'contrast',
    label: _('Contrast'),
    colors: {
      light: generateLightPalette({ fg: '#000000', bg: '#ffffff', primary: '#4488cc' }),
      dark: generateDarkPalette({ fg: '#ffffff', bg: '#000000', primary: '#88ccee' }),
    },
  },
  {
    name: 'sunset',
    label: _('Sunset'),
    colors: {
      light: generateLightPalette({ fg: '#423126', bg: '#fff7f0', primary: '#fe6b64' }),
      dark: generateDarkPalette({ fg: '#f6e1d7', bg: '#3c2b25', primary: '#ff9c94' }),
    },
  },
] as Theme[];
