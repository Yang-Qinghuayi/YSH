<template>
  <section class="d-flex justify-center">
    <div style="max-width: 960px" class="d-flex flex-column gap-4 flex-fill">
      <div>
        <div class="font-bold">致谢🎉</div>

        <div class="py-10 px-6">
          <div>
            网站的图标来自
            <a href="https://v.douyin.com/ik4B2tcg/" target="_blank">
              <v-btn
                icon
                color="primary"
                size=""
                variant="tonal"
                class="px-3 rounded-full"
                >小成成
              </v-btn>
            </a>
            这个链接会跳转到他的抖音
          </div>

          <div class="mt-5">
            使用了开源字体
            <a href="https://github.com/lxgw/LxgwWenKai" target="_blank">
              <v-btn
                icon
                color="primary"
                size=""
                variant="tonal"
                class="px-3 rounded-full"
                >霞鹜文楷
              </v-btn>
            </a>
            它真的非常美丽以至于我正在尝试将所有可见的文字都替换成它
          </div>

          <div class="mt-5">
            感谢
            <a
              href="https://chinese-font.netlify.app/fonts/lxgwwenkai/lxgwwenkai-light/"
              target="_blank"
            >
              <v-btn
                icon
                color="primary"
                size=""
                variant="tonal"
                class="px-3 rounded-full"
                >中文网字计划
              </v-btn>
            </a>
            使我不必在网站加载时花费几乎两分钟来下载字体文件
          </div>
        </div>
      </div>

      <app-settings-theme />
      <app-settings-other />
      <!-- <app-settings-unlock /> -->
      <app-settings-reset />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppSettingsOther from "./components/Other.vue";
import AppSettingsReset from "./components/Reset.vue";
import AppSettingsTheme from "./components/Theme.vue";
import AppSettingsTips from "./components/Tips.vue";
import AppSettingsUnlock from "./components/Unlock.vue";
const { t } = useI18n();

import { storeToRefs } from "pinia";
import { APPEARANCE, NavPosition, useSettingStore } from "@/store/setting";
const setting = useSettingStore();
const { miniPlayer, navPosition } = storeToRefs(setting);
import { mdiPageLayoutSidebarLeft, mdiTestTube } from "@mdi/js";
function togglePosition() {
  if (navPosition.value === NavPosition.left) {
    navPosition.value = NavPosition.top;
  } else {
    navPosition.value = NavPosition.left;
  }
}
</script>
