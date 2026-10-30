<template>
  <div class="agent-panel d-flex flex-column">
    <!-- ===== 头部 ===== -->
    <header class="agent-panel__head">
      <span class="title-badge">
        <v-icon :icon="mdiRobotOutline" size="18" />
      </span>
      <div class="agent-panel__heading">
        <span class="agent-panel__title">Agent</span>
        <v-chip
          v-if="chapter"
          size="x-small"
          variant="tonal"
          color="primary"
          class="agent-panel__target"
        >
          《{{ chapter.title }}》
        </v-chip>
      </div>
      <v-spacer />
      <button
        v-if="chapter"
        class="lg-pill finalize-btn"
        :class="{ 'finalize-btn--done': !!chapter.finalizedAt }"
        :disabled="chatStore.busy || contentLength < 50"
        :title="finalizeTitle"
        @click="$emit('finalize')"
      >
        <v-icon :icon="mdiCheckDecagramOutline" size="14" />
        {{ chapter.finalizedAt ? '重新定稿' : '本章定稿' }}
      </button>
      <button
        class="lg-icon-btn agent-panel__clear"
        title="清空对话"
        :disabled="!transcript.length"
        @click="$emit('clearChat')"
      >
        <v-icon :icon="mdiDeleteOutline" size="16" />
      </button>
    </header>

    <!-- ===== 上下文预算 + 状态行 ===== -->
    <div class="agent-panel__meta">
      <div class="context-meter" :class="{ 'context-meter--warning': contextPercent >= 75 }">
        <div class="context-meter__top">
          <span><v-icon :icon="mdiGauge" size="14" /> 上下文</span>
          <strong>{{ contextPercent }}%</strong>
        </div>
        <div class="context-meter__track"><div class="context-meter__fill" :style="{ width: `${contextPercent}%` }" /></div>
        <div class="context-meter__bottom">
          <span>{{ formatTokens(contextTokens) }} / {{ formatTokens(contextLimit) }} tokens</span>
          <span v-if="contextTrimmed">已自动压缩 {{ contextTrimmed }} 条</span>
          <span v-else>接近上限时自动压缩</span>
        </div>
      </div>

      <div v-if="chatStore.busy" class="agent-panel__status">
        <v-progress-circular indeterminate size="13" width="2" color="primary" />
        <span class="agent-panel__status-text">{{
          chatStore.statusText || '正在处理…'
        }}</span>
      </div>
    </div>

    <!-- ===== 转录区 ===== -->
    <div ref="bodyRef" class="agent-panel__body flex-1 lg-scroll" @scroll="onScroll">
      <!-- 空状态 -->
      <div v-if="!transcript.length" class="agent-panel__empty">
        <div class="empty-icon">
          <v-icon :icon="mdiRobotOutline" size="34" />
        </div>
        <div class="empty-title">AI 写作助手</div>
        <div class="empty-sub">
          写下本章概要，Agent
          会先调研资料、给出规划，你确认后再动笔；也可以直接提问或让它续写。
        </div>
        <div class="empty-hints">
          <div class="empty-hint-item">
            <v-icon :icon="mdiNoteTextOutline" size="13" /> 输入概要 → 出规划 →
            确认 → 写正文
          </div>
          <div class="empty-hint-item">
            <v-icon :icon="mdiRobotOutline" size="13" /> 多轮对话，随时修改规划
          </div>
          <div class="empty-hint-item">
            <v-icon :icon="mdiAt" size="13" /> @角色名 可强制指定出场的角色
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <template v-for="msg in transcript" :key="msg.id">
        <!-- 用户消息 -->
        <div v-if="msg.kind === 'user'" class="chat-user">
          <div class="chat-user__bubble">{{ msg.text }}</div>
        </div>

        <!-- 助手文本 -->
        <div v-else-if="msg.kind === 'assistant'" class="chat-assistant">
          <span class="chat-assistant__avatar">
            <v-icon :icon="mdiRobotOutline" size="14" />
          </span>
          <div class="chat-assistant__bubble">
            <span class="chat-assistant__text"
              >{{ msg.text
              }}<span v-if="msg.streaming" class="chat-cursor">▍</span></span
            >
          </div>
        </div>

        <!-- 工具卡片 -->
        <div
          v-else-if="msg.kind === 'tool'"
          class="chat-tool lg-card--inset"
          :class="{
            'chat-tool--running': msg.status === 'running',
            'chat-tool--error': msg.status === 'error',
          }"
        >
          <div class="chat-tool__head" @click="toggleExpand(msg.id)">
            <v-progress-circular
              v-if="msg.status === 'running'"
              indeterminate
              size="13"
              width="2"
              color="primary"
            />
            <v-icon
              v-else
              :icon="msg.status === 'done' ? mdiCheckCircle : mdiAlertCircle"
              size="14"
              :color="msg.status === 'done' ? 'success' : 'error'"
            />
            <span class="chat-tool__name">{{ toolLabel(msg.tool) }}</span>
            <span class="chat-tool__summary text-truncate">{{
              msg.argsSummary
            }}</span>
            <v-icon
              v-if="msg.resultText || msg.write"
              :icon="expanded.has(msg.id) ? mdiChevronUp : mdiChevronDown"
              size="14"
              class="chat-tool__chevron"
            />
          </div>

          <!-- 写章预览 / 结果 -->
          <div v-if="msg.preview || msg.write" class="chat-tool__write">
            <div class="chat-write-meta">
              <v-icon :icon="mdiPen" size="13" />
              <span v-if="msg.write">
                已写入《{{ msg.write.chapterTitle }}》 +{{
                  msg.write.addedChars
                }}
                字
                <template v-if="msg.write.removedChars"
                  >（重写 -{{ msg.write.removedChars }} 字）</template
                >
              </span>
              <span v-else>正在写入正文…</span>
              <button
                v-if="msg.write?.snapshot"
                class="chat-write-undo"
                :disabled="chatStore.busy"
                title="撤销这次写入"
                @click.stop="$emit('undoWrite', msg.id)"
              >
                <v-icon :icon="mdiUndoVariant" size="12" /> 撤销
              </button>
            </div>
            <div
              class="chat-write-preview lg-scroll"
              :class="{ 'chat-write-preview--streaming': !msg.write }"
            >
              {{ msg.preview }}
            </div>
          </div>

          <!-- 展开细节 -->
          <div
            v-if="expanded.has(msg.id) && msg.resultText"
            class="chat-tool__detail lg-scroll"
          >
            {{ msg.resultText }}
          </div>
        </div>

        <!-- plan 卡片 -->
        <div
          v-else-if="msg.kind === 'plan'"
          class="chat-plan lg-card--inset"
          :class="{
            'chat-plan--muted':
              msg.status === 'superseded' || msg.status === 'cancelled',
          }"
        >
          <div class="chat-plan__head">
            <span class="chat-plan__icon">
              <v-icon :icon="mdiPencilOutline" size="14" />
            </span>
            <span class="chat-plan__title">章节规划</span>
            <span v-if="msg.status === 'superseded'" class="chat-plan__tag"
              >已更新</span
            >
            <span
              v-else-if="msg.status === 'cancelled'"
              class="chat-plan__tag chat-plan__tag--error"
              >已取消</span
            >
            <span
              v-else-if="msg.status === 'confirmed'"
              class="chat-plan__tag chat-plan__tag--success"
              >已确认</span
            >
            <v-spacer />
            <span v-if="msg.status === 'pending'" class="chat-plan__pending"
              >待确认</span
            >
          </div>

          <!-- 大纲（pending 可编辑） -->
          <div class="chat-plan__block">
            <div class="lg-section-label mb-1">
              大纲{{ msg.status === 'pending' ? '（可编辑）' : '' }}
            </div>
            <v-textarea
              v-if="msg.status === 'pending'"
              :model-value="msg.outlineDraft"
              variant="outlined"
              density="compact"
              rows="4"
              auto-grow
              hide-details
              rounded="lg"
              @update:model-value="
                (v: string) => chatStore.updatePlan(msg.id, { outlineDraft: v })
              "
            />
            <div v-else class="chat-plan__outline">{{ msg.outlineDraft }}</div>
          </div>

          <div v-if="msg.plan.approach" class="chat-plan__block">
            <div class="lg-section-label mb-1">写法思路</div>
            <div class="chat-plan__approach">{{ msg.plan.approach }}</div>
          </div>

          <div
            v-if="msg.plan.selectedCharacters?.length"
            class="chat-plan__block"
          >
            <div class="lg-section-label mb-1">选用角色</div>
            <div class="chip-wrap">
              <v-chip
                v-for="s in msg.plan.selectedCharacters"
                :key="s.id"
                size="x-small"
                color="primary"
                variant="tonal"
              >
                {{ s.name }}
              </v-chip>
            </div>
          </div>

          <div
            v-if="msg.plan.referencedLoreEntries?.length"
            class="chat-plan__block"
          >
            <div class="lg-section-label mb-1">引用设定</div>
            <div class="chip-wrap">
              <v-chip
                v-for="e in msg.plan.referencedLoreEntries"
                :key="e.id"
                size="x-small"
                color="info"
                variant="tonal"
              >
                {{ e.name }}
              </v-chip>
            </div>
          </div>

          <div v-if="msg.status === 'pending'" class="chat-plan__actions">
            <button
              class="lg-pill chat-plan__confirm"
              @click="onConfirmPlan(msg)"
            >
              <v-icon :icon="mdiAutoFix" size="14" /> 确认生成
            </button>
            <button
              class="lg-pill chat-plan__cancel"
              @click="$emit('cancelPlan')"
            >
              取消
            </button>
          </div>
        </div>

        <!-- 系统提示 -->
        <div v-else class="chat-system">{{ msg.text }}</div>
      </template>
    </div>

    <!-- ===== 底部操作区（快捷动作 + 输入） ===== -->
    <footer class="agent-panel__foot">
      <div class="agent-panel__quick">
        <div class="length-row">
          <span class="length-label">目标字数</span>
          <v-select
            :model-value="settingStore.agentWriteLength"
            :items="lengthItems"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            class="length-select"
            @update:model-value="
              (v) =>
                (settingStore.agentWriteLength = v as 500 | 1000 | 1500 | 2000)
            "
          />
        </div>
        <div class="chip-row">
          <button
            class="lg-pill quick-chip"
            :disabled="!chapter || chatStore.busy || canContinuePrev === false"
            @click="$emit('quickAction', 'continue-prev')"
          >
            <v-icon :icon="mdiBookPlusOutline" size="14" /> 续写上一章
          </button>
          <button
            class="lg-pill quick-chip"
            :disabled="!chapter || chatStore.busy"
            @click="$emit('quickAction', 'continue-current')"
          >
            <v-icon :icon="mdiPen" size="14" /> 续写本章
          </button>
        </div>
        <span v-if="chapter && canContinuePrev === false" class="length-hint"
          >「续写上一章」需当前章基本为空</span
        >
      </div>

      <!-- ===== 输入区 ===== -->
      <div class="agent-panel__input">
        <MentionTextarea
          v-model="draft"
          :characters="novel.characters"
          :placeholder="inputPlaceholder"
          :disabled="inputDisabled"
          variant="plain"
          density="compact"
          rows="1"
          auto-grow
          max-rows="5"
          hide-details
          class="agent-panel__textarea"
          @menu-open="mentionMenuOpen = $event"
          @keydown.enter.exact="onEnterKey"
        />
        <button
          v-if="chatStore.busy"
          class="send-btn send-btn--stop"
          title="停止"
          @click="$emit('stop')"
        >
          <v-icon :icon="mdiStop" size="18" />
        </button>
        <button
          v-else
          class="send-btn"
          :disabled="inputDisabled || !draft.trim()"
          title="发送"
          @click="sendDraft"
        >
          <v-icon :icon="mdiSend" size="18" />
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  mdiRobotOutline,
  mdiDeleteOutline,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiChevronDown,
  mdiChevronUp,
  mdiPencilOutline,
  mdiAutoFix,
  mdiPen,
  mdiUndoVariant,
  mdiNoteTextOutline,
  mdiAt,
  mdiSend,
  mdiStop,
  mdiBookPlusOutline,
  mdiCheckDecagramOutline,
  mdiGauge,
} from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/store/chatStore'
import { useSettingStore } from '@/store/setting'
import type { AgentPlan } from '@/services/agentService'
import { FINALIZE_STEP_LABELS, type FinalizeStep } from '@/services/chapterFinalize'
import type { Novel, ChapterMeta } from '@/types/novel'
import type { ChatMsg } from '@/types/agentChat'
import MentionTextarea from './MentionTextarea.vue'

