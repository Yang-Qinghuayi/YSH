<template>
  <v-dialog v-model="visible" max-width="720" scrollable>
    <v-card rounded="xl" class="lg-dialog" v-if="state">
      <!-- 标题栏 -->
      <v-card-title class="d-flex align-center gap-3 pt-5 px-5">
        <span class="title-badge">
          <v-icon :icon="mdiStateMachine" size="18" />
        </span>
        <span class="text-h6">故事状态</span>
        <span class="updated-hint" v-if="state.updatedAt">
          最近更新 {{ formatTime(state.updatedAt) }}
        </span>
      </v-card-title>

      <v-card-text class="pa-5">
        <!-- ===== 角色状态 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">角色状态</span>
            <v-btn size="x-small" variant="tonal" rounded="pill" :prepend-icon="mdiPlus" @click="addCharacter">
              新增
            </v-btn>
          </div>

          <div v-if="state.characterStates.length === 0" class="empty-hint">暂无角色状态</div>
          <div v-for="(c, i) in state.characterStates" :key="i" class="sub-card">
            <div class="sub-card-head">
              <v-select
                v-model="c.characterName"
                :items="characterNames"
                item-title="name"
                item-value="name"
                density="compact"
                variant="outlined"
                hide-details
                rounded="xl"
                placeholder="选择角色"
                class="name-select"
              />
              <button class="del-btn" title="删除" @click="state.characterStates.splice(i, 1)">
                <v-icon :icon="mdiClose" size="15" />
              </button>
            </div>
            <div class="field-grid">
              <v-text-field v-model="c.mood" label="心情/想法" density="compact" variant="outlined" hide-details rounded="xl" />
              <v-text-field v-model="c.location" label="位置" density="compact" variant="outlined" hide-details rounded="xl" />
              <v-text-field v-model="c.injuries" label="伤势" density="compact" variant="outlined" hide-details rounded="xl" />
              <v-text-field
                :model-value="(c.possessions || []).join('、')"
                @update:model-value="c.possessions = splitList($event)"
                label="持有物品（顿号分隔）"
                density="compact"
                variant="outlined"
                hide-details
                rounded="xl"
              />
            </div>

            <!-- 关系 -->
            <div class="rel-wrap">
              <div class="rel-label">关系</div>
              <div v-for="(r, ri) in c.relationships" :key="ri" class="rel-row">
                <v-text-field v-model="r.target" placeholder="对方角色" density="compact" variant="outlined" hide-details rounded="xl" class="rel-target" />
                <v-text-field v-model="r.relation" placeholder="关系描述" density="compact" variant="outlined" hide-details rounded="xl" class="rel-relation" />
                <button class="del-btn sm" @click="c.relationships.splice(ri, 1)">
                  <v-icon :icon="mdiClose" size="14" />
                </button>
              </div>
              <button class="add-link" @click="c.relationships.push({ target: '', relation: '' })">
                <v-icon :icon="mdiPlus" size="13" /> 添加关系
              </button>
            </div>

            <v-textarea v-model="c.notes" label="备注" density="compact" variant="outlined" hide-details rounded="xl" rows="1" auto-grow max-rows="3" class="mt-2" />
          </div>
        </div>

        <!-- ===== 时间线 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">时间线</span>
            <v-btn size="x-small" variant="tonal" rounded="pill" :prepend-icon="mdiPlus" @click="addTimeline">
              新增
            </v-btn>
          </div>
          <div v-if="state.timeline.length === 0" class="empty-hint">暂无时间线节点</div>
          <div v-for="(t, i) in state.timeline" :key="t.id" class="sub-card compact">
            <v-text-field v-model="t.label" placeholder="事件标签" density="compact" variant="outlined" hide-details rounded="xl" />
            <v-text-field v-model="t.detail" placeholder="详情（可选）" density="compact" variant="outlined" hide-details rounded="xl" class="mt-2" />
            <button class="del-btn float" @click="state.timeline.splice(i, 1)">
              <v-icon :icon="mdiClose" size="15" />
            </button>
          </div>
        </div>

        <!-- ===== 伏笔 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">伏笔</span>
            <v-btn size="x-small" variant="tonal" rounded="pill" :prepend-icon="mdiPlus" @click="addForeshadowing">
              新增
            </v-btn>
          </div>
          <div v-if="state.foreshadowings.length === 0" class="empty-hint">暂无伏笔</div>
          <div v-for="(f, i) in state.foreshadowings" :key="f.id" class="sub-card compact">
            <div class="foreshadow-row">
              <v-text-field v-model="f.description" placeholder="伏笔描述" density="compact" variant="outlined" hide-details rounded="xl" />
              <v-select
                v-model="f.status"
                :items="statusItems"
                density="compact"
                variant="outlined"
                hide-details
                rounded="xl"
                class="status-select"
              />
              <button class="del-btn" @click="state.foreshadowings.splice(i, 1)">
                <v-icon :icon="mdiClose" size="15" />
              </button>
            </div>
          </div>
        </div>

        <!-- ===== 备注 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">总体备注</span>
          </div>
          <v-textarea
            v-model="state.notes"
            placeholder="记录全局设定、节奏提醒等"
            density="compact"
            variant="outlined"
            hide-details
            rounded="xl"
            rows="2"
            auto-grow
            max-rows="5"
          />
        </div>
      </v-card-text>

      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" rounded="pill" @click="visible = false">取消</v-btn>
        <v-btn color="primary" variant="tonal" rounded="pill" :loading="saving" @click="save">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiStateMachine, mdiPlus, mdiClose } from '@mdi/js'
