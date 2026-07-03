<template>
  <v-dialog :model-value="agentStore.planDialogVisible" max-width="620" scrollable persistent>
    <v-card rounded="xl" class="lg-dialog">
      <v-card-title class="d-flex align-center gap-3 pt-5 px-5">
        <span class="title-badge">
          <v-icon :icon="mdiClipboardCheckOutline" size="18" />
        </span>
        <span class="text-h6">章节规划确认</span>
      </v-card-title>

      <v-card-text class="pa-5">
        <div v-if="!agentStore.currentPlan" class="text-body-2 text-medium-emphasis">
          正在生成规划…
        </div>
        <div v-else class="d-flex flex-column gap-4">
          <!-- 大纲（可编辑） -->
          <div class="plan-block lg-card--inset pa-3">
            <div class="lg-section-label mb-2">章节大纲（可编辑）</div>
            <v-textarea
              v-model="editableOutline"
              variant="outlined"
              density="compact"
              rows="6"
              auto-grow
              hide-details
              rounded="xl"
            />
          </div>

          <!-- 写法思路 -->
          <div v-if="agentStore.currentPlan.approach" class="plan-block lg-card--inset pa-3">
            <div class="lg-section-label mb-1">写法思路</div>
            <div class="text-body-2 text-medium-emphasis">{{ agentStore.currentPlan.approach }}</div>
          </div>

          <!-- 所选角色 -->
          <div v-if="agentStore.currentPlan.selectedSkills?.length" class="plan-block lg-card--inset pa-3">
            <div class="lg-section-label mb-2">所选角色</div>
            <div class="d-flex flex-wrap gap-2">
              <v-chip
                v-for="s in agentStore.currentPlan.selectedSkills"
                :key="s.id"
                size="small"
                color="primary"
                variant="tonal"
              >
                {{ s.name }}
                <span class="text-caption text-medium-emphasis ml-1">— {{ s.reason }}</span>
              </v-chip>
            </div>
          </div>

          <!-- 引用 Lore -->
          <div v-if="agentStore.currentPlan.referencedLoreEntries?.length" class="plan-block lg-card--inset pa-3">
            <div class="lg-section-label mb-2">引用资料</div>
            <div class="d-flex flex-wrap gap-2">
              <v-chip
                v-for="e in agentStore.currentPlan.referencedLoreEntries"
                :key="e.id"
                size="small"
                variant="tonal"
              >
                {{ e.name }}
              </v-chip>
            </div>
          </div>

          <!-- 工具调用日志 -->
          <div v-if="agentStore.toolCallLog.length" class="plan-block lg-card--inset pa-3">
            <div class="lg-section-label mb-2">调研过程</div>
            <div class="tool-log">
              <div v-for="(log, i) in agentStore.toolCallLog" :key="i" class="tool-log-item">
                <v-icon
                  :icon="log.status === 'done' ? mdiCheck : mdiLoading"
                  size="12"
                  :color="log.status === 'done' ? 'success' : 'primary'"
                />
                <span class="text-caption">{{ log.tool }}</span>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" rounded="pill" @click="$emit('cancel')">取消</v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          rounded="pill"
          :disabled="!agentStore.currentPlan"
          @click="onConfirm"
        >
          确认生成
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiClipboardCheckOutline, mdiCheck, mdiLoading } from '@mdi/js'
import { useAgentStore } from '@/store/agentStore'
import type { AgentPlan } from '@/services/agentService'

const agentStore = useAgentStore()

const emit = defineEmits<{
  confirm: [plan: AgentPlan]
  cancel: []
}>()

const editableOutline = ref('')

// plan 变化时同步到可编辑文本
watch(
  () => agentStore.currentPlan,
  (p) => {
    if (p) editableOutline.value = p.outline
  },
  { immediate: true },
)

function onConfirm() {
  if (!agentStore.currentPlan) return
  emit('confirm', { ...agentStore.currentPlan, outline: editableOutline.value })
}
</script>

<style scoped>
.lg-dialog {
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
}
.title-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
.plan-block :deep(.v-field--variant-outlined) {
  border-radius: 14px;
}
.tool-log {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.tool-log-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
