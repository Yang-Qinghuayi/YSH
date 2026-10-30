<template>
  <div class="chat-tool lg-card--inset">
    <div class="chat-tool__head" @click="expanded = !expanded">
      <v-progress-circular
        v-if="message.status === 'running'"
        indeterminate
        size="13"
        width="2"
        color="primary"
      />
      <v-icon
        v-else
        :icon="message.status === 'done' ? mdiCheckCircle : mdiAlertCircle"
        size="14"
        :color="message.status === 'done' ? 'success' : 'error'"
      />
      <span class="chat-tool__name">{{ toolLabel(message.tool) }}</span>
      <span class="chat-tool__summary text-truncate">{{ message.argsSummary }}</span>
      <v-icon
        v-if="message.resultText || message.write"
        :icon="expanded ? mdiChevronUp : mdiChevronDown"
        size="14"
        class="chat-tool__chevron"
      />
    </div>

    <div v-if="message.preview || message.write" class="chat-tool__write">
      <div class="chat-write-meta">
        <v-icon :icon="mdiPen" size="13" />
        <span v-if="message.write">
          已写入《{{ message.write.chapterTitle }}》 +{{ message.write.addedChars }} 字
          <template v-if="message.write.removedChars">
            （重写 -{{ message.write.removedChars }} 字）
          </template>
        </span>
        <span v-else>正在写入正文…</span>
        <button
          v-if="message.write?.snapshot"
          class="chat-write-undo"
          :disabled="busy"
          title="撤销这次写入"
          @click.stop="$emit('undoWrite', message.id)"
        >
          <v-icon :icon="mdiUndoVariant" size="12" /> 撤销
        </button>
      </div>
      <div class="chat-write-preview" :class="{ 'chat-write-preview--streaming': !message.write }">
        {{ message.preview }}
      </div>
    </div>

    <div v-if="expanded && message.resultText" class="chat-tool__detail">
      {{ message.resultText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  mdiAlertCircle,
  mdiCheckCircle,
  mdiChevronDown,
  mdiChevronUp,
  mdiPen,
  mdiUndoVariant,
} from '@mdi/js';
import { ref } from 'vue';

import type { ChatMsg } from '@/types/agentChat';

import { toolLabel } from './toolLabels';

defineProps<{
  message: Extract<ChatMsg, { kind: 'tool' }>;
  busy: boolean;
}>();

defineEmits<{
  undoWrite: [msgId: string];
}>();

const expanded = ref(false);
</script>
