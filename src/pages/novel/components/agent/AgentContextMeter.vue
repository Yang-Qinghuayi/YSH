<template>
  <div class="context-meter" :class="{ 'context-meter--warning': contextPercent >= 75 }">
    <div class="context-meter__top">
      <span><v-icon :icon="mdiGauge" size="14" /> 上下文</span>
      <strong>{{ contextPercent }}%</strong>
    </div>
    <div class="context-meter__track">
      <div class="context-meter__fill" :style="{ width: `${contextPercent}%` }" />
    </div>
    <div class="context-meter__bottom">
      <span>{{ formatTokens(contextTokens) }} / {{ formatTokens(contextLimit) }} tokens</span>
      <span v-if="contextTrimmed">已自动压缩 {{ contextTrimmed }} 条</span>
      <span v-else>接近上限时自动压缩</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mdiGauge } from '@mdi/js';
import { computed } from 'vue';

const props = defineProps<{
  contextTokens: number;
  contextLimit: number;
  contextTrimmed: number;
}>();

const contextPercent = computed(() =>
  Math.min(100, Math.round((props.contextTokens / props.contextLimit) * 100))
);

function formatTokens(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
</script>
