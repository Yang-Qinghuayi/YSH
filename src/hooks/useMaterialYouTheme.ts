import { usePreferredDark } from '@vueuse/core';
import { useTheme } from 'vuetify';

import { useSettingStore } from '@/store/setting';
import { getMaterialYouThemeColors } from '@/utils/materialYou';

/** 字体键名 → CSS font-family 完整值 */
export const UI_FONT_OPTIONS = [
  {
    key: 'LXGW WenKai',
    label: '霞鹜文楷',
    css: '"LXGW WenKai", "LXGW WenKai Screen", "霞鹜文楷", serif',
  },
  { key: 'Noto Serif SC', label: '思源宋体', css: '"Noto Serif SC", "Source Han Serif SC", serif' },
  {
    key: 'Noto Sans SC',
    label: '思源黑体',
    css: '"Noto Sans SC", "Source Han Sans SC", sans-serif',
  },
  { key: 'system-ui', label: '系统默认', css: 'system-ui, sans-serif' },
] as const;

const UI_FONT_MAP = Object.fromEntries(UI_FONT_OPTIONS.map((f) => [f.key, f.css]));

/**
 * Material You 主题管理 composable
 *
 * 色值链路（唯一来源 → 消费方）：
 *   种子色 → getMaterialYouThemeColors()（utils/materialYou.ts，M3 角色色）
 *          → Vuetify 响应式 theme → --v-theme-*（三元组，Vuetify 组件消费）
 *          → --color-*（styles/tailwind.css 的 @theme，包一层 rgb()）
 *          → Tailwind 工具类（含 /60 这类透明度）与手写 CSS 的 var(--color-*)
 *
 * 以前这里有一段「写 CSS 变量 → getComputedStyle 回读 → 喂给 Vuetify」的
 * 搬运逻辑，以及 global.scss 里 4 套手写静态调色板，都已删除：预设与自定义
 * 种子现在走同一条 MCU 路径。
 */
export function useMaterialYouTheme() {
  const settingStore = useSettingStore();
  const vuetifyTheme = useTheme();
  const prefersDark = usePreferredDark();

  const applyTheme = () => {
    const { materialSeed, uiFont } = settingStore;

    // 1. 全局字体变量
    const fontFamily = UI_FONT_MAP[uiFont] ?? UI_FONT_MAP['LXGW WenKai'];
    document.documentElement.style.setProperty('--font-sans', fontFamily);

    // 2. 用种子色生成 light / dark 两套角色色，直接写进 Vuetify 主题
    //    （seedEnabled 只影响设置界面上哪个色点高亮，不再影响走哪条链路）
    //
    //    用 Object.assign 而不是整个替换 colors：Vuetify 默认主题里还有
    //    surface-bright / border-color 等这里不产出的角色，整体替换会把它们
    //    一起丢掉，组件里引用 --v-theme-surface-bright 的地方就会失效。
    Object.assign(
      vuetifyTheme.themes.value.light.colors,
      getMaterialYouThemeColors(materialSeed, false) as any
    );
    Object.assign(
      vuetifyTheme.themes.value.dark.colors,
      getMaterialYouThemeColors(materialSeed, true) as any
    );

    // 3. 切换主题 → Vuetify 重新生成 --v-theme-*，--color-* 随之派生
    vuetifyTheme.change(prefersDark.value ? 'dark' : 'light');
  };

  watchEffect(applyTheme);

  return { applyTheme };
}
