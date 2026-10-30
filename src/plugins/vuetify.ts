// Vuetify 样式按需：只引入层顺序/reset 与工具类（d-flex / pa-3 / text-medium-emphasis…），
// 组件样式由 vite-plugin-vuetify 的 autoImport 按需注入，不再 import 'vuetify/styles'（301 KB）。
import 'vuetify/lib/styles/core.css';
import '@/styles/vuetify-utilities.css';

import type { App } from 'vue';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

// 基础主题 - 颜色将由 useMaterialYouTheme 通过 CSS 变量动态覆盖
// 陶土缪斯（默认调色板）
const baseTheme = {
  dark: false,
  colors: {
    primary: '#b85e4b',
    onPrimary: '#fff8f6',
    primaryContainer: '#ffd9cd',
    secondary: '#8f6b50',
    onSecondary: '#fff9f6',
    secondaryContainer: '#f6e2bf',
    tertiary: '#8f6b50',
    onTertiary: '#fff9f6',
    tertiaryContainer: '#f4ddce',
    error: '#b3261e',
    errorContainer: '#ffdad4',
    success: '#2f6b4f',
    onSuccess: '#ffffff',
    successContainer: '#cfe9d8',
    info: '#3b5f8f',
    onInfo: '#ffffff',
    warning: '#8a5a00',
    onWarning: '#ffffff',
    onError: '#ffffff',
    onErrorContainer: '#410001',
    background: '#fff4ef',
    onBackground: '#432920',
    surface: '#fff7f2',
    onSurface: '#432920',
    surfaceVariant: '#f5ece6',
    onSurfaceVariant: '#725247',
    outline: '#ddbeaf',
    outlineVariant: '#b48d7e',
    inverseSurface: '#34211d',
    inverseOnSurface: '#fff0ea',
    inversePrimary: '#ffd9cd',
  },
};

export const useVuetify = (app: App) => {
  // 组件与指令由 vite-plugin-vuetify 的 autoImport 按需注入，
  // 样式同样是按组件按需引入（不再 import 'vuetify/styles'）。
  const vuetify = createVuetify({
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: { mdi },
    },
    display: {
      mobileBreakpoint: 'xs',
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: { dark: false, colors: baseTheme.colors },
        dark: { dark: true, colors: baseTheme.colors },
      },
    },
  });
  app.use(vuetify);
  return vuetify;
};
