<template>
  <div class="agent-panel__quick">
    <div class="length-row">
      <span class="length-label">目标字数</span>
      <v-select
        :model-value="length"
        :items="lengthItems"
        item-title="title"
        item-value="value"
        variant="outlined"
        density="compact"
        hide-details
        rounded="lg"
        class="length-select"
        @update:model-value="(value) => $emit('updateLength', Number(value))"
      />
    </div>
    <div class="chip-row">
      <button
        class="lg-pill quick-chip"
        :disabled="!hasChapter || busy || canContinuePrev === false"
        @click="$emit('quickAction', 'continue-prev')"
      >
        <v-icon :icon="mdiBookPlusOutline" size="14" /> 续写上一章
      </button>
      <button
        class="lg-pill quick-chip"
        :disabled="!hasChapter || busy"
        @click="$emit('quickAction', 'continue-current')"
      >
        <v-icon :icon="mdiPen" size="14" /> 续写本章
      </button>
    </div>
    <span v-if="hasChapter && canContinuePrev === false" class="length-hint">
      「续写上一章」需当前章基本为空
    </span>
  </div>
</template>

<script setup lang="ts">
import { mdiBookPlusOutline, mdiPen } from '@mdi/js';

import type { ChatQuickAction } from '@/types/agent';

defineProps<{
  hasChapter: boolean;
  busy: boolean;
  canContinuePrev: boolean | null;
  length: number;
}>();

defineEmits<{
  quickAction: [action: ChatQuickAction];
  updateLength: [length: number];
}>();

const lengthItems = [
  { title: '500 字', value: 500 },
  { title: '1000 字', value: 1000 },
  { title: '1500 字', value: 1500 },
  { title: '2000 字', value: 2000 },
];
</script>