const props = defineProps<{
  novel: Novel
  chapter: ChapterMeta | null
  /** 当前章正文长度（「续写上一章」护栏：需基本为空） */
  contentLength: number
}>()

const emit = defineEmits<{
  send: [text: string]
  quickAction: [action: 'continue-prev' | 'continue-current']
  stop: []
  confirmPlan: [plan: AgentPlan]
  cancelPlan: []
  undoWrite: [msgId: string]
  clearChat: []
  /** 本章定稿：概要 → 短期记忆 → 长期记忆 → 整体进度 */
  finalize: []
}>()

const chatStore = useChatStore()
const settingStore = useSettingStore()
const { transcript, busy: chatBusy, contextTokens, contextLimit, contextTrimmed } = storeToRefs(chatStore)
const contextPercent = computed(() => Math.min(100, Math.round((contextTokens.value / contextLimit.value) * 100)))
function formatTokens(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

// ===== 目标字数 =====
const lengthItems = [
  { title: '500 字', value: 500 },
  { title: '1000 字', value: 1000 },
  { title: '1500 字', value: 1500 },
  { title: '2000 字', value: 2000 },
]

// ===== 输入 =====
const draft = ref('')
const mentionMenuOpen = ref(false)

const inputDisabled = computed(() => chatBusy.value || !props.chapter)
const inputPlaceholder = computed(() => {
  if (!props.chapter) return '先打开一个章节'
  if (chatBusy.value) return 'Agent 工作中…'
  return '写本章概要，或向我提问…（@ 可指定角色）'
})

function sendDraft() {
  const text = draft.value.trim()
  if (!text || inputDisabled.value) return
  emit('send', text)
  draft.value = ''
}

function onEnterKey(e: KeyboardEvent) {
  // @提及菜单打开时 Enter 用于选中角色（MentionTextarea 内部处理）
  if (mentionMenuOpen.value) return
  e.preventDefault()
  sendDraft()
}

// ===== 本章定稿 =====
const finalizeTitle = computed(() => {
  if (!props.chapter) return ''
  if (props.contentLength < 50) return '本章正文太短，写完后再定稿'
  const steps = '生成本章概要 → 改写角色短期记忆 → 判断是否改写长期记忆（Skill）→ 更新整体进度'
  return props.chapter.finalizedAt
    ? `本章已定稿过。重新定稿会先撤回上次定稿对记忆的改动，再重新执行：${steps}`
    : `写完本章后点击：${steps}`
})

// ===== 工具卡名称 =====
const TOOL_LABELS: Record<string, string> = {
  query_lore: '查询设定',
  search_chapters: '检索章节',
  read_story_state: '读取故事状态',
  read_context: '读取前文',
  select_characters: '选择出场角色',
  update_short_term_memory: '改写短期记忆',
  update_long_term_memory: '改写长期记忆',
  append_to_chapter: '写入正文',
  replace_tail: '重写结尾',
}
function toolLabel(tool: string): string {
  // 定稿步骤卡：finalize:<step>
  if (tool.startsWith('finalize:')) {
    const step = tool.slice('finalize:'.length) as FinalizeStep
    return `定稿 · ${FINALIZE_STEP_LABELS[step] ?? step}`
  }
  return TOOL_LABELS[tool] ?? tool
}

// ===== 快捷动作护栏 =====
const canContinuePrev = computed<boolean | null>(() => {
  if (!props.chapter) return null
  const prev = props.novel.chapters.find((c) => c.order < props.chapter!.order)
  if (!prev) return false
  // 当前章需基本为空（新开章节场景）
  return props.contentLength <= 50
})

// ===== 工具卡展开 =====
const expanded = ref<Set<string>>(new Set())
function toggleExpand(id: string) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

// ===== plan 确认 =====
function onConfirmPlan(msg: Extract<ChatMsg, { kind: 'plan' }>) {
  emit('confirmPlan', { ...msg.plan, outline: msg.outlineDraft })
}

// ===== 自动滚动（吸底，用户上滑则暂停） =====
const bodyRef = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)

