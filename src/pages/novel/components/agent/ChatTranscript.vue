<template>
  <div ref="bodyRef" class="agent-panel__body flex-1-1 lg-scroll" @scroll="onScroll">
    <AgentEmptyState v-if="!messages.length" />

    <template v-for="message in messages" :key="message.id">
      <div v-if="message.kind === 'user'" class="chat-user">
        <div class="chat-user__bubble">{{ message.text }}</div>
      </div>

      <div v-else-if="message.kind === 'assistant'" class="chat-assistant">
        <span class="chat-assistant__avatar">
          <v-icon :icon="mdiRobotOutline" size="14" />
        </span>
        <div class="chat-assistant__bubble">
          <span class="chat-assistant__text">
            {{ message.text }}<span v-if="message.streaming" class="chat-cursor">▍</span>
          </span>
        </div>
      </div>

      <ChatToolCard
        v-else-if="message.kind === 'tool'"
        :message="message"
        :busy="busy"
        @undo-write="$emit('undoWrite', $event)"
      />

      <ChatPlanCard
        v-else-if="message.kind === 'plan'"
        :message="message"
        @confirm-plan="$emit('confirmPlan', $event)"
        @cancel-plan="$emit('cancelPlan')"
        @update-outline="(id, outline) => $emit('updateOutline', id, outline)"
      />

      <div v-else class="chat-system">{{ message.text }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { mdiRobotOutline } from '@mdi/js';
import { toRef } from 'vue';

import type { AgentPlan } from '@/types/agent';
import type { ChatMsg } from '@/types/agentChat';

import AgentEmptyState from './AgentEmptyState.vue';
import ChatPlanCard from './ChatPlanCard.vue';
import ChatToolCard from './ChatToolCard.vue';
import { useChatAutoScroll } from './useChatAutoScroll';

const props = defineProps<{
  messages: ChatMsg[];
  busy: boolean;
}>();

defineEmits<{
  undoWrite: [msgId: string];
  confirmPlan: [plan: AgentPlan];
  cancelPlan: [];
  updateOutline: [msgId: string, outline: string];
}>();

const { bodyRef, onScroll } = useChatAutoScroll(toRef(props, 'messages'));
</script>
