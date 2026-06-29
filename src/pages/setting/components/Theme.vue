<template>
  <div>
    <app-title path="common.theme_color" />

    <!-- 调色板选择 -->
    <v-list-item class="pa-0 mt-2">
      <v-list-item-title class="text-caption mr-4">{{ t('common.palette') }}</v-list-item-title>
      <template #append>
        <div class="d-flex align-center gap-3">
          <!-- 预设调色板下拉 -->
          <v-select
            v-model="palette"
            :items="paletteItems"
            item-title="label"
            item-value="id"
            density="compact"
            variant="outlined"
            hide-details
            rounded="pill"
            style="min-width: 130px"
            @update:model-value="onPaletteChange"
          />

          <!-- Material You 种子色选择器 -->
          <input
            type="color"
            :value="materialSeed"
            :title="t('common.material_you_seed')"
            :aria-label="t('common.material_you_seed')"
            class="color-picker"
            @input="onSeedChange"
          />
        </div>
      </template>
    </v-list-item>

    <!-- 当前调色板预览 -->
    <div class="mt-4 d-flex gap-2 flex-wrap">
      <div
        v-for="item in paletteItems"
        :key="item.id"
        class="palette-dot"
        :class="{ active: palette === item.id && !seedEnabled }"
        :style="{ background: paletteSeedMap[item.id] }"
        :title="item.label"
        @click="onPaletteChange(item.id)"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/store/setting'
import { palettes, paletteSeedMap } from '@/utils/paletteConfig'
import type { PaletteId } from '@/utils/paletteConfig'
import AppTitle from '@/components/Title.vue'
import { useI18n } from '@/utils/i18n'

const { t } = useI18n()
const settingStore = useSettingStore()
const { palette, materialSeed, seedEnabled } = storeToRefs(settingStore)

const paletteItems = palettes.map(p => ({ id: p.id, label: p.label }))

function onPaletteChange(newPalette: PaletteId | string) {
  palette.value = newPalette as PaletteId
  materialSeed.value = paletteSeedMap[newPalette as PaletteId]
  seedEnabled.value = false
}

function onSeedChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  materialSeed.value = value
  seedEnabled.value = true
}
</script>

<style scoped>
.color-picker {
  width: 2.25rem;
  height: 2.25rem;
  cursor: pointer;
  appearance: none;
  background: transparent;
  border: none;
  border-radius: 50%;
  padding: 0;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border-radius: 50%;
  border: none;
}

.color-picker::-moz-color-swatch {
  border-radius: 50%;
  border: none;
}

.palette-dot {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.palette-dot:hover {
  transform: scale(1.15);
}

.palette-dot.active {
  box-shadow: 0 0 0 2.5px white, 0 0 0 4px currentColor;
  transform: scale(1.1);
}
</style>