function onScroll() {
  const el = bodyRef.value
  if (!el) return
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function scrollToBottom() {
  nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const lastMsg = computed(() => transcript.value[transcript.value.length - 1])
const lastMsgLen = computed(() => {
  const m = lastMsg.value
  if (!m) return 0
  if (m.kind === 'assistant') return m.text.length
  if (m.kind === 'tool')
    return (m.preview?.length ?? 0) + (m.resultText?.length ?? 0)
  return 0
})

watch([() => transcript.value.length, lastMsgLen], () => {
  if (stickToBottom.value) scrollToBottom()
})
</script>

<style scoped>
/* ============================================================
 * Agent 交互面板
 * 结构：头部 / 元信息（上下文+状态） / 滚动转录 / 固定底栏
 * 所有颜色取自 Vuetify 的 --v-theme-* 变量，跟随调色板与深色模式。
 * ============================================================ */
.agent-panel {
  --ap-line: rgba(var(--v-theme-on-surface), 0.075);
  --ap-line-strong: rgba(var(--v-theme-on-surface), 0.12);
  --ap-tint: rgba(var(--v-theme-on-surface), 0.035);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

/* ===== 头部 ===== */
.agent-panel__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--ap-line);
}
.agent-panel__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.agent-panel__title {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), 0.88);
}
.agent-panel__target {
  font-size: 10.5px !important;
  max-width: 150px;
}
.title-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.18),
    rgba(var(--v-theme-primary), 0.08)
  );
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.agent-panel__head .lg-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 9px;
}
.finalize-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  padding: 5px 11px;
  white-space: nowrap;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.09);
  border-color: rgba(var(--v-theme-primary), 0.16);
}
.finalize-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.16);
  color: rgb(var(--v-theme-primary));
}
.finalize-btn--done {
  color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.09);
  border-color: rgba(var(--v-theme-success), 0.18);
}
.finalize-btn--done:hover:not(:disabled) {
  background: rgba(var(--v-theme-success), 0.16);
  color: rgb(var(--v-theme-success));
}
.finalize-btn:disabled {
  opacity: 0.4;
}

