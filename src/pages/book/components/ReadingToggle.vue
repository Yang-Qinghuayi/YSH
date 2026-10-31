<template>
  <label class="reading-toggle" :class="{ 'is-disabled': disabled }" :for="id">
    <span class="reading-toggle__copy">
      <span class="reading-toggle__label">{{ label }}</span>
      <span v-if="description" :id="`${id}-description`" class="reading-toggle__description">
        {{ description }}
      </span>
    </span>
    <span class="reading-toggle__switch">
      <input
        :id="id"
        v-model="modelValue"
        type="checkbox"
        role="switch"
        :aria-label="label"
        :aria-describedby="description ? `${id}-description` : undefined"
        :disabled="disabled"
      />
      <span class="reading-toggle__track" aria-hidden="true"></span>
    </span>
  </label>
</template>

<script setup lang="ts">
import { useId } from 'vue';

withDefaults(defineProps<{ label: string; description?: string; disabled?: boolean }>(), {
  description: '',
  disabled: false,
});
const modelValue = defineModel<boolean>({ required: true });
const id = useId();
</script>

<style scoped>
.reading-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 60px;
  padding: 10px 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.reading-toggle__copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.reading-toggle__label {
  color: var(--color-on-surface);
  font-size: 14px;
  line-height: 1.4;
}

.reading-toggle__description {
  color: var(--color-on-surface-variant);
  font-size: 11px;
  line-height: 1.5;
}

.reading-toggle__switch {
  position: relative;
  flex: 0 0 44px;
  height: 28px;
}

.reading-toggle__switch input {
  position: absolute;
  inset: -8px 0;
  width: 100%;
  height: 44px;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.reading-toggle__track {
  display: block;
  width: 100%;
  height: 100%;
  border: 1px solid color-mix(in srgb, var(--color-outline) 38%, transparent);
  border-radius: 999px;
  background: var(--color-surface-variant);
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
  pointer-events: none;
}

.reading-toggle__track::after {
  position: absolute;
  top: 5px;
  left: 5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-on-surface-variant);
  content: '';
  transition:
    transform 0.18s ease,
    background 0.18s ease;
}

input:checked + .reading-toggle__track {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

input:checked + .reading-toggle__track::after {
  background: var(--color-on-primary);
  transform: translateX(16px);
}

input:focus-visible + .reading-toggle__track {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.reading-toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .reading-toggle__track,
  .reading-toggle__track::after {
    transition: none;
  }
}

@media (forced-colors: active) {
  .reading-toggle__switch input {
    opacity: 1;
  }

  .reading-toggle__track {
    visibility: hidden;
  }
}
</style>
