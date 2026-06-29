<template>
  <div class="w-full px-3">
    <div class="flex justify-between items-center mb-1">
      <span class="text-sm text-on-surface-variant">字重</span>
      <span class="text-sm text-on-surface-variant">{{ fontWeight }}</span>
    </div>
    <v-slider
      v-model="fontWeight"
      :min="200"
      :max="900"
      :step="100"
      color="primary"
      track-color="outline"
      thumb-color="primary"
      hide-details
    />
  </div>
</template>

<script lang="ts" setup>
import { useViewSettings } from '@/hooks/useViewSettings';
import { DEFAULT_BOOK_FONT } from "@/services/constants";

const { viewSettings, updateSetting } = useViewSettings();
const fontWeight = ref(DEFAULT_BOOK_FONT.fontWeight);

watchEffect(() => {
  if (viewSettings.value) {
    fontWeight.value = viewSettings.value.fontWeight ?? DEFAULT_BOOK_FONT.fontWeight;
  }
});

watch(fontWeight, async () => {
  await updateSetting('fontWeight', fontWeight.value);
});
</script>