/* ===== 上下文预算 + 状态行 ===== */
.agent-panel__meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 12px 8px;
  background: var(--ap-tint);
  border-bottom: 1px solid var(--ap-line);
}
.context-meter__top,
.context-meter__bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.context-meter__top {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 11px;
}
.context-meter__top span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.context-meter__top strong {
  color: rgb(var(--v-theme-primary));
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.context-meter__track {
  height: 4px;
  margin: 6px 0 5px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.1);
}
.context-meter__fill {
  height: 100%;
  border-radius: inherit;
  /* 只用主色的明度渐变，避免不同调色板下 tertiary 色相跳变 */
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-primary), 0.55),
    rgb(var(--v-theme-primary))
  );
  transition: width 0.35s ease;
}
.context-meter__bottom {
  color: rgba(var(--v-theme-on-surface), 0.42);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.context-meter--warning .context-meter__top strong {
  color: rgb(var(--v-theme-error));
}
.context-meter--warning .context-meter__fill {
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-error), 0.55),
    rgb(var(--v-theme-error))
  );
}
.agent-panel__status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  flex-shrink: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.07);
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
}
.agent-panel__status-text {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 转录区 ===== */
.agent-panel__body {
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px 18px;
  min-height: 0;
  scroll-padding-bottom: 12px;
}

/* 空状态：在剩余空间里垂直居中 */
.agent-panel__empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 8px;
  gap: 7px;
  width: 100%;
  max-width: 300px;
}
.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  margin-bottom: 4px;
}
.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.empty-sub {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.48);
  line-height: 1.75;
}
.empty-hints {
  margin-top: 12px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--ap-line);
  background: rgba(var(--v-theme-on-surface), 0.02);
}
.empty-hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  line-height: 1.5;
  text-align: left;
  color: rgba(var(--v-theme-on-surface), 0.58);
}
.empty-hint-item .v-icon {
  flex-shrink: 0;
  color: rgba(var(--v-theme-primary), 0.65);
}

