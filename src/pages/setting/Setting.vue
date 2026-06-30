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
            <v-list-item v-bind="itemProps" :style="{ fontFamily: getFontCss(item.value) }" />
          </template>
          <template #selection="{ item }">
            <span :style="{ fontFamily: selectedFontCss }">{{ item.title }}</span>
          </template>
        </v-select>
      </div>

      <!-- AI 写作设置 -->
      <div>
        <div class="font-bold mb-3">AI 写作（DeepSeek）</div>
        <div class="d-flex flex-column gap-3">
          <v-text-field
            v-model="settingStore.deepseekApiKey"
            label="DeepSeek API Key"
            placeholder="sk-..."
            variant="outlined"
            density="compact"
            :type="showApiKey ? 'text' : 'password'"
            :append-inner-icon="showApiKey ? mdiEyeOff : mdiEye"
            hint="API Key is required for AI writing"
            persistent-hint
            @click:append-inner="showApiKey = !showApiKey"
          />
          <v-select
            v-model="settingStore.deepseekModel"
            label="模型"
            :items="modelOptions"
            variant="outlined"
            density="compact"
          />
          <v-switch
            v-model="agentStore.autoUpdateStoryState"
            color="primary"
            density="compact"
            hide-details
            label="生成后自动更新角色状态"
            hint="关闭后，Agent 生成正文不再自动增量更新角色动态状态（心情/位置/伤势/关系等）"
            persistent-hint
          />
        </div>
      </div>

      <!-- <app-settings-other /> -->
      <!-- <app-settings-reset /> -->
    </div>
  </section>
</template>

<script setup lang="ts">
import { mdiEye, mdiEyeOff } from "@mdi/js";
import AppSettingsTheme from "./components/Theme.vue";
import { useSettingStore } from "@/store/setting";
import { useAgentStore } from "@/store/agentStore";
import { UI_FONT_OPTIONS } from "@/hooks/useMaterialYouTheme";

const settingStore = useSettingStore();
const agentStore = useAgentStore();
const showApiKey = ref(false);
const fontOptions = UI_FONT_OPTIONS;

// Vuetify 4 的 #item 槽不暴露 item.raw，用 item.value（即 key）反查 CSS
function getFontCss(key: string) {
  return fontOptions.find((f) => f.key === key)?.css ?? "";
}

// #selection 槽同理，直接从 store 当前值反查
const selectedFontCss = computed(() => getFontCss(settingStore.uiFont));

const modelOptions = [
  { title: "deepseek-chat（通用，速度快）", value: "deepseek-chat" },
  { title: "deepseek-reasoner（深度推理，更慢）", value: "deepseek-reasoner" },
];
</script>
