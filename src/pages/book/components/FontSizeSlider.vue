<template>
  <div class="w-full px-3">
    <div class="flex justify-between items-center mb-1">
      <span class="text-sm text-on-surface-variant">字号</span>
      <span class="text-sm text-on-surface-variant">{{ defaultFontSize }} px</span>
    </div>
    <v-slider
      v-model="defaultFontSize"
      :min="12"
      :max="40"
      :step="1"
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
const defaultFontSize = ref(DEFAULT_BOOK_FONT.defaultFontSize);

watchEffect(() => {
  if (viewSettings.value) {
    defaultFontSize.value = viewSettings.value.defaultFontSize ?? DEFAULT_BOOK_FONT.defaultFontSize;
  }
});

watch(defaultFontSize, () => {
  updateSetting('defaultFontSize', defaultFontSize.value);
});
</script>
