/**
 * chatStore.ts
 * 交互面板（Agent chat）的 UI 状态：转录消息流 / 忙碌态 / 阶段 / 状态文案。
 * 只负责 UI 状态；引擎会话对象与落盘副作用由 novel/index.vue 编排。
 */

import { defineStore } from 'pinia'
import type { AgentPlan, SessionPhase } from '@/services/agentService'
import type { ChatMsg, ChatWriteData } from '@/types/agentChat'

let idSeq = 0
function nextId(): string {
  idSeq += 1
  return `m${Date.now().toString(36)}${idSeq.toString(36)}`
}

export const useChatStore = defineStore('agentChat', () => {
  /** 转录消息流（按时间序） */
  const transcript = ref<ChatMsg[]>([])
  /** 是否有正在进行的轮次（禁用输入/快捷动作） */
  const busy = ref(false)
  /** 状态行文案（正在调研… / 正在写入…） */
  const statusText = ref('')
  /** 引擎阶段（planning/generating/awaiting_confirmation/…） */
  const phase = ref<SessionPhase>('idle')
  /** 当前转录所属章节（切换章节时重置） */
  const chapterId = ref<string | null>(null)

  // ===== 生命周期 =====
  /** 切换到某章节：chapterId 变化则清空转录 */
  function resetForChapter(id: string | null) {
    if (chapterId.value === id) return
    chapterId.value = id
    transcript.value = []
    statusText.value = ''
    phase.value = 'idle'
    busy.value = false
  }
  /** 清空对话（保留 chapterId） */
  function clear() {
    transcript.value = []
    statusText.value = ''
  }

  // ===== 消息写入 =====
  function pushUser(text: string): string {
    const msg: ChatMsg = { id: nextId(), kind: 'user', text, ts: Date.now() }
    transcript.value.push(msg)
    return msg.id
  }

  function pushSystem(text: string): string {
    const msg: ChatMsg = { id: nextId(), kind: 'system', text, ts: Date.now() }
    transcript.value.push(msg)
    return msg.id
  }

  function beginAssistant(): string {
    const msg: ChatMsg = {
      id: nextId(),
      kind: 'assistant',
      text: '',
      streaming: true,
      ts: Date.now(),
    }
    transcript.value.push(msg)
    return msg.id
  }

  function appendAssistant(id: string, delta: string) {
    const m = transcript.value.find((x) => x.id === id)
    if (m && m.kind === 'assistant') m.text += delta
  }

  function endAssistant(id: string) {
    const m = transcript.value.find((x) => x.id === id)
    if (m && m.kind === 'assistant') m.streaming = false
  }

  function pushTool(tool: string, argsSummary: string): string {
    const msg: ChatMsg = {
      id: nextId(),
      kind: 'tool',
      tool,
      status: 'running',
      argsSummary,
      ts: Date.now(),
    }
    transcript.value.push(msg)
    return msg.id
  }

  function updateTool(
    id: string,
    patch: {
      status?: 'running' | 'done' | 'error'
      argsSummary?: string
      resultText?: string
      write?: ChatWriteData
    },
  ) {
    const m = transcript.value.find((x) => x.id === id)
    if (m && m.kind === 'tool') {
      if (patch.status !== undefined) m.status = patch.status
      if (patch.argsSummary !== undefined) m.argsSummary = patch.argsSummary
      if (patch.resultText !== undefined) m.resultText = patch.resultText
      if (patch.write !== undefined) m.write = patch.write
    }
  }

  /** 写章工具实时预览（content 参数增量） */
  function setToolPreview(id: string, preview: string) {
    const m = transcript.value.find((x) => x.id === id)
    if (m && m.kind === 'tool') m.preview = preview
  }

  // ===== plan 卡片 =====
  function pushPlan(plan: AgentPlan): string {
    // 新的待确认 plan 出现时，旧的 pending 卡标记为「已更新」
    for (const m of transcript.value) {
      if (m.kind === 'plan' && m.status === 'pending') m.status = 'superseded'
    }
    const msg: ChatMsg = {
      id: nextId(),
      kind: 'plan',
      plan,
      outlineDraft: plan.outline,
      status: 'pending',
      ts: Date.now(),
    }
    transcript.value.push(msg)
    return msg.id
  }

  function updatePlan(
    id: string,
    patch: Partial<{
      outlineDraft: string
      status: 'pending' | 'confirmed' | 'cancelled' | 'superseded'
    }>,
  ) {
    const m = transcript.value.find((x) => x.id === id)
    if (m && m.kind === 'plan') {
      if (patch.outlineDraft !== undefined) m.outlineDraft = patch.outlineDraft
      if (patch.status !== undefined) m.status = patch.status
    }
  }

  /** 取当前 pending 的 plan 卡（同一时刻最多一张） */
  function getPendingPlan(): Extract<ChatMsg, { kind: 'plan' }> | null {
    for (let i = transcript.value.length - 1; i >= 0; i--) {
      const m = transcript.value[i]
      if (m.kind === 'plan' && m.status === 'pending') return m
    }
    return null
  }

  // ===== 状态 =====
  function setBusy(b: boolean) {
    busy.value = b
  }
  function setStatus(s: string) {
    statusText.value = s
  }
  function setPhase(p: SessionPhase) {
    phase.value = p
  }

  return {
    transcript,
    busy,
    statusText,
    phase,
    chapterId,
    resetForChapter,
    clear,
    pushUser,
    pushSystem,
    beginAssistant,
    appendAssistant,
    endAssistant,
    pushTool,
    updateTool,
    setToolPreview,
    pushPlan,
    updatePlan,
    getPendingPlan,
    setBusy,
    setStatus,
    setPhase,
  }
})
