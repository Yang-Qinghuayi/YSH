<template>
  <div class="agent-panel d-flex flex-column">
    <!-- ===== 头部 ===== -->
    <div class="agent-panel__head">
      <span class="title-badge">
        <v-icon :icon="mdiRobotOutline" size="18" />
      </span>
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
      <v-spacer />
      <button
        class="lg-icon-btn"
        title="清空对话"
        :disabled="!transcript.length"
        @click="$emit('clearChat')"
      >
        <v-icon :icon="mdiDeleteOutline" size="16" />
      </button>
    </div>

    <!-- ===== 上下文预算 ===== -->
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

    <!-- ===== 状态行 ===== -->
    <div v-if="chatStore.busy" class="agent-panel__status lg-card--inset">
      <v-progress-circular indeterminate size="13" width="2" color="primary" />
      <span class="agent-panel__status-text">{{
        chatStore.statusText || '正在处理…'
      }}</span>
    </div>

    <!-- ===== 转录区 ===== -->
    <div ref="bodyRef" class="agent-panel__body flex-1" @scroll="onScroll">
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
          <div class="chat-assistant__text">
            {{ msg.text
            }}<span v-if="msg.streaming" class="chat-cursor">▍</span>
          </div>
        </div>

        <!-- 工具卡片 -->
        <div v-else-if="msg.kind === 'tool'" class="chat-tool lg-card--inset">
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
            <span class="chat-tool__name">{{ msg.tool }}</span>
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
              class="chat-write-preview"
              :class="{ 'chat-write-preview--streaming': !msg.write }"
            >
              {{ msg.preview }}
            </div>
          </div>

          <!-- 展开细节 -->
          <div
            v-if="expanded.has(msg.id) && msg.resultText"
            class="chat-tool__detail"
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
            <v-icon :icon="mdiPencilOutline" size="15" />
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

    <!-- ===== 快捷动作 + 目标字数 ===== -->
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
        <span v-if="chapter && canContinuePrev === false" class="length-hint"
          >「续写上一章」需当前章基本为空</span
        >
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
  mdiGauge,
} from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/store/chatStore'
import { useSettingStore } from '@/store/setting'
import type { AgentPlan } from '@/services/agentService'
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
.agent-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 10px 10px;
}

/* ===== 头部 ===== */
.agent-panel__head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 4px;
  flex-shrink: 0;
}
.agent-panel__title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.agent-panel__target {
  font-size: 11px !important;
  max-width: 130px;
}
.title-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
.agent-panel__head .lg-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  margin-left: auto;
}

