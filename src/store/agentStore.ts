import { defineStore } from 'pinia'
import type { AgentPlan, SessionPhase } from '@/services/agentService'
import type { StoryState } from '@/types/storyState'

export interface ToolLogEntry {
  tool: string
  status: 'running' | 'done'
  text: string
}

export const useAgentStore = defineStore('agent', () => {
  // Agent 阶段
  const phase = ref<SessionPhase>('idle')
  // 当前 plan
  const currentPlan = ref<AgentPlan | null>(null)
  // plan 确认面板是否可见
  const planDialogVisible = ref(false)
  // 状态文案
  const statusText = ref('')
  // 工具调用日志
  const toolCallLog = ref<ToolLogEntry[]>([])
  // 是否自动更新故事状态（B 方案，默认开）
  const autoUpdateStoryState = ref(true)
  // 故事状态缓存（供 CharacterPanel 等只读展示）
  const storyState = ref<StoryState | null>(null)
  // 角色面板
  const characterPanelOpen = ref(false)
  const selectedCharacterName = ref<string | null>(null)

  function setPhase(p: SessionPhase) {
    phase.value = p
  }
  function setPlan(p: AgentPlan | null) {
    currentPlan.value = p
  }
  function setStatus(s: string) {
    statusText.value = s
  }
  function addToolLog(entry: ToolLogEntry) {
    toolCallLog.value.push(entry)
  }
  function clearToolLog() {
    toolCallLog.value = []
  }
  function setStoryState(s: StoryState | null) {
    storyState.value = s
  }
  function openCharacterPanel(name: string | null) {
    selectedCharacterName.value = name
    characterPanelOpen.value = true
  }
  function closeCharacterPanel() {
    characterPanelOpen.value = false
  }
  /** 重置为 idle（保留 autoUpdateStoryState 与 storyState 缓存） */
  function resetAgent() {
    phase.value = 'idle'
    currentPlan.value = null
    planDialogVisible.value = false
    statusText.value = ''
    toolCallLog.value = []
  }

  return {
    phase,
    currentPlan,
    planDialogVisible,
    statusText,
    toolCallLog,
    autoUpdateStoryState,
    storyState,
    characterPanelOpen,
    selectedCharacterName,
    setPhase,
    setPlan,
    setStatus,
    addToolLog,
    clearToolLog,
    setStoryState,
    openCharacterPanel,
    closeCharacterPanel,
    resetAgent,
  }
})
