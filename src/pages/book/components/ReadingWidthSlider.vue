<template>
  <ReadingSlider
    v-model="contentWidth"
    label="正文宽度"
    :icon="mdiArrowExpandHorizontal"
    :min="MIN_CONTENT_WIDTH"
    :max="MAX_CONTENT_WIDTH"
    unit="%"
    min-label="窄"
    max-label="宽"
    :disabled="!viewSettings"
  />
</template>

<script setup lang="ts">
import { mdiArrowExpandHorizontal } from '@mdi/js';
import { computed } from 'vue';

import { useViewSettings } from '@/hooks/useViewSettings';
import { DEFAULT_CONTENT_WIDTH, MAX_CONTENT_WIDTH, MIN_CONTENT_WIDTH } from '@/utils/config';

import ReadingSlider from './ReadingSlider.vue';

const { viewSettings, updateSetting } = useViewSettings();
const contentWidth = computed({
  get: () => viewSettings.value?.contentWidth ?? DEFAULT_CONTENT_WIDTH,
  set: (value: number) => void updateSetting('contentWidth', value),
});
</script>
