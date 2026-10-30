<template>
  <header class="agent-panel__head">
    <span class="title-badge">
      <v-icon :icon="mdiRobotOutline" size="18" />
    </span>
    <div class="agent-panel__heading">
      <span class="agent-panel__title">Agent</span>
      <v-chip
        v-if="chapter"
        size="x-small"
        variant="tonal"
        color="primary"
        class="agent-panel__target"
      >
        《{{ chapter.title }}》
      </v-chip>
    </div>
    <v-spacer />
    <button
      v-if="chapter"
      class="lg-pill finalize-btn"
      :class="{ 'finalize-btn--done': !!chapter.finalizedAt }"
      :disabled="busy || contentLength < 50"
      :title="finalizeTitle"
      @click="$emit('finalize')"
    >
      <v-icon :icon="mdiCheckDecagramOutline" size="14" />
      {{ chapter.finalizedAt ? '重新定稿' : '本章定稿' }}
    </button>
    <button
      class="lg-icon-btn agent-panel__clear"
      title="清空对话"
      :disabled="!canClear"
      @click="$emit('clearChat')"
    >
      <v-icon :icon="mdiDeleteOutline" size="16" />
    </button>
  </header>
</template>

<script setup lang="ts">
import { mdiCheckDecagramOutline, mdiDeleteOutline, mdiRobotOutline } from '@mdi/js';
import { computed } from 'vue';

import type { ChapterMeta } from '@/types/novel';

const props = defineProps<{
  chapter: ChapterMeta | null;
  contentLength: number;
  busy: boolean;
  canClear: boolean;
}>();

defineEmits<{
  finalize: [];
  clearChat: [];
}>();

const finalizeTitle = computed(() => {
  if (!props.chapter) return '';
  if (props.contentLength < 50) return '本章正文太短，写完后再定稿';
  const steps = '生成本章概要 → 改写角色短期记忆 → 判断是否改写长期记忆（Skill）→ 更新整体进度';
  return props.chapter.finalizedAt
    ? `本章已定稿过。重新定稿会先撤回上次定稿对记忆的改动，再重新执行：${steps}`
    : `写完本章后点击：${steps}`;
});
</script>
