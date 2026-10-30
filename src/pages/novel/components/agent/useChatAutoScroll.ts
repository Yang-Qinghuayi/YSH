/**
 * useChatAutoScroll.ts
 * 聊天转录区的吸底滚动：用户上滑时暂停自动滚动，回到底部后恢复。
 */

import { computed, nextTick, type Ref, ref, watch } from 'vue';

import type { ChatMsg } from '@/types/agentChat';

export function useChatAutoScroll(messages: Ref<ChatMsg[]>) {
  const bodyRef = ref<HTMLElement | null>(null);
  const stickToBottom = ref(true);

  function onScroll() {
    const element = bodyRef.value;
    if (!element) return;
    stickToBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  function scrollToBottom() {
    void nextTick(() => {
      const element = bodyRef.value;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  const lastMessageLength = computed(() => {
    const message = messages.value[messages.value.length - 1];
    if (!message) return 0;
    if (message.kind === 'assistant') return message.text.length;
    if (message.kind === 'tool') {
      return (message.preview?.length ?? 0) + (message.resultText?.length ?? 0);
    }
    return 0;
  });

  watch([() => messages.value.length, lastMessageLength], () => {
    if (stickToBottom.value) scrollToBottom();
  });

  return { bodyRef, onScroll };
}
