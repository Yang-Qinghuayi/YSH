<template>
  <v-dialog :model-value="agentStore.planDialogVisible" max-width="620" scrollable persistent>
    <v-card>
      <v-card-title class="d-flex align-center gap-2 pt-4">
        <v-icon :icon="mdiClipboardCheckOutline" />
        章节规划确认
      </v-card-title>

      <v-card-text class="pa-4">
        <div v-if="!agentStore.currentPlan" class="text-body-2 text-medium-emphasis">
          正在生成规划…
        </div>
        <div v-else class="d-flex flex-column gap-4">
          <!-- 大纲（可编辑） -->
          <div>
            <div class="text-subtitle-2 mb-2">章节大纲（可编辑）</div>
            <v-textarea
              v-model="editableOutline"
              variant="outlined"
              density="compact"
              rows="6"
              auto-grow
              hide-details
            />
          </div>

          <!-- 写法思路 -->
          <div v-if="agentStore.currentPlan.approach">
            <div class="text-subtitle-2 mb-1">写法思路</div>
            <div class="text-body-2 text-medium-emphasis">{{ agentStore.currentPlan.approach }}</div>
          </div>

          <!-- 所选技能 -->
          <div v-if="agentStore.currentPlan.selectedSkills?.length">
            <div class="text-subtitle-2 mb-1">所选技能</div>
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
          <div v-if="agentStore.currentPlan.referencedLoreEntries?.length">
            <div class="text-subtitle-2 mb-1">引用资料</div>
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
          <div v-if="agentStore.toolCallLog.length">
            <div class="text-subtitle-2 mb-1">调研过程</div>
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
        <v-btn variant="text" @click="$emit('cancel')">取消</v-btn>
        <v-btn
          color="primary"
          variant="tonal"
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