/* 用户消息（右对齐气泡） */
.chat-user {
  display: flex;
  justify-content: flex-end;
  padding-left: 36px;
}
.chat-user__bubble {
  max-width: 100%;
  padding: 9px 13px;
  border-radius: 14px 14px 5px 14px;
  background: rgba(var(--v-theme-primary), 0.12);
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  color: rgba(var(--v-theme-on-surface), 0.9);
  font-size: 12.8px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 助手消息（头像 + 左对齐气泡） */
.chat-assistant {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-right: 24px;
}
.chat-assistant__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  margin-top: 1px;
  border-radius: 9px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.chat-assistant__bubble {
  flex: 1;
  min-width: 0;
  padding: 8px 11px;
  border-radius: 5px 14px 14px 14px;
  border: 1px solid var(--ap-line);
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.chat-assistant__text {
  font-size: 12.8px;
  line-height: 1.75;
  color: rgba(var(--v-theme-on-surface), 0.82);
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-cursor {
  color: rgb(var(--v-theme-primary));
  animation: chat-blink 1s steps(1) infinite;
}
@keyframes chat-blink {
  50% {
    opacity: 0;
  }
}

/* 工具卡片 */
.chat-tool {
  padding: 8px 10px;
  border-radius: 12px;
}
.chat-tool--running {
  border-color: rgba(var(--v-theme-primary), 0.22);
}
.chat-tool--error {
  border-color: rgba(var(--v-theme-error), 0.25);
}
.chat-tool__head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 18px;
  cursor: default;
  user-select: none;
}
/* 只有可展开的卡片才显示手型光标 */
.chat-tool__head:has(.chat-tool__chevron) {
  cursor: pointer;
}
.chat-tool__name {
  /* 中文工具名需要 CJK 回退字体，纯 monospace 会显示为方块 */
  font-family: ui-monospace, 'SF Mono', 'Menlo', var(--font-sans), monospace;
  font-size: 11.5px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
.chat-tool__summary {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  flex: 1;
  min-width: 0;
}
.chat-tool__chevron {
  color: rgba(var(--v-theme-on-surface), 0.32);
  flex-shrink: 0;
}
.chat-tool__detail {
  margin-top: 7px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--ap-line);
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 11px;
  line-height: 1.65;
  color: rgba(var(--v-theme-on-surface), 0.62);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow-y: auto;
}

/* 写章预览 */
.chat-tool__write {
  margin-top: 8px;
}
.chat-write-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 6px;
}
.chat-write-meta .v-icon {
  color: rgb(var(--v-theme-primary));
}
.chat-write-undo {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-error), 0.85);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.chat-write-undo:hover:not(:disabled) {
  background: rgba(var(--v-theme-error), 0.1);
}
.chat-write-undo:disabled {
  opacity: 0.4;
  cursor: default;
}
.chat-write-preview {
  padding: 9px 11px;
  border-radius: 11px;
  border: 1px solid rgba(var(--v-theme-primary), 0.16);
  background: rgba(var(--v-theme-primary), 0.045);
  font-size: 12.3px;
  line-height: 1.85;
  color: rgba(var(--v-theme-on-surface), 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow-y: auto;
}
.chat-write-preview--streaming {
  animation: chat-pulse 1.6s ease-in-out infinite;
}
@keyframes chat-pulse {
  50% {
    border-color: rgba(var(--v-theme-primary), 0.38);
  }
}

/* 规划卡片 */
.chat-plan {
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-radius: 14px;
}
.chat-plan--muted {
  opacity: 0.6;
}
.chat-plan__head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ap-line);
}
.chat-plan__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 7px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.chat-plan__title {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.chat-plan__tag {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.07);
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.chat-plan__tag--success {
  background: rgba(var(--v-theme-success), 0.12);
  color: rgb(var(--v-theme-success));
}
.chat-plan__tag--error {
  background: rgba(var(--v-theme-error), 0.1);
  color: rgb(var(--v-theme-error));
}
.chat-plan__pending {
  font-size: 10.5px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  animation: chat-blink 1.4s ease-in-out infinite;
}
.chat-plan__block {
  min-width: 0;
}
.chat-plan__block :deep(.v-field--variant-outlined) {
  border-radius: 11px;
}
.chat-plan__block :deep(.v-field) {
  background: rgb(var(--v-theme-surface));
}
.chat-plan__block :deep(.v-field__input) {
  font-size: 12px;
  line-height: 1.7;
  /* 显式指定文本色：Vuetify 深色主题的继承色与面板实际的浅色底不一致 */
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.chat-plan__outline {
  font-size: 12px;
  line-height: 1.75;
  color: rgba(var(--v-theme-on-surface), 0.72);
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-plan__approach {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.62);
  white-space: pre-wrap;
}
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip-wrap .v-chip {
  font-size: 10.5px !important;
}
.chat-plan__actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.chat-plan__confirm {
  flex: 1;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-color: transparent;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.2);
}
.chat-plan__confirm:hover:not(:disabled) {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  filter: brightness(1.07);
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.28);
}
.chat-plan__cancel {
  flex: 0 0 auto;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* 系统提示 */
.chat-system {
  align-self: center;
  text-align: center;
  font-size: 10.5px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.45);
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.035);
  border: 1px solid var(--ap-line);
}

