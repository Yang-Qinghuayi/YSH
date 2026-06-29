/* eslint-disable import/no-unresolved */
import 'vuetify/styles'

import type { App } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/lib/components/index'
import * as directives from 'vuetify/lib/directives/index'
import { aliases, mdi } from 'vuetify/lib/iconsets/mdi-svg'

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
}

export const useVuetify = (app: App) => {
  const vuetify = createVuetify({
    components,
    directives,
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
  })
  app.use(vuetify)
  return vuetify
}
