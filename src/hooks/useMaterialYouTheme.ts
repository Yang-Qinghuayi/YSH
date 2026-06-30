import { usePreferredDark } from '@vueuse/core'
import { useTheme } from 'vuetify'
import { applyMaterialYouSeed, clearMaterialYouSeedOverrides } from '@/utils/materialYou'
import { useSettingStore } from '@/store/setting'

/**
 * 读取 computed CSS 变量值（同步，设置 data-palette 后立即可用）
 */
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * 将 Material You CSS 变量同步到 Vuetify 主题
 * 确保 color="primary" 等 Vuetify prop 与 CSS 变量保持一致
 */
function syncVuetifyTheme(vuetifyTheme: ReturnType<typeof useTheme>, isDark: boolean) {
  const primary = getCssVar('--primary')
  const onPrimary = getCssVar('--on-primary')
  const primaryContainer = getCssVar('--primary-container')
  const secondaryContainer = getCssVar('--secondary-container')
  const tertiary = getCssVar('--tertiary')
  const onTertiary = getCssVar('--on-tertiary')
  const tertiaryContainer = getCssVar('--tertiary-container')
  const surface = getCssVar('--surface')
  const background = getCssVar('--background')
  const onSurface = getCssVar('--on-surface')
  const onSurfaceVariant = getCssVar('--on-surface-variant')
  const outline = getCssVar('--outline')
  const outlineStrong = getCssVar('--outline-strong')
  const inverseSurface = getCssVar('--inverse-surface')
  const inverseOnSurface = getCssVar('--inverse-on-surface')
  const surfaceElev1 = getCssVar('--surface-elev-1')
  const error = getCssVar('--error')

  const colors = {
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer: onSurface,
    // Noctua 没有独立的 secondary，用 tertiary 映射
    secondary: tertiary,
    onSecondary: onTertiary,
    secondaryContainer,
    onSecondaryContainer: onSurface,
    tertiary,
    onTertiary,
    tertiaryContainer,
    onTertiaryContainer: onSurface,
    error,
    errorContainer: '#ffdad4',
    onError: '#ffffff',
    onErrorContainer: '#410001',
    background,
    onBackground: onSurface,
    surface,
    onSurface,
    surfaceVariant: surfaceElev1,
    onSurfaceVariant,
    outline,
    outlineVariant: outlineStrong,
    inverseSurface,
    inverseOnSurface,
    inversePrimary: primaryContainer,
  }

  // 更新当前激活的主题（light 或 dark）
  const themeName = isDark ? 'dark' : 'light'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vuetifyTheme.themes.value[themeName].colors = colors as any
}

/** 字体键名 → CSS font-family 完整值 */
export const UI_FONT_OPTIONS = [
  { key: 'LXGW WenKai',   label: '霞鹜文楷',  css: '"LXGW WenKai", "LXGW WenKai Screen", "霞鹜文楷", serif' },
  { key: 'Noto Serif SC', label: '思源宋体',  css: '"Noto Serif SC", "Source Han Serif SC", serif' },
  { key: 'Noto Sans SC',  label: '思源黑体',  css: '"Noto Sans SC", "Source Han Sans SC", sans-serif' },
  { key: 'system-ui',     label: '系统默认',  css: 'system-ui, sans-serif' },
] as const

const UI_FONT_MAP = Object.fromEntries(UI_FONT_OPTIONS.map(f => [f.key, f.css]))

/**
 * Material You 主题管理 composable
 * 替换原来的 useCurrentTheme + useDynamicChangeTheme
 */
export function useMaterialYouTheme() {
  const settingStore = useSettingStore()
  const vuetifyTheme = useTheme()
  const prefersDark = usePreferredDark()

  const applyTheme = () => {
    const { palette, seedEnabled, materialSeed, uiFont } = settingStore

    // 0. 同步全局字体变量
    const fontFamily = UI_FONT_MAP[uiFont] ?? UI_FONT_MAP['LXGW WenKai']
    document.documentElement.style.setProperty('--font-sans', fontFamily)

    // 1. 设置 data-palette 属性（触发 CSS 选择器规则）
    // 陶土缪斯是 :root 默认值，无需 data-palette；其余调色板显式设置
    if (palette === 'material-terracotta-muse') {
      delete document.documentElement.dataset.palette
    } else {
      document.documentElement.dataset.palette = palette
    }

    // 2. 应用/清除 Material You 种子色内联样式覆盖
    if (seedEnabled) {
      applyMaterialYouSeed(materialSeed)
    } else {
      clearMaterialYouSeedOverrides()
    }

    // 3. 跟随系统深色偏好切换 Vuetify theme
    const isDark = prefersDark.value
    vuetifyTheme.change(isDark ? 'dark' : 'light')

    // 4. 同步 CSS 变量到 Vuetify theme 对象（让 color="primary" 等 prop 生效）
    syncVuetifyTheme(vuetifyTheme, isDark)
  }

  watchEffect(applyTheme)

  return { applyTheme }
}