/* ===== 上下文预算 ===== */
.context-meter {
  flex-shrink: 0;
  padding: 9px 11px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.025);
}
.context-meter__top, .context-meter__bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.context-meter__top { color: rgba(var(--v-theme-on-surface), .68); font-size: 11px; }
.context-meter__top span { display: flex; align-items: center; gap: 5px; }
.context-meter__top strong { color: rgb(var(--v-theme-primary)); font-size: 12px; }
.context-meter__track { height: 5px; margin: 7px 0 5px; border-radius: 5px; overflow: hidden; background: rgba(var(--v-theme-on-surface), .09); }
.context-meter__fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, rgb(var(--v-theme-primary)), #62c99b); transition: width .35s ease; }
.context-meter__bottom { color: rgba(var(--v-theme-on-surface), .42); font-size: 10px; }
.context-meter--warning .context-meter__top strong { color: rgb(var(--v-theme-error)); }
.context-meter--warning .context-meter__fill { background: linear-gradient(90deg, #e6a23c, rgb(var(--v-theme-error))); }

/* ===== 状态行 ===== */
.agent-panel__status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  flex-shrink: 0;
  border-width: 1px;
}
.agent-panel__status-text {
  font-size: 12px;
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
  gap: 10px;
  padding: 2px 4px 8px;
  min-height: 0;
}

/* 空状态 */
.agent-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 36px 16px;
  gap: 6px;
}
.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  margin-bottom: 4px;
}
.empty-title {
  font-size: 14.5px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.empty-sub {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  line-height: 1.7;
  max-width: 240px;
}
.empty-hints {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-start;
}
.empty-hint-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.empty-hint-item .v-icon {
  color: rgba(var(--v-theme-primary), 0.6);
}

/* 用户消息（右对齐胶囊） */
.chat-user {
  display: flex;
  justify-content: flex-end;
}
.chat-user__bubble {
  max-width: 88%;
  padding: 8px 12px;
  border-radius: 14px 14px 4px 14px;
  background: rgba(var(--v-theme-primary), 0.13);
  color: rgba(var(--v-theme-on-surface), 0.88);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 助手文本 */
.chat-assistant__text {
  font-size: 13px;
  line-height: 1.75;
  color: rgba(var(--v-theme-on-surface), 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0 2px;
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
  padding: 7px 10px;
  border-width: 1px;
}
.chat-tool__head {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;
}
.chat-tool__name {
  font-family: ui-monospace, 'SF Mono', 'Menlo', monospace;
  font-size: 11.5px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
.chat-tool__summary {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  flex: 1;
  min-width: 0;
}
.chat-tool__chevron {
  color: rgba(var(--v-theme-on-surface), 0.3);
  flex-shrink: 0;
}
.chat-tool__detail {
  margin-top: 6px;
  padding: 7px 9px;
  border-radius: 9px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 11px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.62);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow-y: auto;
}

/* 写章预览 */
.chat-tool__write {
  margin-top: 7px;
}
.chat-write-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 5px;
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
  padding: 1px 4px;
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
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  background: rgba(var(--v-theme-primary), 0.05);
  font-size: 12.5px;
  line-height: 1.8;
  color: rgba(var(--v-theme-on-surface), 0.78);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow-y: auto;
}
.chat-write-preview--streaming {
  animation: chat-pulse 1.6s ease-in-out infinite;
}
@keyframes chat-pulse {
  50% {
    border-color: rgba(var(--v-theme-primary), 0.35);
  }
}

/* plan 卡片 */
.chat-plan {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chat-plan--muted {
  opacity: 0.55;
}
.chat-plan__head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.chat-plan__head .v-icon {
  color: rgb(var(--v-theme-primary));
}
.chat-plan__title {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.8);
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
.chat-plan__block :deep(.v-field--variant-outlined) {
  border-radius: 11px;
}
.chat-plan__outline {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-plan__approach {
  font-size: 12px;
  line-height: 1.65;
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
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.25);
  font-weight: 600;
}
.chat-plan__confirm:hover {
  background: rgba(var(--v-theme-primary), 0.18);
}
.chat-plan__cancel {
  flex: 0 0 auto;
}

/* 系统提示 */
.chat-system {
  text-align: center;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  padding: 2px 0;
}

/* ===== 快捷动作 + 目标字数 ===== */
.agent-panel__quick {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.length-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.length-label {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  flex-shrink: 0;
}
.length-select {
  width: 104px;
  flex-shrink: 0;
}
.length-select :deep(.v-field) {
  background: transparent;
}
.length-hint {
  font-size: 10.5px;
  color: rgba(var(--v-theme-warning, 255, 179, 0), 0.9);
  line-height: 1.4;
}
.chip-row {
  display: flex;
  gap: 6px;
}
.quick-chip {
  flex: 1;
  font-size: 11.5px;
  padding: 6px 8px;
}
.quick-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ===== 输入区 ===== */
.agent-panel__input {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-on-surface), 0.03);
  transition: border-color 0.2s ease;
}
.agent-panel__input:focus-within {
  border-color: rgba(var(--v-theme-primary), 0.45);
}
.agent-panel__textarea :deep(.v-field__input) {
  font-size: 13px;
  padding: 2px 0;
}
.send-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.send-btn:hover:not(:disabled) {
  transform: scale(1.04);
}
.send-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.send-btn--stop {
  background: rgba(var(--v-theme-error), 0.14);
  color: rgb(var(--v-theme-error));
}
</style>
