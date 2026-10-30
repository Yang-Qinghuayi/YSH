<template>
  <div
    class="chat-plan lg-card--inset"
    :class="{
      'chat-plan--muted': message.status === 'superseded' || message.status === 'cancelled',
    }"
  >
    <div class="chat-plan__head">
      <v-icon :icon="mdiPencilOutline" size="15" />
      <span class="chat-plan__title">章节规划</span>
      <span v-if="message.status === 'superseded'" class="chat-plan__tag">已更新</span>
      <span v-else-if="message.status === 'cancelled'" class="chat-plan__tag chat-plan__tag--error">
        已取消
      </span>
      <span
        v-else-if="message.status === 'confirmed'"
        class="chat-plan__tag chat-plan__tag--success"
      >
        已确认
      </span>
      <v-spacer />
      <span v-if="message.status === 'pending'" class="chat-plan__pending">待确认</span>
    </div>

    <div class="chat-plan__block">
      <div class="lg-section-label mb-1">
        大纲{{ message.status === 'pending' ? '（可编辑）' : '' }}
      </div>
      <v-textarea
        v-if="message.status === 'pending'"
        :model-value="message.outlineDraft"
        variant="outlined"
        density="compact"
        rows="4"
        auto-grow
        hide-details
        rounded="lg"
        @update:model-value="(value: string) => $emit('updateOutline', message.id, value)"
      />
      <div v-else class="chat-plan__outline">{{ message.outlineDraft }}</div>
    </div>

    <div v-if="message.plan.approach" class="chat-plan__block">
      <div class="lg-section-label mb-1">写法思路</div>
      <div class="chat-plan__approach">{{ message.plan.approach }}</div>
    </div>

    <div v-if="message.plan.selectedCharacters?.length" class="chat-plan__block">
      <div class="lg-section-label mb-1">选用角色</div>
      <div class="chip-wrap">
        <v-chip
          v-for="character in message.plan.selectedCharacters"
          :key="character.id"
          size="x-small"
          color="primary"
          variant="tonal"
        >
          {{ character.name }}
        </v-chip>
      </div>
    </div>

    <div v-if="message.plan.referencedLoreEntries?.length" class="chat-plan__block">
      <div class="lg-section-label mb-1">引用设定</div>
      <div class="chip-wrap">
        <v-chip
          v-for="entry in message.plan.referencedLoreEntries"
          :key="entry.id"
          size="x-small"
          color="info"
          variant="tonal"
        >
          {{ entry.name }}
        </v-chip>
      </div>
    </div>

    <div v-if="message.status === 'pending'" class="chat-plan__actions">
      <button class="lg-pill chat-plan__confirm" @click="onConfirm">
        <v-icon :icon="mdiAutoFix" size="14" /> 确认生成
      </button>
      <button class="lg-pill chat-plan__cancel" @click="$emit('cancelPlan')">取消</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mdiAutoFix, mdiPencilOutline } from '@mdi/js';

import type { AgentPlan } from '@/types/agent';
import type { ChatMsg } from '@/types/agentChat';

const props = defineProps<{
  message: Extract<ChatMsg, { kind: 'plan' }>;
}>();

const emit = defineEmits<{
  confirmPlan: [plan: AgentPlan];
  cancelPlan: [];
  updateOutline: [msgId: string, outline: string];
}>();

function onConfirm() {
  emit('confirmPlan', { ...props.message.plan, outline: props.message.outlineDraft });
}
</script>
