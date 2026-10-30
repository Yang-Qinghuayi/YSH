<template>
  <div class="agent-panel__empty">
    <div class="empty-icon">
      <v-icon :icon="mdiRobotOutline" size="34" />
    </div>
    <div class="empty-title">AI 写作助手</div>
    <div class="empty-sub">
      写下本章概要，Agent 会先调研资料、给出规划，你确认后再动笔；也可以直接提问或让它续写。
    </div>
    <div class="empty-hints">
      <div class="empty-hint-item">
        <v-icon :icon="mdiNoteTextOutline" size="13" /> 输入概要 → 出规划 → 确认 → 写正文
      </div>
      <div class="empty-hint-item">
        <v-icon :icon="mdiRobotOutline" size="13" /> 多轮对话，随时修改规划
      </div>
      <div class="empty-hint-item">
        <v-icon :icon="mdiAt" size="13" /> @角色名 可强制指定出场的角色
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mdiAt, mdiNoteTextOutline, mdiRobotOutline } from '@mdi/js';
</script>
