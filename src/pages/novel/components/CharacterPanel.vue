<template>
  <v-navigation-drawer
    :model-value="agentStore.characterPanelOpen"
    @update:model-value="(v) => !v && agentStore.closeCharacterPanel()"
    location="right"
    width="360"
    temporary
    class="char-panel"
  >
    <div v-if="!selected" class="pa-4 text-body-2 text-medium-emphasis">未选择角色</div>
    <div v-else class="d-flex flex-column h-100">
      <!-- 标题 -->
      <div class="panel-header d-flex align-center gap-2">
        <span class="title-badge">
          <v-icon :icon="mdiAccount" size="18" />
        </span>
        <span class="text-h6">{{ selected.name }}</span>
        <v-spacer />
        <v-btn icon size="small" variant="text" @click="agentStore.closeCharacterPanel()">
          <v-icon :icon="mdiClose" size="18" />
        </v-btn>
      </div>

      <div class="panel-body flex-1 overflow-y-auto pa-4 d-flex flex-column gap-3">
        <!-- ===== 长期记忆（Skill） ===== -->
        <div class="panel-block lg-card--inset pa-3 d-flex flex-column gap-2">
          <div class="lg-section-label">长期记忆（Skill）· TA 是谁</div>
          <v-textarea
            v-model="skillDraft"
            placeholder="性格、出身、外貌、信念、说话方式、别名、参考形象……"
            variant="outlined" density="compact" rows="8" auto-grow hide-details rounded="xl"
            @blur="emitSkill"
          />
          <div class="text-caption text-medium-emphasis">
            重大事件后，「本章定稿」时 Agent 可能改写这里<template v-if="changeCount">
              （已改写 {{ changeCount }} 次，可在「故事状态」回滚）</template>。
          </div>
        </div>

        <!-- ===== 短期记忆（POV） ===== -->
        <div class="panel-block lg-card--inset pa-3 d-flex flex-column gap-2">
          <div class="lg-section-label">
            短期记忆（POV）· TA 此刻知道什么
            <span v-if="memoryChapterTitle" class="text-caption text-medium-emphasis">
              · 截至《{{ memoryChapterTitle }}》
            </span>
          </div>
          <v-textarea
            v-model="memoryDraft"
            placeholder="以角色视角记录：TA 最近经历了什么、知道什么、误以为什么、此刻的处境与心绪。每章定稿后自动改写，也可手动填写。"
            variant="outlined" density="compact" rows="6" auto-grow hide-details rounded="xl"
            @blur="emitMemory"
          />
        </div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { mdiAccount, mdiClose } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useAgentStore } from '@/store/agentStore'
import type { Character, ChapterMeta } from '@/types/novel'

const props = defineProps<{ characters: Character[]; chapters: ChapterMeta[] }>()

const emit = defineEmits<{
  'update:character': [character: Character]
  'update:memory': [patch: { characterName: string; shortTerm: string }]
}>()

const agentStore = useAgentStore()
const { selectedCharacterName, storyState } = storeToRefs(agentStore)

const selected = computed(() =>
  props.characters.find((c) => c.name === selectedCharacterName.value) ?? null,
)

// 长期记忆
const skillDraft = ref('')
watch(
  selected,
  (c) => {
    skillDraft.value = c?.skill ?? ''
  },
  { immediate: true },
)

const changeCount = computed(
  () =>
    storyState.value?.longTermLog.filter(
      (c) => c.characterName === selectedCharacterName.value && !c.revertedAt,
    ).length ?? 0,
)

// 短期记忆
const memoryEntry = computed(
  () =>
    storyState.value?.characterMemories.find(
      (m) => m.characterName === selectedCharacterName.value,
    ) ?? null,
)
const memoryDraft = ref('')
watch(
  memoryEntry,
  (m) => {
    memoryDraft.value = m?.shortTerm ?? ''
  },
  { immediate: true },
)
const memoryChapterTitle = computed(() => {
  const id = memoryEntry.value?.lastUpdatedChapterId
  return id ? (props.chapters.find((c) => c.id === id)?.title ?? '') : ''
})

function emitSkill() {
  if (!selected.value) return
  if ((selected.value.skill ?? '') === skillDraft.value) return
  emit('update:character', { ...selected.value, skill: skillDraft.value })
}

function emitMemory() {
  if (!selectedCharacterName.value) return
  if ((memoryEntry.value?.shortTerm ?? '') === memoryDraft.value) return
  emit('update:memory', {
    characterName: selectedCharacterName.value,
    shortTerm: memoryDraft.value,
  })
}
</script>

<style scoped>
.panel-header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.panel-body {
  gap: 12px;
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
.panel-block :deep(.v-field--variant-outlined) {
  border-radius: 14px;
}
</style>
