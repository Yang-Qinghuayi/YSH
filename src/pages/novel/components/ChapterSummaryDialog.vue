<template>
  <v-dialog v-model="visible" max-width="620" scrollable>
    <v-card rounded="xl" class="lg-dialog" v-if="chapter">
      <v-card-title class="d-flex align-center gap-3 pt-5 px-5">
        <span class="title-badge">
          <v-icon :icon="mdiTextBoxOutline" size="18" />
        </span>
        <div class="min-w-0">
          <div class="text-h6 text-truncate">本章概要</div>
          <div class="sub-title text-truncate">{{ chapter.title }}</div>
        </div>
        <v-spacer />
        <span v-if="chapter.finalizedAt" class="status-chip status-chip--done">
          已定稿 · {{ formatTime(chapter.finalizedAt) }}
        </span>
        <span v-else class="status-chip">未定稿</span>
      </v-card-title>

      <v-card-text class="pa-5">
        <v-textarea
          v-model="draft"
          placeholder="本章还没有概要。写完本章后点「定稿本章」自动生成，也可以直接在这里手写。"
          variant="outlined"
          density="comfortable"
          rows="6"
          auto-grow
          max-rows="16"
          hide-details
          rounded="xl"
        />
        <div class="hint">
          概要用于后续章节的「前情提要」，并参与「整体进度」的梳理。定稿后若又大幅修改了本章，建议重新定稿。
        </div>
      </v-card-text>

      <v-card-actions class="px-5 pb-5">
        <v-btn
          variant="tonal"
          rounded="pill"
          color="primary"
          :prepend-icon="mdiCheckDecagramOutline"
          :loading="finalizing"
          :disabled="busy && !finalizing"
          @click="emit('finalize')"
        >
          {{ chapter.finalizedAt ? '重新定稿' : '定稿本章' }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" rounded="pill" @click="visible = false">关闭</v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          rounded="pill"
          :disabled="!changed"
          @click="save"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiTextBoxOutline, mdiCheckDecagramOutline } from '@mdi/js'
import type { ChapterMeta } from '@/types/novel'

const props = defineProps<{
  modelValue: boolean
  chapter: ChapterMeta | null
  /** 正在定稿（按钮 loading） */
  finalizing?: boolean
  /** Agent 忙（生成/定稿中），禁用定稿按钮 */
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  save: [summary: string]
  finalize: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const draft = ref('')
watch(
  () => [props.modelValue, props.chapter?.id, props.chapter?.summary] as const,
  ([open]) => {
    if (open) draft.value = props.chapter?.summary ?? ''
  },
  { immediate: true },
)

const changed = computed(() => draft.value.trim() !== (props.chapter?.summary ?? '').trim())

function save() {
  emit('save', draft.value.trim())
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  flex-shrink: 0;
  border-radius: 11px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
.min-w-0 {
  min-width: 0;
}
.sub-title {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.3;
}
.status-chip {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.55);
  white-space: nowrap;
}
.status-chip--done {
  background: rgba(var(--v-theme-success), 0.12);
  color: rgb(var(--v-theme-success));
}
.hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