/* ===== 固定底栏 ===== */
.agent-panel__foot {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--ap-line-strong);
  background: rgba(var(--v-theme-on-surface), 0.025);
  box-shadow: 0 -12px 22px -20px rgba(0, 0, 0, 0.35);
}
/* 转录区滚到底栏时给一个柔和过渡，避免内容被生硬地切断 */
.agent-panel__foot::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -14px;
  height: 14px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-surface), 0),
    rgb(var(--v-theme-surface))
  );
}

/* 快捷动作 + 目标字数：宽面板合成一行，窄面板自然换行 */
.agent-panel__quick {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.length-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.length-label {
  font-size: 11px;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.length-select {
  width: 108px;
  flex-shrink: 0;
}
.length-select :deep(.v-field) {
  background: transparent;
  min-height: 32px;
  height: 32px;
}
.length-select :deep(.v-field__input) {
  min-height: 32px;
  padding: 4px 4px 4px 8px;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.length-select :deep(.v-select__selection-text) {
  white-space: nowrap;
  color: inherit;
}
.length-hint {
  flex: 1 0 100%;
  text-align: right;
  font-size: 10.5px;
  line-height: 1.4;
  color: rgb(var(--v-theme-warning, 230, 162, 60));
}
.chip-row {
  display: flex;
  gap: 6px;
  flex: 1 1 190px;
  min-width: 0;
  max-width: 340px;
}
.quick-chip {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  padding: 5px 8px;
  white-space: nowrap;
}

/* ===== 输入区 ===== */
.agent-panel__input {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--ap-line-strong);
  background: rgb(var(--v-theme-surface));
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.agent-panel__input:focus-within {
  border-color: rgba(var(--v-theme-primary), 0.45);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.09);
}
.agent-panel__textarea :deep(.v-field__input) {
  font-size: 12.8px;
  line-height: 1.6;
  min-height: 34px;
  padding: 6px 0;
  color: rgba(var(--v-theme-on-surface), 0.88);
}
.agent-panel__textarea :deep(textarea::placeholder) {
  color: rgba(var(--v-theme-on-surface), 0.38);
}
/* 输入区在最底部，@ 提及菜单必须向上弹，否则会被卡片裁掉 */
.agent-panel__input :deep(.mention-menu) {
  top: auto;
  bottom: calc(100% + 10px);
  z-index: 20;
  max-height: 180px;
  padding: 5px;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
}
.send-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(var(--v-theme-primary), 0.28);
}
.send-btn:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.55);
  outline-offset: 2px;
}
.send-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.send-btn--stop {
  background: rgba(var(--v-theme-error), 0.14);
  color: rgb(var(--v-theme-error));
}

/* ===== 面板级自适应（按卡片真实宽度，而非视口） ===== */
@container agentcard (max-width: 400px) {
  .agent-panel__head {
    padding: 10px 10px 9px;
  }
  .agent-panel__meta {
    padding: 8px 10px 7px;
  }
  .agent-panel__body {
    padding: 12px 10px 14px;
  }
  .agent-panel__foot {
    padding: 9px 10px 10px;
  }
  .chat-user {
    padding-left: 24px;
  }
  .chat-assistant {
    padding-right: 8px;
  }
}
@container agentcard (max-width: 350px) {
  .length-label {
    display: none;
  }
  .agent-panel__target {
    max-width: 88px;
  }
  .finalize-btn {
    padding: 5px 8px;
  }
  .chip-row {
    flex-basis: 100%;
  }
}
</style>
