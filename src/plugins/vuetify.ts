// 加载 Vuetify 的基础样式与组件所依赖的工具类；组件样式由各组件模块引入。
import 'vuetify/styles';

import type { App } from 'vue';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

// 基础主题 - 颜色将由 useMaterialYouTheme 通过 CSS 变量动态覆盖
// 陶土缪斯（默认调色板）
const baseTheme = {
  dark: false,
  colors: {
    primary: '#b85e4b',
    'on-primary': '#fff8f6',
    'primary-container': '#ffd9cd',
    secondary: '#8f6b50',
    'on-secondary': '#fff9f6',
    'secondary-container': '#f6e2bf',
    tertiary: '#8f6b50',
    'on-tertiary': '#fff9f6',
    'tertiary-container': '#f4ddce',
    error: '#b3261e',
    'error-container': '#ffdad4',
    success: '#2f6b4f',
    'on-success': '#ffffff',
    'success-container': '#cfe9d8',
    info: '#3b5f8f',
    'on-info': '#ffffff',
    warning: '#8a5a00',
    'on-warning': '#ffffff',
    'on-error': '#ffffff',
    'on-error-container': '#410001',
    background: '#fff4ef',
    'on-background': '#432920',
    surface: '#fff7f2',
    'on-surface': '#432920',
    'surface-variant': '#f5ece6',
    'on-surface-variant': '#725247',
    outline: '#ddbeaf',
    'outline-variant': '#b48d7e',
    'inverse-surface': '#34211d',
    'inverse-on-surface': '#fff0ea',
    'inverse-primary': '#ffd9cd',
  },
};

export const useVuetify = (app: App) => {
  // 组件与指令由 vite-plugin-vuetify 的 autoImport 按需注入。
  const vuetify = createVuetify({
    defaults: {
      // 开启时使用主题主色；关闭时也保留清晰的中性轨道，便于辨认状态。
      VSwitch: { color: 'primary', baseColor: 'outline' },
      VSlider: { color: 'primary' },
    },
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
      // utilities: false —— 不让 Vuetify 生成自己的 .text-primary / .bg-* /
      // .border-* 颜色类。那些类在运行时注入的 theme-foreground /
      // theme-background 层里，声明时机晚于 Tailwind 的 utilities，
      // 同名同类时会盖掉 Tailwind 的结果；关掉后颜色类只有 Tailwind 一个来源。
      // （--v-theme-* 变量照常生成，Vuetify 组件内部与 Tailwind 的 --color-* 都依赖它们）
      utilities: false,
      themes: {
        light: { dark: false, colors: baseTheme.colors },
        dark: { dark: true, colors: baseTheme.colors },
      },
    },
  });
  app.use(vuetify);
  return vuetify;
};
