<template>
  <v-dialog v-model="showEditorSettings" max-width="420">
    <div class="lg-card settings-dialog">
      <div class="settings-header">
        <span class="settings-title">编辑器设置</span>
        <button class="lg-icon-btn" @click="showEditorSettings = false">
          <v-icon :icon="mdiClose" size="16" />
        </button>
      </div>
      <div class="settings-body">
        <div class="setting-row">
          <div class="setting-label">
            <span class="setting-name">编辑区字号</span>
            <span class="setting-value">{{ settingStore.editorFontSize }}px</span>
          </div>
          <v-slider
            :model-value="settingStore.editorFontSize"
            :min="14"
            :max="24"
            :step="1"
            color="primary"
            track-size="3"
            thumb-size="16"
            hide-details
            @update:model-value="settingStore.editorFontSize = $event"
          />
          <div class="setting-range-labels"><span>14px</span><span>24px</span></div>
        </div>

        <div class="setting-divider" />
        <div class="setting-section-title">AI 写作（DeepSeek）</div>
        <v-text-field
          v-model="apiKey"
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
        <div class="key-row">
          <v-switch
            v-model="rememberApiKey"
            color="primary"
            density="compact"
            hide-details
            label="记住 API Key"
            class="key-switch"
          />
          <button v-if="apiKey" class="lg-pill mini-action key-clear" @click="clearApiKey">
            清除
          </button>
        </div>
        <div class="model-warn">
          关闭「记住」后 Key 只保存在本次会话，关闭窗口即失效。Key 存储在浏览器/本机存储中（Web
          部署请使用受限或限额 Key），除 api.deepseek.com 外不会发往任何服务。
        </div>
        <v-select
          v-model="settingStore.deepseekModel"
          label="模型"
          :items="modelOptions"
          variant="outlined"
          density="compact"
        />
        <div v-if="settingStore.deepseekModel === 'deepseek-reasoner'" class="model-warn">
          深度推理模型不支持工具调用，Agent
          将跳过资料检索循环，改为「直读上下文」模式规划（检索能力受限）。
        </div>
        <div class="settings-note">
          章节概要、角色记忆与整体进度不会在 AI 写完后自动更新；写完一章后，在 Agent
          面板点「本章定稿」统一更新。
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiClose, mdiEye, mdiEyeOff } from '@mdi/js';

import { useNovelUiContext } from '../composables/context';

const {
  showEditorSettings,
  apiKey,
  rememberApiKey,
  showApiKey,
  clearApiKey,
  settingStore,
  modelOptions,
} = useNovelUiContext();
</script>
