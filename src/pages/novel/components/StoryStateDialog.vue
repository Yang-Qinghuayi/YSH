<template>
  <v-dialog v-model="visible" max-width="760" scrollable>
    <v-card rounded="xl" class="lg-dialog" v-if="loaded">
      <!-- 标题栏 -->
      <v-card-title class="d-flex align-center gap-3 pt-5 px-5">
        <span class="title-badge">
          <v-icon :icon="mdiStateMachine" size="18" />
        </span>
        <span class="text-h6">故事状态</span>
        <span class="updated-hint" v-if="liveState?.updatedAt">
          最近更新 {{ formatTime(liveState.updatedAt) }}
        </span>
      </v-card-title>

      <v-card-text class="pa-5">
        <div class="intro-hint">
          每章写完后，在 Agent 面板点「定稿」：会生成章节概要、改写角色短期记忆、判断是否改写长期记忆，并更新整体进度。
        </div>

        <!-- ===== 整体进度 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">整体进度</span>
            <span v-if="mainlineChapterTitle" class="section-meta">
              截至《{{ mainlineChapterTitle }}》
            </span>
          </div>
          <v-textarea
            v-model="mainlineDraft"
            placeholder="主线梳理：已经发生的主线事件、当前局势与主要悬念。定稿时自动更新，也可手动修改。"
            density="compact"
            variant="outlined"
            hide-details
            rounded="xl"
            rows="4"
            auto-grow
            max-rows="12"
          />
        </div>

        <!-- ===== 角色短期记忆 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">角色短期记忆（POV）</span>
            <span class="section-meta">只记录该角色自己知道的信息</span>
          </div>
          <div v-if="!characters.length" class="empty-hint">暂无角色</div>
          <div v-for="c in characters" :key="c.id" class="sub-card">
            <div class="sub-card-head">
              <span class="char-name">{{ c.name }}</span>
              <span v-if="memoryChapterTitle(c.name)" class="section-meta">
                截至《{{ memoryChapterTitle(c.name) }}》
              </span>
            </div>
            <v-textarea
              v-model="memoryDrafts[c.name]"
              placeholder="暂无短期记忆"
              density="compact"
              variant="outlined"
              hide-details
              rounded="xl"
              rows="2"
              auto-grow
              max-rows="8"
            />
          </div>
          <!-- 角色已删除/改名后遗留的记忆 -->
          <div v-for="name in orphanMemoryNames" :key="name" class="sub-card sub-card--orphan">
            <div class="sub-card-head">
              <span class="char-name">{{ name }}</span>
              <span class="section-meta">（角色已不存在）</span>
              <v-spacer />
              <button class="del-btn" title="删除这条记忆" @click="removedOrphans.add(name)">
                <v-icon :icon="mdiClose" size="15" />
              </button>
            </div>
            <div class="orphan-text">{{ originalMemory(name) }}</div>
          </div>
        </div>

        <!-- ===== 长期记忆改写记录 ===== -->
        <div class="section">
          <div class="section-head">
            <span class="section-label">长期记忆（Skill）改写记录</span>
            <span class="section-meta">定稿时 Agent 自动写入，可回滚</span>
          </div>
          <div v-if="!changeLog.length" class="empty-hint">暂无改写</div>
          <div
            v-for="ch in changeLog"
            :key="ch.id"
            class="sub-card"
            :class="{ 'sub-card--muted': ch.revertedAt }"
          >
            <div class="sub-card-head">
              <span class="char-name">{{ ch.characterName }}</span>
              <span class="section-meta">
                《{{ chapterTitle(ch.chapterId) || '未知章节' }}》· {{ formatTime(ch.at) }}
              </span>
              <v-spacer />
              <span v-if="ch.revertedAt" class="reverted-tag">已回滚</span>
              <v-btn
                v-else
                size="x-small"
                variant="tonal"
                rounded="pill"
                color="warning"
                :prepend-icon="mdiUndoVariant"
                @click="emit('revert', ch.id)"
              >
                回滚
              </v-btn>
            </div>
            <div class="change-reason">原因：{{ ch.reason }}</div>
            <button class="add-link" @click="toggleExpand(ch.id)">
              {{ expanded.has(ch.id) ? '收起对比' : '查看改写前后' }}
            </button>
            <div v-if="expanded.has(ch.id)" class="diff-grid">
              <div>
                <div class="diff-label">改写前</div>
                <div class="diff-text">{{ ch.before || '（空）' }}</div>
              </div>
              <div>
                <div class="diff-label">改写后</div>
                <div class="diff-text">{{ ch.after }}</div>
              </div>
            </div>
          </div>
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
import { mdiStateMachine, mdiClose, mdiUndoVariant } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useAgentStore } from '@/store/agentStore'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import type { StoryState, CharacterMemory } from '@/types/storyState'
import type { Character, ChapterMeta } from '@/types/novel'

