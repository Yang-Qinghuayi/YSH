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
        <!-- ===== 档案区（静态，可编辑） ===== -->
        <div class="panel-block lg-card--inset pa-3 d-flex flex-column gap-3">
          <div class="lg-section-label">档案（不变的"是谁"）</div>

          <v-textarea
            v-model="draft.personality"
            label="性格"
            variant="outlined" density="compact" rows="2" auto-grow hide-details rounded="xl"
            @blur="emitCharacter"
          />
          <v-textarea
            v-model="draft.background"
            label="出身背景"
            variant="outlined" density="compact" rows="2" auto-grow hide-details rounded="xl"
            @blur="emitCharacter"
          />
          <v-textarea
            v-model="draft.appearance"
            label="外貌"
            variant="outlined" density="compact" rows="2" auto-grow hide-details rounded="xl"
            @blur="emitCharacter"
          />
          <v-textarea
            v-model="draft.hobbies"
            label="爱好"
            variant="outlined" density="compact" rows="1" auto-grow hide-details rounded="xl"
            @blur="emitCharacter"
          />
          <v-combobox
            v-model="draft.aliases"
            label="别名/触发词"
            variant="outlined" density="compact" multiple chips closable-chips hide-details rounded="xl"
            @update:model-value="emitCharacter"
          />
          <v-textarea
            v-model="voicePromptDraft"
            label="文风指导"
            variant="outlined" density="compact" rows="2" auto-grow hide-details rounded="xl"
            @blur="emitCharacter"
          />
          <v-text-field
            v-model="draft.description"
            label="整体触发说明"
            variant="outlined" density="compact" hide-details rounded="xl"
            @blur="emitCharacter"
          />
        </div>

        <!-- ===== 状态区（动态，来自 StoryState） ===== -->
        <div class="panel-block lg-card--inset pa-3 d-flex flex-column gap-3">
          <div class="lg-section-label">
            当前状态（随情节变）
            <span v-if="stateEntry" class="text-caption text-medium-emphasis">
              · 最近更新于章节 {{ stateEntry.lastUpdatedChapterId }}
            </span>
          </div>

          <div v-if="!stateEntry" class="text-body-2 text-medium-emphasis">
            暂无状态记录。生成章节后由 Agent 自动更新，也可手动填写。
          </div>
          <template v-else>
            <v-text-field
              v-model="stateDraft.mood"
              label="心情/想法"
              variant="outlined" density="compact" hide-details rounded="xl"
              @blur="emitState"
            />
            <v-text-field
              v-model="stateDraft.location"
              label="当前位置"
              variant="outlined" density="compact" hide-details rounded="xl"
              @blur="emitState"
            />
            <v-text-field
              v-model="stateDraft.injuries"
              label="伤势"
              variant="outlined" density="compact" hide-details rounded="xl"
              @blur="emitState"
            />
            <v-textarea
              v-model="stateDraft.notes"
              label="其他经历/想法"
              variant="outlined" density="compact" rows="2" auto-grow hide-details rounded="xl"
              @blur="emitState"
            />
            <!-- 关系（只读展示） -->
            <div v-if="stateEntry.relationships?.length">
              <div class="text-caption text-medium-emphasis mb-1">关系</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip
                  v-for="(r, i) in stateEntry.relationships"
                  :key="i"
                  size="small"
                  variant="tonal"
                >
                  {{ r.target }}：{{ r.relation }}
                </v-chip>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { mdiAccount, mdiClose } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useAgentStore } from '@/store/agentStore'
import type { Character } from '@/types/novel'
import type { CharacterState } from '@/types/storyState'

const props = defineProps<{ characters: Character[] }>()

const emit = defineEmits<{
  'update:character': [character: Character]
  'update:state': [patch: { characterName: string; data: Partial<CharacterState> }]
}>()

const agentStore = useAgentStore()
const { selectedCharacterName, storyState } = storeToRefs(agentStore)

const selected = computed(() =>
  props.characters.find((c) => c.name === selectedCharacterName.value) ?? null,
)

// 档案可编辑副本
const draft = ref<Character>({ id: '', name: '' })
const voicePromptDraft = ref('')

watch(
  selected,
  (c) => {
    if (c) {
      draft.value = JSON.parse(JSON.stringify(c))
      voicePromptDraft.value = c.voice?.prompt ?? ''
    }
  },
  { immediate: true },
)

// 状态区
const stateEntry = computed(
  () => storyState.value?.characterStates.find((s) => s.characterName === selectedCharacterName.value) ?? null,
)
const stateDraft = ref<Partial<CharacterState>>({})

watch(stateEntry, (s) => {
  if (s) {
    stateDraft.value = {
      mood: s.mood ?? '',
      location: s.location ?? '',
      injuries: s.injuries ?? '',
      notes: s.notes ?? '',
    }
  } else {
    stateDraft.value = {}
  }
}, { immediate: true })

function emitCharacter() {
  if (!selected.value) return
  const c: Character = {
    ...draft.value,
    voice: voicePromptDraft.value.trim()
      ? { ...(draft.value.voice ?? {}), prompt: voicePromptDraft.value }
      : undefined,
  }
  emit('update:character', c)
}

function emitState() {
  if (!selectedCharacterName.value) return
  emit('update:state', {
    characterName: selectedCharacterName.value,
    data: { ...stateDraft.value },
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
