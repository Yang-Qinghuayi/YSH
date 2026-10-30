<template>
  <section class="d-flex justify-center">
    <div style="max-width: 960px" class="d-flex mt-6 flex-column ga-4 flex-fill">
      <div>
        <div class="font-weight-bold">听我说</div>
        <div class="py-8 px-2">&ldquo;口痰可以用作胶水。&rdquo;</div>
      </div>

      <app-settings-theme />

      <!-- 字体 -->
      <div>
        <div class="font-weight-bold mb-3">字体</div>
        <v-select
          v-model="settingStore.uiFont"
          label="界面与编辑器字体"
          :items="fontOptions"
          item-title="label"
          item-value="key"
          variant="outlined"
          density="compact"
          color="primary"
          hide-details
        >
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps" :style="{ fontFamily: getFontCss(item.key) }" />
          </template>
          <template #selection="{ item }">
            <span :style="{ fontFamily: selectedFontCss }">{{ item.label }}</span>
          </template>
        </v-select>
      </div>

      <!-- 阅读交互 -->
      <div>
        <div class="font-weight-bold mb-3">阅读</div>
        <div
          class="d-flex justify-space-between align-center px-3 py-3 bg-surface-variant elevation-2 rounded-lg"
        >
          <div>
            <p class="mb-0">三击复制段落</p>
            <p class="text-body-small text-medium-emphasis mb-0">
              三击正文选中一段时，静默复制到剪贴板
            </p>
          </div>
          <v-switch
            v-model="settingStore.copyParagraphOnClick"
            hide-details
            density="compact"
            color="primary"
            inset
          ></v-switch>
        </div>
      </div>

      <!-- <app-settings-other /> -->
      <!-- <app-settings-reset /> -->
    </div>
  </section>
</template>

<script setup lang="ts">
import { UI_FONT_OPTIONS } from '@/hooks/useMaterialYouTheme';
import { useSettingStore } from '@/store/setting';

import AppSettingsTheme from './components/Theme.vue';

const settingStore = useSettingStore();
const fontOptions = UI_FONT_OPTIONS;

// Vuetify 4 的 #item 槽的 item 就是原始数据对象，直接用 item.key 反查 CSS
function getFontCss(key: string) {
  return fontOptions.find((f) => f.key === key)?.css ?? '';
}

// #selection 槽同理，直接从 store 当前值反查
const selectedFontCss = computed(() => getFontCss(settingStore.uiFont));
</script>
