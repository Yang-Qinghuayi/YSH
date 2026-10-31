<template>
  <ReadingSlider
    v-model="fontSize"
    label="字号"
    :icon="mdiFormatSize"
    :min="12"
    :max="40"
    unit="px"
    min-label="小"
    max-label="大"
    :disabled="!viewSettings"
  />
</template>

<script setup lang="ts">
import { mdiFormatSize } from '@mdi/js';
import { computed } from 'vue';

import { useViewSettings } from '@/hooks/useViewSettings';
import { DEFAULT_BOOK_FONT } from '@/services/constants';

import ReadingSlider from './ReadingSlider.vue';

const { viewSettings, updateSetting } = useViewSettings();
const fontSize = computed({
  get: () => viewSettings.value?.defaultFontSize ?? DEFAULT_BOOK_FONT.defaultFontSize,
  set: (value: number) => void updateSetting('defaultFontSize', value),
});
</script>
