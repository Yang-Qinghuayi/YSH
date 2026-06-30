<template>
  <div>
    <div class="font-bold mb-3">{{ t('common.theme_color') }}</div>

    <!-- 调色板选择 -->
    <div class="mt-3 d-flex align-center gap-2">
      <span class="text-caption text-medium-emphasis mr-1">{{ t('common.palette') }}</span>

      <!-- 预设色点 -->
      <div
        v-for="item in paletteItems"
        :key="item.id"
        class="palette-dot"
        :class="{ active: palette === item.id && !seedEnabled }"
        :style="{ background: paletteSeedMap[item.id] }"
        :title="item.label"
        @click="onPaletteChange(item.id)"
      />

      <!-- 分隔线 -->
      <div class="palette-divider" />

      <!-- 自定义种子色，用 wrapper 承载 active 状态和虚线样式 -->
      <div
        class="seed-dot"
        :class="{ active: seedEnabled }"
        :title="t('common.material_you_seed')"
      >
        <input
          type="color"
          :value="materialSeed"
          :aria-label="t('common.material_you_seed')"
          class="color-picker"
          @input="onSeedChange"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/store/setting'
import { palettes, paletteSeedMap } from '@/utils/paletteConfig'
import type { PaletteId } from '@/utils/paletteConfig'
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
/* ── 预设色点 ── */
.palette-dot {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.palette-dot:hover {
  transform: scale(1.15);
}

.palette-dot.active {
  box-shadow: 0 0 0 2.5px white, 0 0 0 4px currentColor;
  transform: scale(1.1);
}

/* ── 分隔线 ── */
.palette-divider {
  width: 1px;
  height: 1.1rem;
  background: currentColor;
  opacity: 0.2;
  flex-shrink: 0;
  margin: 0 2px;
}

/* ── 自定义种子色 ── */
.seed-dot {
  position: relative;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  /* 虚线描边：暗示"可自定义" */
  outline: 1.5px dashed rgba(128, 128, 128, 0.5);
  outline-offset: 2px;
}

.seed-dot:hover {
  transform: scale(1.15);
}

.seed-dot.active {
  outline: none;
  box-shadow: 0 0 0 2.5px white, 0 0 0 4px currentColor;
  transform: scale(1.1);
}

/* input[type=color] 填满 seed-dot */
.color-picker {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
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
</style>
