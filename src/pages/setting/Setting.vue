<template>
  <section class="d-flex justify-center">
    <div style="max-width: 960px" class="flex mt-6 flex-column gap-4 flex-fill">
      <div>
        <div class="font-bold">听我说</div>
        <div class="py-8 px-2">&ldquo;口痰可以用作胶水。&rdquo;</div>
      </div>

      <app-settings-theme />

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

const settingStore = useSettingStore();
const agentStore = useAgentStore();
const showApiKey = ref(false);

const modelOptions = [
  { title: "deepseek-chat（通用，速度快）", value: "deepseek-chat" },
  { title: "deepseek-reasoner（深度推理，更慢）", value: "deepseek-reasoner" },
];
</script>
