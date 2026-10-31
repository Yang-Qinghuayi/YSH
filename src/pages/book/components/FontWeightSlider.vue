<template>
  <ReadingSlider
    v-model="fontWeight"
    label="字重"
    :icon="mdiFormatBold"
    :min="200"
    :max="900"
    :step="100"
    min-label="细"
    max-label="粗"
    :disabled="!viewSettings"
  />
</template>

<script setup lang="ts">
import { mdiFormatBold } from '@mdi/js';
import { computed } from 'vue';

import { useViewSettings } from '@/hooks/useViewSettings';
import { DEFAULT_BOOK_FONT } from '@/services/constants';

import ReadingSlider from './ReadingSlider.vue';

const { viewSettings, updateSetting } = useViewSettings();
const fontWeight = computed({
  get: () => viewSettings.value?.fontWeight ?? DEFAULT_BOOK_FONT.fontWeight,
  set: (value: number) => void updateSetting('fontWeight', value),
});
</script>
