<template>
  <v-dialog v-model="showMenu" persistent>
    <v-card :class="[smAndUp ? 'w-[560px]' : 'w-full']" color="surface" class="flex items-center flex-col mx-auto p-10">
      <v-card-title class="text-center">菜单</v-card-title>
      <FontSizeSlider />
      <FontWeightSlider class="mt-4" />

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-4 py-2 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
          <p class="text-gray-700 ">双列显示</p>
          <v-switch v-model="setTwoColumn" hide-details class="" density="compact" color="primary" inset></v-switch>
        </div>
      </div>

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-4 py-2 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
          <p class="text-gray-700 ">覆盖字体</p>
          <v-switch v-model="overrideFont" hide-details class="" density="compact" color="primary" inset></v-switch>
        </div>
      </div>

      <div class="w-full mt-4">
        <div
          class="flex justify-between items-center px-4 py-2 bg-gray-300/30 backdrop-blur-3xl shadow-md rounded-lg border border-gray-300">
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
  MONOSPACE_FONTS,
  SANS_SERIF_FONTS,
  SERIF_FONTS,
  WINDOWS_FONTS,
} from '@/services/constants';
import { getSysFontsList } from '@/utils/bridge';
import FontSizeSlider from "./FontSizeSlider.vue"
import FontWeightSlider from "./FontWeightSlider.vue"
import { isTauriAppPlatform } from '@/services/environment';
import { useDisplay } from "vuetify";
const { lgAndUp, smAndUp } = useDisplay();

import { getOSPlatform, isCJKEnv } from '@/utils/misc';
import { useBookIdStore } from '@/store/bookIdStore';
const { bookId } = storeToRefs(useBookIdStore())
import { saveViewSettings } from '@/utils/viewSettingsHelper';
import { useReaderStore } from '@/store/readerStore';
import { storeToRefs } from "pinia";
import { max } from 'lodash-es';
const readerStore = useReaderStore()
const { getProgress, getViewState, initViewState, getViewSettings, hoveredBookKey, switchShowMenu } = readerStore
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
const viewSettings = getViewSettings(bookId.value);
const overrideFont = ref(false)

const sysFonts = ref<string[]>(defaultSysFonts)
const defaultCJKFont = ref('')

const setTwoColumn = ref(false)
const maxColumnCount = computed(() => setTwoColumn.value ? 2 : 1)

const genCJKFontsList = (sysFonts: string[]) => {
  return Array.from(new Set([...sysFonts, ...CJK_SERIF_FONTS, ...CJK_SANS_SERIF_FONTS]))
    .filter((font) => CJK_FONTS_PATTENS.test(font) || CJK_NAMES_PATTENS.test(font))
    .filter((font) => !CJK_EXCLUDE_PATTENS.test(font))
    .sort((a, b) => a.localeCompare(b));
};
const CJKFonts = ref<string[]>(genCJKFontsList(sysFonts.value))

const isSymbolicFontName = (font: string) =>
  /emoji|icons|symbol|dingbats|ornaments|webdings|wingdings|miuiex/i.test(font);

const init = async () => {
  await initLibrary()
  overrideFont.value = viewSettings?.overrideFont || false
  defaultCJKFont.value = viewSettings?.defaultCJKFont!
  setTwoColumn.value = viewSettings?.maxColumnCount! === 2 ? true : false

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
}
init()


watch(overrideFont, () => {
  saveViewSettings(bookId.value, 'overrideFont', overrideFont.value);
})

watch(defaultCJKFont, () => {
  saveViewSettings(bookId.value, 'defaultCJKFont', defaultCJKFont.value)
})

watch(setTwoColumn, () => {
  saveViewSettings(bookId.value, 'maxColumnCount', maxColumnCount.value)
})

</script>
