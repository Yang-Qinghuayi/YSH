<template>
  <transition name="slide-up">
    <div v-if="visible" class="agent-status-pill">
      <v-progress-circular v-if="busy" indeterminate size="14" width="2" color="primary" />
      <v-icon v-else :icon="phaseIcon" size="14" :color="phaseColor" />
      <span class="agent-status-label">{{ label }}</span>
      <button v-if="busy" class="stop-btn" @click="$emit('stop')">停止</button>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { mdiCheckCircle, mdiCloseCircle, mdiClipboardCheckOutline } from '@mdi/js'
import { useAgentStore } from '@/store/agentStore'
import { storeToRefs } from 'pinia'

const agentStore = useAgentStore()
const { phase, statusText, toolCallLog } = storeToRefs(agentStore)

defineEmits<{ stop: [] }>()

const busy = computed(
  () => phase.value === 'planning' || phase.value === 'generating' || phase.value === 'finalizing',
)

const visible = computed(() => phase.value !== 'idle' && phase.value !== 'done')

const phaseIcon = computed(() => {
  if (phase.value === 'canceled') return mdiCloseCircle
  return mdiCheckCircle
})
const phaseColor = computed(() => (phase.value === 'canceled' ? 'error' : 'success'))

const label = computed(() => {
  if (statusText.value) return statusText.value
  const doneCount = toolCallLog.value.filter((l) => l.status === 'done').length
  if (phase.value === 'planning') return `规划中${doneCount ? `（已调 ${doneCount} 个工具）` : '…'}`
  if (phase.value === 'generating') return '正在生成正文…'
  if (phase.value === 'finalizing') return '正在更新故事状态…'
  return ''
})
</script>

<style scoped>
.agent-status-pill {
  position: absolute;
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 12.5px;
  z-index: 20;
}
.agent-status-label {
  white-space: nowrap;
}
.stop-btn {
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-error));
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
