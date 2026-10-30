<template>
  <div class="agent-panel d-flex flex-column">
    <AgentHeader
      :chapter="chapter"
      :content-length="contentLength"
      :busy="busy"
      :can-clear="transcript.length > 0"
      @finalize="$emit('finalize')"
      @clear-chat="$emit('clearChat')"
    />

    <AgentContextMeter
      :context-tokens="contextTokens"
      :context-limit="contextLimit"
      :context-trimmed="contextTrimmed"
    />

    <div v-if="busy" class="agent-panel__status lg-card--inset">
      <v-progress-circular indeterminate size="13" width="2" color="primary" />
      <span class="agent-panel__status-text">{{ statusText || '正在处理…' }}</span>
    </div>

    <ChatTranscript
      :messages="transcript"
      :busy="busy"
      @undo-write="$emit('undoWrite', $event)"
      @confirm-plan="$emit('confirmPlan', $event)"
      @cancel-plan="$emit('cancelPlan')"
      @update-outline="handleUpdateOutline"
    />

    <AgentQuickActions
      :has-chapter="!!chapter"
      :busy="busy"
      :can-continue-prev="canContinuePrev"
      :length="settingStore.agentWriteLength"
      @quick-action="$emit('quickAction', $event)"
      @update-length="handleUpdateLength"
    />

    <ChatComposer
      :characters="novel.characters"
      :busy="busy"
      :disabled="inputDisabled"
      @send="$emit('send', $event)"
      @stop="$emit('stop')"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useAgentChatStore } from '@/store/agentChatStore';
import { useSettingStore } from '@/store/setting';
import type { AgentPlan, ChatQuickAction } from '@/types/agent';
import type { ChapterMeta, Novel } from '@/types/novel';

import AgentContextMeter from './agent/AgentContextMeter.vue';
import AgentHeader from './agent/AgentHeader.vue';
import AgentQuickActions from './agent/AgentQuickActions.vue';
import ChatComposer from './agent/ChatComposer.vue';
import ChatTranscript from './agent/ChatTranscript.vue';

const props = defineProps<{
  novel: Novel;
  chapter: ChapterMeta | null;
  /** 当前章正文长度（「续写上一章」护栏：需基本为空） */
  contentLength: number;
}>();

defineEmits<{
  send: [text: string];
  quickAction: [action: ChatQuickAction];
  stop: [];
  confirmPlan: [plan: AgentPlan];
  cancelPlan: [];
  undoWrite: [msgId: string];
  clearChat: [];
  finalize: [];
}>();

const chatStore = useAgentChatStore();
const settingStore = useSettingStore();
const { transcript, busy, statusText, contextTokens, contextLimit, contextTrimmed } =
  storeToRefs(chatStore);

const inputDisabled = computed(() => busy.value || !props.chapter);

const canContinuePrev = computed<boolean | null>(() => {
  if (!props.chapter) return null;
  const previous = props.novel.chapters.find((c) => c.order < props.chapter!.order);
  if (!previous) return false;
  return props.contentLength <= 50;
});

function handleUpdateOutline(msgId: string, outline: string) {
  chatStore.updatePlan(msgId, { outlineDraft: outline });
}

function handleUpdateLength(length: number) {
  settingStore.agentWriteLength = length as 500 | 1000 | 1500 | 2000;
}
</script>

<style src="./agent/agent-chat.css"></style>
