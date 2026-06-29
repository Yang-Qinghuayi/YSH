/* eslint-disable import/no-unresolved */
import 'vuetify/styles'

import type { App } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/lib/components/index'
import * as directives from 'vuetify/lib/directives/index'
import { aliases, mdi } from 'vuetify/lib/iconsets/mdi-svg'

// 基础主题 - 颜色将由 useMaterialYouTheme 通过 CSS 变量动态覆盖
const baseTheme = {
  dark: false,
  colors: {
    primary: '#d5b25a',
    onPrimary: '#14224a',
    primaryContainer: '#f4e3b9',
    secondary: '#6f70b9',
    onSecondary: '#f9f8ff',
    secondaryContainer: '#d6e6fb',
    tertiary: '#6f70b9',
    onTertiary: '#f9f8ff',
    tertiaryContainer: '#e1e0ff',
    error: '#b3261e',
    errorContainer: '#ffdad4',
    onError: '#ffffff',
    onErrorContainer: '#410001',
    background: '#f8f2dc',
    onBackground: '#1d2a47',
    surface: '#fff6e7',
    onSurface: '#1d2a47',
    surfaceVariant: '#f6efd9',
    onSurfaceVariant: '#42506b',
    outline: '#b7c7e0',
    outlineVariant: '#84a0cd',
    inverseSurface: '#1f2a43',
    inverseOnSurface: '#eef2ff',
    inversePrimary: '#f4e3b9',
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