const props = defineProps<{
  modelValue: boolean
  novelId: string
  characters: Character[]
  chapters: ChapterMeta[]
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  /** 回滚一次长期记忆改写（由父组件改 novel.json 与 story-state.json） */
  revert: [changeId: string]
}>()
const agentStore = useAgentStore()
const { storyState: liveState } = storeToRefs(agentStore)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

/** 打开时的快照（用于判断哪些字段被编辑过） */
const original = ref<StoryState | null>(null)
const loaded = computed(() => !!original.value)
const mainlineDraft = ref('')
const memoryDrafts = reactive<Record<string, string>>({})
const removedOrphans = reactive(new Set<string>())
const saving = ref(false)
const expanded = ref<Set<string>>(new Set())

// 打开时加载最新状态
watch(
  () => props.modelValue,
  async (v) => {
    if (!v) {
      original.value = null
      return
    }
    const s = await loadStoryState(props.novelId)
    agentStore.setStoryState(s)
    original.value = JSON.parse(JSON.stringify(s))
    mainlineDraft.value = s.mainline
    for (const k of Object.keys(memoryDrafts)) delete memoryDrafts[k]
    for (const c of props.characters) {
      memoryDrafts[c.name] =
        s.characterMemories.find((m) => m.characterName === c.name)?.shortTerm ?? ''
    }
    removedOrphans.clear()
    expanded.value = new Set()
  },
)

function chapterTitle(id?: string): string {
  if (!id) return ''
  return props.chapters.find((c) => c.id === id)?.title ?? ''
}
const mainlineChapterTitle = computed(() =>
  chapterTitle(original.value?.mainlineUpdatedChapterId),
)
function originalMemory(name: string): string {
  return original.value?.characterMemories.find((m) => m.characterName === name)?.shortTerm ?? ''
}
function memoryChapterTitle(name: string): string {
  const m = original.value?.characterMemories.find((x) => x.characterName === name)
  return chapterTitle(m?.lastUpdatedChapterId)
}
const orphanMemoryNames = computed(() => {
  const names = new Set(props.characters.map((c) => c.name))
  return (original.value?.characterMemories ?? [])
    .map((m) => m.characterName)
    .filter((n) => !names.has(n) && !removedOrphans.has(n))
})

/** 改写记录：新的在前（读 store 的实时状态，回滚后立即刷新） */
const changeLog = computed(() => [...(liveState.value?.longTermLog ?? [])].reverse())

function toggleExpand(id: string) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

async function save() {
  if (!original.value) return
  saving.value = true
  try {
    // 基于磁盘最新状态合并本次编辑（避免覆盖期间发生的回滚/定稿）
    const latest = await loadStoryState(props.novelId)
    const now = Date.now()
    let memories: CharacterMemory[] = latest.characterMemories.filter(
      (m) => !removedOrphans.has(m.characterName),
    )
    for (const c of props.characters) {
      const draft = (memoryDrafts[c.name] ?? '').trim()
      if (draft === originalMemory(c.name).trim()) continue
      const idx = memories.findIndex((m) => m.characterName === c.name)
      if (!draft) {
        memories = memories.filter((m) => m.characterName !== c.name)
      } else if (idx >= 0) {
        memories[idx] = { ...memories[idx], shortTerm: draft, updatedAt: now }
      } else {
        memories.push({
          characterName: c.name,
          shortTerm: draft,
          lastUpdatedChapterId: '',
          updatedAt: now,
        })
      }
    }
    const mainlineChanged = mainlineDraft.value.trim() !== original.value.mainline.trim()
    const saved = await saveStoryState({
      ...latest,
      mainline: mainlineChanged ? mainlineDraft.value.trim() : latest.mainline,
      characterMemories: memories,
    })
    agentStore.setStoryState(saved)
    visible.value = false
  } catch (e) {
    console.error('保存故事状态失败：', e)
  } finally {
    saving.value = false
  }
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
.intro-hint {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.55);
  background: rgba(var(--v-theme-primary), 0.06);
  border-radius: 12px;
  padding: 8px 12px;
  margin-bottom: 16px;
}

.section {
  margin-bottom: 20px;
}
.section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.section-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.section-meta {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.42);
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
.sub-card--muted {
  opacity: 0.6;
}
.sub-card--orphan {
  border-style: dashed;
}
.sub-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.char-name {
  font-size: 13px;
  font-weight: 600;
}
.orphan-text,
.change-reason {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: pre-wrap;
}
.reverted-tag {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
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
  padding: 4px 0 0;
}
.diff-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.diff-label {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  margin-bottom: 4px;
}
.diff-text {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 10px;
  padding: 8px 10px;
  max-height: 240px;
  overflow-y: auto;
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
</style>