import { useAgentStore } from '@/store/agentStore'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import type { StoryState, CharacterState } from '@/types/storyState'
import type { Character } from '@/types/novel'

const props = defineProps<{
  modelValue: boolean
  novelId: string
  characters: Character[]
}>()

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()
const agentStore = useAgentStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const state = ref<StoryState | null>(null)
const saving = ref(false)

const characterNames = computed(() => props.characters.map((c) => ({ name: c.name })))
const statusItems = [
  { title: '未揭晓', value: 'open' },
  { title: '已揭晓', value: 'resolved' },
  { title: '已放弃', value: 'abandoned' },
]

// 打开时加载最新状态
watch(
  () => props.modelValue,
  async (v) => {
    if (v) {
      const s = await loadStoryState(props.novelId)
      // 深拷贝一份编辑，避免直接污染 store
      state.value = JSON.parse(JSON.stringify(s))
    } else {
      state.value = null
    }
  },
)

function splitList(text: string): string[] {
  return text.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
}

function addCharacter() {
  if (!state.value) return
  const cs: CharacterState = {
    characterName: '',
    mood: '',
    location: '',
    injuries: '',
    possessions: [],
    relationships: [],
    notes: '',
    lastUpdatedChapterId: '',
    updatedAt: Date.now(),
  }
  state.value.characterStates.push(cs)
}

function addTimeline() {
  if (!state.value) return
  state.value.timeline.push({
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chapterId: '',
    label: '',
    detail: '',
    order: state.value.timeline.length,
  })
}

function addForeshadowing() {
  if (!state.value) return
  state.value.foreshadowings.push({
    id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: '',
    plantedChapterId: '',
    status: 'open',
  })
}

async function save() {
  if (!state.value) return
  saving.value = true
  try {
    // 清理空角色名项
    state.value.characterStates = state.value.characterStates.filter(
      (c) => c.characterName.trim(),
    )
    const saved = await saveStoryState(state.value)
    agentStore.setStoryState(saved)
    visible.value = false
  } catch (e) {
    console.error('保存故事状态失败：', e)
  } finally {
    saving.value = false
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.lg-dialog {
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
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
.updated-hint {
  margin-left: auto;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-weight: 400;
}

.section {
  margin-bottom: 18px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.section-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.empty-hint {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  padding: 6px 4px;
}

.sub-card {
  position: relative;
  background: rgba(var(--v-theme-on-surface), 0.035);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 8px;
}
.sub-card.compact {
  padding: 10px 36px 10px 12px;
}
.sub-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.name-select {
  max-width: 200px;
}
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.rel-wrap {
  margin-top: 8px;
}
.rel-label {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  margin-bottom: 4px;
}
.rel-row {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}
.rel-target {
  max-width: 120px;
}
.rel-relation {
  flex: 1;
}
.add-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: rgb(var(--v-theme-primary));
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 0;
}

.foreshadow-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.status-select {
  max-width: 130px;
}

.del-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-error), 0.7);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.del-btn:hover {
  background: rgba(var(--v-theme-error), 0.1);
}
.del-btn.sm {
  width: 22px;
  height: 22px;
}
.del-btn.float {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
