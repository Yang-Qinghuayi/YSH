<template>
  <div class="agent-panel__input">
    <MentionTextarea
      v-model="draft"
      :characters="characters"
      :placeholder="inputPlaceholder"
      :disabled="disabled"
      variant="plain"
      density="compact"
      rows="1"
      auto-grow
      max-rows="5"
      hide-details
      class="agent-panel__textarea"
      @menu-open="mentionMenuOpen = $event"
      @keydown.enter.exact="onEnterKey"
    />
    <button v-if="busy" class="send-btn send-btn--stop" title="停止" @click="$emit('stop')">
      <v-icon :icon="mdiStop" size="18" />
    </button>
    <button
      v-else
      class="send-btn"
      :disabled="disabled || !draft.trim()"
      title="发送"
      @click="sendDraft"
    >
      <v-icon :icon="mdiSend" size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { mdiSend, mdiStop } from '@mdi/js';
import { computed, ref } from 'vue';

import type { Character } from '@/types/novel';

import MentionTextarea from '../MentionTextarea.vue';

const props = defineProps<{
  characters: Character[];
  busy: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  send: [text: string];
  stop: [];
}>();

const draft = ref('');
const mentionMenuOpen = ref(false);

const inputPlaceholder = computed(() => {
  if (props.disabled) return props.busy ? 'Agent 工作中…' : '先打开一个章节';
  return '写本章概要，或向我提问…（@ 可指定角色）';
});

function sendDraft() {
  const text = draft.value.trim();
  if (!text || props.disabled) return;
  emit('send', text);
  draft.value = '';
}

function onEnterKey(event: KeyboardEvent) {
  if (mentionMenuOpen.value) return;
  event.preventDefault();
  sendDraft();
}
</script>
