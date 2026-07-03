<template>
  <section class="d-flex justify-center">
    <div style="max-width: 960px" class="flex mt-6 flex-column gap-4 flex-fill">
      <div>
        <div class="font-bold">听我说</div>
        <div class="py-8 px-2">&ldquo;口痰可以用作胶水。&rdquo;</div>
      </div>

      <app-settings-theme />

      <!-- 字体 -->
      <div>
        <div class="font-bold mb-3">字体</div>
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


      <!-- <app-settings-other /> -->
      <!-- <app-settings-reset /> -->
    </div>
  </section>
</template>

<script setup lang="ts">
import AppSettingsTheme from "./components/Theme.vue";
import { useSettingStore } from "@/store/setting";
import { UI_FONT_OPTIONS } from "@/hooks/useMaterialYouTheme";

const settingStore = useSettingStore();
const fontOptions = UI_FONT_OPTIONS;

// Vuetify 4 的 #item 槽的 item 就是原始数据对象，直接用 item.key 反查 CSS
function getFontCss(key: string) {
  return fontOptions.find((f) => f.key === key)?.css ?? "";
}

// #selection 槽同理，直接从 store 当前值反查
const selectedFontCss = computed(() => getFontCss(settingStore.uiFont));
</script>
