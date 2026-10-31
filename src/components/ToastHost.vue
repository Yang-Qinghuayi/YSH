<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <transition-group name="toast">
      <div
        v-for="item in items"
        :key="item.id"
        class="toast-item"
        :class="`toast-item--${item.kind}`"
        role="status"
        @click="dismiss(item.id)"
      >
        <svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path :d="iconOf(item.kind)" fill="currentColor" />
        </svg>
        <span class="toast-text">{{ item.text }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiInformationOutline } from '@mdi/js';

import { type ToastKind, useToastQueue } from '@/plugins/toast';

const { items, dismiss } = useToastQueue();

const ICONS: Record<ToastKind, string> = {
  success: mdiCheckCircleOutline,
  error: mdiAlertCircleOutline,
  info: mdiInformationOutline,
};

const iconOf = (kind: ToastKind) => ICONS[kind];
</script>

<style scoped>
/* 刻意不依赖任何 Vuetify 组件：Toast 是全局常驻组件，
   用 v-snackbar 会把 snackbar/dialog/overlay 等一整套样式与 JS 拉进首屏。 */
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(90vw, 520px);
  padding: 10px 16px;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--color-on-primary);
  background: var(--color-inverse-surface, rgb(50 50 50));
  pointer-events: auto;
  cursor: pointer;
}

.toast-item--success {
  background: var(--color-success, rgb(47 107 79));
}

.toast-item--error {
  background: var(--color-error, rgb(179 38 30));
}

.toast-icon {
  flex: 0 0 auto;
  opacity: 0.9;
}

.toast-text {
  white-space: pre-line;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
