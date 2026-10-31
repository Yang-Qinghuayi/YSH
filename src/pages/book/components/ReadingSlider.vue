<template>
  <div class="reading-slider" :class="{ 'is-disabled': disabled }">
    <div class="reading-slider__heading">
      <label :for="id" class="reading-slider__label">
        <v-icon v-if="icon" :icon="icon" size="18" aria-hidden="true" />
        {{ label }}
      </label>
      <output :for="id" class="reading-slider__value">
        {{ modelValue }}<span v-if="unit" class="reading-slider__unit">{{ unit }}</span>
      </output>
    </div>

    <!-- 保留原生 range 的键盘、触控和辅助技术支持；整条填充轨道取代细线与圆形滑块。 -->
    <div class="reading-slider__control" :style="{ '--slider-progress': `${progress}%` }">
      <div class="reading-slider__fill" aria-hidden="true"></div>
      <div class="reading-slider__ends" aria-hidden="true">
        <span>{{ minLabel }}</span>
        <span>{{ maxLabel }}</span>
      </div>
      <div class="reading-slider__grip" aria-hidden="true"></div>
      <input
        :id="id"
        class="reading-slider__input"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        :aria-valuetext="`${modelValue}${unit ? ` ${unit}` : ''}`"
        @input="onInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    icon?: string;
    minLabel?: string;
    maxLabel?: string;
    disabled?: boolean;
  }>(),
  { step: 1, unit: '', icon: '', minLabel: '', maxLabel: '', disabled: false }
);
const modelValue = defineModel<number>({ required: true });
const id = useId();
const progress = computed(() => {
  const range = props.max - props.min;
  return range > 0 ? Math.min(100, Math.max(0, ((modelValue.value - props.min) / range) * 100)) : 0;
});

function onInput(event: Event) {
  modelValue.value = (event.target as HTMLInputElement).valueAsNumber;
}
</script>

<style scoped>
.reading-slider {
  min-width: 0;
}

.reading-slider__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 7px;
  line-height: 1.4;
}

.reading-slider__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-on-surface);
  font-size: 14px;
  font-weight: 600;
}

.reading-slider__label .v-icon {
  color: var(--color-on-surface-variant);
}

.reading-slider__value {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.reading-slider__unit {
  font-size: 11px;
  font-weight: 400;
}

.reading-slider__control {
  position: relative;
  height: 46px;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid color-mix(in srgb, var(--color-outline) 18%, transparent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--color-surface-variant) 75%, var(--color-surface));
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.reading-slider__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--slider-progress);
  border-radius: 14px 5px 5px 14px;
  background: color-mix(in srgb, var(--color-primary) 23%, var(--color-surface));
}

.reading-slider__ends {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 17px;
  color: var(--color-on-surface-variant);
  font-size: 12px;
  user-select: none;
}

.reading-slider__grip {
  position: absolute;
  top: 50%;
  left: clamp(6px, var(--slider-progress), calc(100% - 6px));
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: var(--color-primary);
  transform: translate(-50%, -50%);
}

.reading-slider__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  opacity: 0;
  cursor: ew-resize;
  touch-action: pan-y;
}

/* 原生轨道也铺满 46px 高度，点击 / 触摸上下边缘同样可以调节。 */
.reading-slider__input::-webkit-slider-runnable-track {
  height: 100%;
}

.reading-slider__input::-webkit-slider-thumb {
  width: 12px;
  height: 46px;
  appearance: none;
}

.reading-slider__input::-moz-range-track {
  height: 100%;
}

.reading-slider__input::-moz-range-thumb {
  width: 12px;
  height: 46px;
  border: 0;
}

.reading-slider__control:has(input:focus-visible) {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.reading-slider:not(.is-disabled) .reading-slider__control:active {
  transform: scaleY(1.04);
}

.reading-slider.is-disabled {
  opacity: 0.45;
}

.reading-slider__input:disabled {
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .reading-slider__control {
    transition: none;
  }
}

@media (forced-colors: active) {
  .reading-slider__input {
    appearance: auto;
    opacity: 1;
  }

  .reading-slider__input::-webkit-slider-runnable-track {
    all: revert;
  }

  .reading-slider__input::-webkit-slider-thumb {
    all: revert;
  }

  .reading-slider__input::-moz-range-track {
    all: revert;
  }

  .reading-slider__input::-moz-range-thumb {
    all: revert;
  }
}
</style>
