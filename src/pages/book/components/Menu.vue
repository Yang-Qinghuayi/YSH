<template>
  <v-dialog v-model="showMenu" persistent>
    <v-card :class="[smAndUp ? 'w-[560px] p-10' : 'w-full p-4']" color="surface" class="flex items-center flex-col mx-auto">
      <v-card-title class="text-center">菜单</v-card-title>
      <FontSizeSlider class="w-full mt-4" />
      <FontWeightSlider class="w-full mt-4" />
      <TTSPanel class="w-full" />

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-3 py-3 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
          <div>
            <p class="text-gray-700">连续滚动</p>
            <p class="text-xs text-gray-400">像信息流一样上下滑动翻页</p>
          </div>
          <v-switch v-model="scrollMode" hide-details density="compact" color="primary" inset></v-switch>
        </div>
      </div>

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-3 py-3 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
          <p class="text-gray-700 ">双列显示</p>
          <v-switch v-model="setTwoColumn" hide-details class="" density="compact" color="primary" inset></v-switch>
        </div>
      </div>

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-3 py-3 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
          <p class="text-gray-700 ">覆盖字体</p>
          <v-switch v-model="overrideFont" hide-details class="" density="compact" color="primary" inset></v-switch>
        </div>
      </div>

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-3 py-3 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
          <p class="text-gray-700 ">选择字体</p>
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-chip class="text-[#777c7a] my-1" v-bind="props">{{ defaultCJKFont }}</v-chip>
            </template>

            <v-list elevation="6" class="p-0">
              <v-list-item class="px-6 py-4 text-center" v-for="(item, index) in CJKFonts" :key="index" :value="index"
                @click="defaultCJKFont = item">
                {{ item }}
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <v-btn class="w-[50vw] mt-8" variant="tonal" color="secondary" @click.prevent="switchShowMenu">
        关闭
      </v-btn>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import {
  ANDROID_FONTS,
  CJK_EXCLUDE_PATTENS,
  CJK_FONTS_PATTENS,
  CJK_NAMES_PATTENS,
  CJK_SANS_SERIF_FONTS,
  CJK_SERIF_FONTS,
  IOS_FONTS,
  LINUX_FONTS,
  MACOS_FONTS,
  WINDOWS_FONTS,
} from '@/services/constants';
import { getSysFontsList } from '@/utils/bridge';
import FontSizeSlider from "./FontSizeSlider.vue"
import FontWeightSlider from "./FontWeightSlider.vue"
import TTSPanel from "./TTSPanel.vue"
import { isTauriAppPlatform } from '@/services/environment';
import { useDisplay } from "vuetify";
const { smAndUp } = useDisplay();

import { getOSPlatform } from '@/utils/misc';
import { useViewSettings } from '@/hooks/useViewSettings';
import { useReaderStore } from '@/store/readerStore';
const readerStore = useReaderStore()
const { switchShowMenu } = readerStore
const { viewSettings, updateSetting } = useViewSettings()
const osPlatform = getOSPlatform();
let defaultSysFonts: string[] = [];
switch (osPlatform) {
  case 'macos':
    defaultSysFonts = MACOS_FONTS;
    break;
  case 'windows':
    defaultSysFonts = WINDOWS_FONTS;
    break;
  case 'linux':
    defaultSysFonts = LINUX_FONTS;
    break;
  case 'ios':
    defaultSysFonts = IOS_FONTS;
    break;
  case 'android':
    defaultSysFonts = ANDROID_FONTS;
    break;
  default:
    break;
}
const showMenu = defineModel<boolean>("showMenu", { required: true });
const overrideFont = ref(false)

const sysFonts = ref<string[]>(defaultSysFonts)
const defaultCJKFont = ref('')

const scrollMode = ref(false)
const setTwoColumn = ref(false)
const maxColumnCount = computed(() => setTwoColumn.value ? 2 : 1)

const genCJKFontsList = (sysFonts: string[]) => {
  return Array.from(new Set([...sysFonts, ...CJK_SERIF_FONTS, ...CJK_SANS_SERIF_FONTS]))
    .filter((font) => CJK_FONTS_PATTENS.test(font) || CJK_NAMES_PATTENS.test(font))
    .filter((font) => !CJK_EXCLUDE_PATTENS.test(font))
    .sort((a, b) => a.localeCompare(b));
};
// 使用 computed 保持响应性：Tauri 异步回填 sysFonts 后自动重算
const CJKFonts = computed(() => genCJKFontsList(sysFonts.value))

const isSymbolicFontName = (font: string) =>
  /emoji|icons|symbol|dingbats|ornaments|webdings|wingdings|miuiex/i.test(font);

// 当 viewSettings 就绪（或被外部路径更新）时同步到本地 ref
watchEffect(() => {
  if (viewSettings.value) {
    overrideFont.value = viewSettings.value.overrideFont ?? false
    defaultCJKFont.value = viewSettings.value.defaultCJKFont ?? ''
    setTwoColumn.value = viewSettings.value.maxColumnCount === 2
    scrollMode.value = viewSettings.value.scrolled ?? false
  }
})

// 加载系统字体（Tauri 平台）
if (isTauriAppPlatform()) {
  getSysFontsList().then((res) => {
    if (res.error || res.fonts.length === 0) {
      console.error('Failed to get system fonts list:', res.error);
      return;
    }
    const fonts = res.fonts.filter((font) => font && !isSymbolicFontName(font));
    sysFonts.value = [...new Set(fonts)].sort((a, b) => a.localeCompare(b));
  });
}

watch(scrollMode, (val) => {
  // scrolled 控制 renderer flow 属性（paginated ↔ scrolled）
  updateSetting('scrolled', val);
  // continuousScroll 控制到章节边界时自动加载前后章节
  updateSetting('continuousScroll', val);
})

watch(overrideFont, () => {
  updateSetting('overrideFont', overrideFont.value);
})

watch(defaultCJKFont, () => {
  updateSetting('defaultCJKFont', defaultCJKFont.value)
})

watch(setTwoColumn, () => {
  updateSetting('maxColumnCount', maxColumnCount.value)
})

</script>
