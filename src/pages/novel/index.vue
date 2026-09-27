<template>
  <div class="novel-root">
    <!-- 未选择工作区时：显示选择界面 -->
    <WorkspaceInit
      v-if="!workspaceReady"
      @done="handleWorkspaceReady"
      class="h-100"
    />

    <div v-else class="novel-page d-flex h-100">
      <!-- ===== 主编辑区 ===== -->
      <div class="editor-main flex-1 d-flex flex-column overflow-hidden">
        <!-- 顶部小说概览栏 -->
        <NovelOverviewBar
          v-if="currentNovel"
          :novel="currentNovel"
          :has-chapter="!!currentChapter"
          @open-folder="handleOpenFolder"
          @view-state="showStoryStateDialog = true"
          @view-summary="showChapterSummaryDialog = true"
          @open-settings="showEditorSettings = true"
          @switch-novel="switchNovel"
        />

        <!-- 未选择章节时的占位 -->
        <div v-if="!currentChapter" class="empty-stage">
          <div class="empty-card lg-card">
            <div class="empty-icon">
              <v-icon
                :icon="currentNovel ? mdiPenPlus : mdiBookPlus"
                size="44"
              />
            </div>
            <div class="empty-title">
              {{ currentNovel ? '开始创作新章节' : '开启你的第一部小说' }}
            </div>
            <div class="empty-sub">
              {{
                currentNovel
                  ? '在左侧选择章节，或新建一章开始写作'
                  : '在左侧新建一部小说，开启 AI 辅助写作之旅'
              }}
            </div>
            <div v-if="!currentNovel" class="empty-actions">
              <button class="lg-pill empty-btn" @click="switchNovel">
                <v-icon :icon="mdiPlus" size="16" />
                新建 / 打开小说
              </button>
              <button
                class="lg-pill empty-btn empty-btn--ghost"
                @click="showImportDialog = true"
              >
                <v-icon :icon="mdiImport" size="16" />
                导入小说
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <!-- 编辑器 -->
          <NovelEditor
            ref="editorRef"
            class="flex-1"
            style="min-height: 0"
            :chapter="currentChapter"
            :content="currentChapterContent"
            :characters="currentNovel?.characters ?? []"
            :is-generating="isGenerating"
            @update:content="handleContentChange"
            @stop-generate="handleChatStop"
            @open-search="showGlobalSearch = true"
          />
        </template>
      </div>

      <!-- ===== 右侧栏（可折叠为图标 rail；目录 / Agent 双视图） ===== -->
      <aside
        class="novel-sidebar"
        :class="{
          'novel-sidebar--rail': sidebarCollapsed,
          'novel-sidebar--agent': !sidebarCollapsed && sidebarTab === 'agent',
        }"
      >
        <!-- 折叠态：图标 rail -->
        <div v-if="sidebarCollapsed" class="rail">
          <button
            class="lg-icon-btn rail-toggle"
            title="展开侧栏"
            @click="sidebarCollapsed = false"
          >
            <v-icon :icon="mdiMenuClose" size="18" />
          </button>
          <button
            class="rail-avatar"
            :class="{ 'rail-avatar--active': currentNovel }"
            :title="currentNovel ? currentNovel.title : '切换小说'"
            @click="switchNovel"
          >
            {{ currentNovel ? currentNovel.title.slice(0, 1) : '书' }}
          </button>
          <button
            class="lg-icon-btn"
            :class="{ 'rail-active': sidebarTab === 'agent' }"
            title="Agent"
            :disabled="!currentNovel"
            @click="openAgentTab"
          >
            <v-icon :icon="mdiRobotOutline" size="18" />
          </button>
          <button
            class="lg-icon-btn"
            title="章节"
            :disabled="!currentNovel"
            @click="sidebarCollapsed = false"
          >
            <v-icon :icon="mdiFormatListBulleted" size="18" />
          </button>
          <button
            class="lg-icon-btn"
            title="角色"
            :disabled="!currentNovel"
            @click="onOpenCharacters"
          >
            <v-icon :icon="mdiAccountGroupOutline" size="18" />
          </button>
          <button
            class="lg-icon-btn"
            title="设定"
            :disabled="!currentNovel"
            @click="onOpenLore"
          >
            <v-icon :icon="mdiBookshelf" size="18" />
          </button>
        </div>

        <!-- 展开态：目录卡片 / Agent 交互面板 -->
        <template v-else>
          <!-- 视图切换 Tab（目录 / Agent） -->
          <div class="sidebar-tabs lg-card">
            <button
              class="sidebar-tab"
              :class="{ 'sidebar-tab--active': sidebarTab === 'menu' }"
              @click="sidebarTab = 'menu'"
            >
              <v-icon :icon="mdiFormatListBulleted" size="13" /> 目录
            </button>
            <button
              class="sidebar-tab"
              :class="{ 'sidebar-tab--active': sidebarTab === 'agent' }"
              @click="sidebarTab = 'agent'"
            >
              <v-icon :icon="mdiRobotOutline" size="13" /> Agent
            </button>
            <button
              class="lg-icon-btn collapse-inline"
              title="折叠侧栏"
              @click="sidebarCollapsed = true"
            >
              <v-icon :icon="mdiMenuOpen" size="16" />
            </button>
          </div>

          <!-- ===== Agent 交互面板 ===== -->
          <AgentChatPanel
            v-if="sidebarTab === 'agent' && currentNovel"
            class="agent-sidebar-card lg-card flex-1"
            :novel="currentNovel"
            :chapter="currentChapterMeta"
            :content-length="currentChapterContent.length"
            @send="handleChatSend"
            @quick-action="handleChatQuickAction"
            @stop="handleChatStop"
            @confirm-plan="handleChatConfirmPlan"
            @cancel-plan="handleChatCancelPlan"
            @undo-write="handleChatUndoWrite"
            @clear-chat="handleChatClear"
            @finalize="handleFinalizeChapter"
          />
          <div
            v-else-if="sidebarTab === 'agent'"
            class="agent-sidebar-card lg-card d-flex align-center justify-center flex-1"
          >
            <span class="empty-hint">未打开小说</span>
          </div>

          <!-- ===== 目录视图：分组玻璃卡片 ===== -->
          <template v-else>
            <!-- 当前小说区：标题 + 切换/导入入口 -->
            <div class="sidebar-card lg-card">
              <div class="sidebar-card__head">
                <v-icon
                  :icon="mdiBookOpenVariant"
                  size="14"
                  class="lg-section-label"
                />
                <span class="lg-section-label">当前小说</span>
              </div>
              <div class="current-novel-box">
                <div
                  v-if="currentNovel"
                  class="current-novel-title text-truncate"
                >
                  {{ currentNovel.title }}
                </div>
                <div
                  v-else
                  class="current-novel-title current-novel-title--empty"
                >
                  未打开小说
                </div>
                <div class="current-novel-actions">
                  <button class="lg-pill mini-action" @click="switchNovel">
                    <v-icon :icon="mdiSwapHorizontal" size="13" /> 切换
                  </button>
                  <button
                    class="lg-pill mini-action mini-action--ghost"
                    @click="showImportDialog = true"
                  >
                    <v-icon :icon="mdiImport" size="13" /> 导入
                  </button>
                </div>
              </div>
            </div>

            <!-- 章节区 -->
            <div v-if="currentNovel" class="sidebar-card lg-card">
              <div class="sidebar-card__head">
                <v-icon
                  :icon="mdiFormatListBulleted"
                  size="14"
                  class="lg-section-label"
                />
                <span class="lg-section-label">章节</span>
              </div>
              <ChapterList
                ref="chapterListRef"
                :chapters="currentNovel.chapters"
                :current-chapter-id="currentChapter?.id"
                @select="handleSelectChapter"
                @delete="handleDeleteChapter"
                @create="handleCreateChapter"
              />
            </div>

            <!-- 角色区 -->
            <div
              v-if="currentNovel"
              class="sidebar-card lg-card sidebar-card--clickable"
              @click="showCharacterDialog = true"
            >
              <div class="sidebar-card__head">
                <v-icon
                  :icon="mdiAccountGroupOutline"
                  size="14"
                  class="lg-section-label"
                />
                <span class="lg-section-label">角色</span>
              </div>
              <div class="chip-wrap">
                <v-chip
                  v-for="char in currentNovel.characters"
                  :key="char.id"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="chip-item chip-clickable"
                  @click.stop="agentStore.openCharacterPanel(char.name)"
                >
                  {{ char.name }}
                </v-chip>
                <span v-if="!currentNovel.characters.length" class="empty-hint"
                  >暂无角色</span
                >
              </div>
            </div>

            <!-- 设定资料库区 -->
            <div
              v-if="currentNovel"
              class="sidebar-card lg-card sidebar-card--clickable"
              @click="showLorePanel = true"
            >
              <div class="sidebar-card__head">
                <v-icon
                  :icon="mdiBookshelf"
                  size="14"
                  class="lg-section-label"
                />
                <span class="lg-section-label">设定</span>
              </div>
              <div class="chip-wrap">
                <v-chip
                  v-for="entry in loreEntries"
                  :key="entry.id"
                  size="x-small"
                  color="info"
                  variant="tonal"
                  class="chip-item chip-clickable"
                  @click.stop="openLoreAt(entry.id)"
                >
                  {{ entry.name }}
                </v-chip>
                <span v-if="!loreEntries.length" class="empty-hint"
                  >暂无设定</span
                >
              </div>
            </div>
          </template>
        </template>
      </aside>

      <!-- ===== 弹窗 ===== -->
      <CharacterDialog
        v-if="currentNovel"
        v-model="showCharacterDialog"
        :characters="currentNovel.characters"
        @update:characters="handleUpdateCharacters"
      />

      <!-- 全局搜索浮窗 -->
      <GlobalSearch
        v-if="currentNovel"
        v-model:visible="showGlobalSearch"
        :chapters="currentNovel.chapters"
        :search-fn="searchInChapters"
        @jump="handleSearchJump"
      />

      <!-- 角色面板（长期记忆 Skill + 短期记忆 POV） -->
      <CharacterPanel
        v-if="currentNovel"
        :characters="currentNovel.characters"
        :chapters="currentNovel.chapters"
        @update:character="handleUpdateSingleCharacter"
        @update:memory="handleUpdateShortTermMemory"
      />

      <!-- 设定资料库面板 -->
      <LorePanel
        v-if="currentNovel"
        v-model:visible="showLorePanel"
        :novel="currentNovel"
        :focus-entry-id="pendingLoreEntryId"
        @saved="reloadLoreEntries"
      />

      <!-- 故事状态查看/编辑弹窗 -->
      <StoryStateDialog
        v-if="currentNovel"
        v-model="showStoryStateDialog"
        :novel-id="currentNovel.id"
        :characters="currentNovel.characters"
        :chapters="currentNovel.chapters"
        @revert="handleRevertLongTerm"
      />

      <!-- 本章概要 -->
      <ChapterSummaryDialog
        v-model="showChapterSummaryDialog"
        :chapter="currentChapterMeta"
        :finalizing="finalizing"
        :busy="chatStore.busy || isGenerating"
        @save="handleSaveChapterSummary"
        @finalize="handleFinalizeFromSummaryDialog"
      />

      <!-- 导入小说对话框 -->
      <ImportNovelDialog
        v-model:visible="showImportDialog"
        @imported="handleImported"
      />

      <!-- 编辑器设置弹窗 -->
      <v-dialog v-model="showEditorSettings" max-width="420">
        <div class="lg-card settings-dialog">
          <div class="settings-header">
            <span class="settings-title">编辑器设置</span>
            <button class="lg-icon-btn" @click="showEditorSettings = false">
              <v-icon :icon="mdiClose" size="16" />
            </button>
          </div>
          <div class="settings-body">
            <!-- 字号 -->
            <div class="setting-row">
              <div class="setting-label">
                <span class="setting-name">编辑区字号</span>
                <span class="setting-value"
                  >{{ settingStore.editorFontSize }}px</span
                >
              </div>
              <v-slider
                :model-value="settingStore.editorFontSize"
                :min="14"
                :max="24"
                :step="1"
                color="primary"
                track-size="3"
                thumb-size="16"
                hide-details
                @update:model-value="settingStore.editorFontSize = $event"
              />
              <div class="setting-range-labels">
                <span>14px</span>
                <span>24px</span>
              </div>
            </div>

            <!-- AI 写作 -->
            <div class="setting-divider" />
            <div class="setting-section-title">AI 写作（DeepSeek）</div>
            <v-text-field
              v-model="apiKey"
              label="DeepSeek API Key"
              placeholder="sk-..."
              variant="outlined"
              density="compact"
              :type="showApiKey ? 'text' : 'password'"
              :append-inner-icon="showApiKey ? mdiEyeOff : mdiEye"
              hint="API Key is required for AI writing"
              persistent-hint
              @click:append-inner="showApiKey = !showApiKey"
            />
            <div class="key-row">
              <v-switch
                v-model="rememberApiKey"
                color="primary"
                density="compact"
                hide-details
                label="记住 API Key"
                class="key-switch"
              />
              <button
                v-if="apiKey"
                class="lg-pill mini-action key-clear"
                @click="clearApiKey"
              >
                清除
              </button>
            </div>
            <div class="model-warn">
              关闭「记住」后 Key 只保存在本次会话，关闭窗口即失效。Key
              存储在浏览器/本机存储中（Web 部署请使用受限或限额 Key），除
              api.deepseek.com 外不会发往任何服务。
            </div>
            <v-select
              v-model="settingStore.deepseekModel"
              label="模型"
              :items="modelOptions"
              variant="outlined"
              density="compact"
            />
            <div
              v-if="settingStore.deepseekModel === 'deepseek-reasoner'"
              class="model-warn"
            >
              深度推理模型不支持工具调用，Agent
              将跳过资料检索循环，改为「直读上下文」模式规划（检索能力受限）。
            </div>
            <div class="settings-note">
              章节概要、角色记忆与整体进度不会在 AI 写完后自动更新；写完一章后，在 Agent 面板点「本章定稿」统一更新。
            </div>
          </div>
        </div>
      </v-dialog>

      <!-- 错误提示 -->
      <v-snackbar
        v-model="showError"
        :color="snackColor"
        timeout="6000"
        location="top"
      >
        {{ errorMessage }}
      </v-snackbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  mdiPenPlus,
  mdiBookPlus,
  mdiPlus,
  mdiMenuOpen,
  mdiMenuClose,
  mdiBookOpenVariant,
  mdiFormatListBulleted,
  mdiAccountGroupOutline,
  mdiBookshelf,
  mdiImport,
  mdiSwapHorizontal,
  mdiClose,
  mdiEye,
  mdiEyeOff,
  mdiRobotOutline,
} from '@mdi/js'
import { useNovelStore } from '@/store/novelStore'
import { useSettingStore } from '@/store/setting'
import { useAgentStore } from '@/store/agentStore'
import { useChatStore } from '@/store/chatStore'
import {
  loadCurrentNovel,
  createNovel,
  saveNovelMeta,
  loadChapterContent,
  saveChapterContent,
  createChapter,
  deleteChapter,
  countWords,
  loadAllChapterWordCounts,
  searchInChapters,
} from '@/services/novelService'
import { parseMentions } from '@/services/deepseekService'
import type {
  AgentSession,
  AgentPlan,
  AgentConfig,
} from '@/services/agentService'
import {
  createChatSession,
  abortChatSession,
  runChatTurn,
  runChatGenerateTurn,
  buildContinuePrevTask,
  buildContinueCurrentTask,
  buildVirtualWrite,
  restoreSessionMessages,
  loadChatSessionFile,
  saveChatSessionFile,
  deleteChatSessionFile,
  type ChatTurnCallbacks,
} from '@/services/agentChat'
import type { ChatWriteData } from '@/types/agentChat'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import {
  revertLongTermChange,
  setShortTermMemory,
  renameCharactersInState,
} from '@/services/storyMemory'
import {
  runChapterFinalize,
  type FinalizeStep,
  type FinalizeResult,
} from '@/services/chapterFinalize'
import { PLAN_BLOCK_PATTERN } from '@/services/agentProtocol'
import { loadOrCreateLore } from '@/services/loreService'
import {
  isWorkspaceInitialized,
  getWorkspaceDir,
  getDirName,
} from '@/services/workspaceService'
import { isTauriAppPlatform } from '@/services/environment'
import { openPath } from '@tauri-apps/plugin-opener'
import type { Novel, ChapterMeta, Character, SearchResult } from '@/types/novel'
import type { EntryMeta } from '@/types/lore'
import WorkspaceInit from '@/components/WorkspaceInit.vue'
import ChapterList from './components/ChapterList.vue'
import NovelEditor from './components/NovelEditor.vue'
import NovelOverviewBar from './components/NovelOverviewBar.vue'
import CharacterDialog from './components/CharacterDialog.vue'
import AgentChatPanel from './components/AgentChatPanel.vue'
import CharacterPanel from './components/CharacterPanel.vue'
import LorePanel from './components/LorePanel.vue'
import StoryStateDialog from './components/StoryStateDialog.vue'
import ChapterSummaryDialog from './components/ChapterSummaryDialog.vue'
import ImportNovelDialog from './components/ImportNovelDialog.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import { useDialogEsc } from '@/hooks/useDialogEsc'
import { useApiKey } from '@/hooks/useApiKey'

// ===== Store =====
const novelStore = useNovelStore()
const settingStore = useSettingStore()
const agentStore = useAgentStore()
const chatStore = useChatStore()
const { apiKey, remember: rememberApiKey, clear: clearApiKey } = useApiKey()

const {
  currentNovel,
  currentChapter,
  currentChapterContent,
  isDirty,
  isGenerating,
} = storeToRefs(novelStore)

// ===== 工作区状态 =====
const workspaceReady = ref(isWorkspaceInitialized())
const isTauri = isTauriAppPlatform()

// ===== 本地状态 =====
const showCharacterDialog = ref(false)
const showError = ref(false)
const errorMessage = ref('')
const showGlobalSearch = ref(false)
const showApiKey = ref(false)
const showLorePanel = ref(false)
const showImportDialog = ref(false)
const showStoryStateDialog = ref(false)
const showChapterSummaryDialog = ref(false)
const showEditorSettings = ref(false)
const snackColor = ref<'error' | 'warning'>('error')
useDialogEsc(showEditorSettings)
const loreEntries = ref<EntryMeta[]>([])
const pendingLoreEntryId = ref<string | null>(null)

const editorRef = ref<InstanceType<typeof NovelEditor> | null>(null)
const chapterListRef = ref<InstanceType<typeof ChapterList> | null>(null)

// ===== 侧栏折叠 =====
const sidebarCollapsed = ref(false)

const modelOptions = [
  { title: 'deepseek-chat（通用，速度快）', value: 'deepseek-chat' },
  { title: 'deepseek-reasoner（深度推理，更慢）', value: 'deepseek-reasoner' },
]

function onOpenCharacters() {
  sidebarCollapsed.value = false
  showCharacterDialog.value = true
}
function onOpenLore() {
  sidebarCollapsed.value = false
  showLorePanel.value = true
}

/** 点击侧栏设定 chip：打开面板并定位到该条目 */
function openLoreAt(entryId: string) {
  pendingLoreEntryId.value = entryId
  showLorePanel.value = true
}

/** 加载当前小说的 lore 条目列表缓存（供侧栏 chip 展示） */
async function loadLoreEntries(novel: Novel) {
  try {
    const lore = await loadOrCreateLore(novel)
    loreEntries.value = lore.entries
  } catch {
    loreEntries.value = []
  }
}

/** LorePanel 保存后刷新侧栏 chip */
function reloadLoreEntries() {
  if (currentNovel.value) loadLoreEntries(currentNovel.value)
}

// ===== 侧栏视图（目录 / Agent） =====
const sidebarTab = ref<'menu' | 'agent'>('menu')

/** rail 的 🤖 按钮：展开侧栏并切到 Agent 视图 */
function openAgentTab() {
  sidebarCollapsed.value = false
  sidebarTab.value = 'agent'
}

// ===== Agent 交互面板（chat）状态 =====
const chatSession = ref<AgentSession | null>(null)

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// ===== 初始化 =====
onMounted(async () => {
  if (workspaceReady.value) {
    await loadCurrentNovelData()
  }

  // Cmd+Shift+F / Ctrl+Shift+F 唤起全局搜索（独立监听，绕过 useShortcuts 的 contentEditable 过滤）
  function handleGlobalSearchKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault()
      if (currentNovel.value) showGlobalSearch.value = true
    }
  }
  window.addEventListener('keydown', handleGlobalSearchKey)
  onBeforeUnmount(() =>
    window.removeEventListener('keydown', handleGlobalSearchKey),
  )
})

/**
 * 加载当前小说文件夹的数据。
 * 若文件夹里没有 novel.json（空文件夹），创建一本新小说：
 *   标题优先用传入的 title（Web 兜底「使用默认存储位置」时由用户输入），
 *   其次用文件夹名，最后兜底「未命名小说」。
 */
async function loadCurrentNovelData(title?: string) {
  try {
    let novel = await loadCurrentNovel()
    if (!novel) {
      const dir = getWorkspaceDir()
      const fallbackTitle =
        title ||
        (dir ? await getDirName(dir).catch(() => '未命名小说') : '未命名小说')
      novel = await createNovel(fallbackTitle, '')
    }
    novelStore.openNovel(novel)
    // 加载故事状态到缓存（供角色面板展示）
    loadStoryState(novel.id)
      .then((s) => agentStore.setStoryState(s))
      .catch(() => {})
    // 加载设定资料库条目缓存（供侧栏 chip 展示）
    loadLoreEntries(novel)
    // 后台异步加载尚未计算字数的章节
    loadMissingWordCounts(novel)
  } catch (e) {
    showErrorMsg(
      '加载小说失败：' + (e instanceof Error ? e.message : String(e)),
    )
  }
}

/** WorkspaceInit 完成（选/建好小说文件夹）后加载该小说 */
async function handleWorkspaceReady(title?: string) {
  workspaceReady.value = true
  await loadCurrentNovelData(title)
}

/** 切换小说：保存当前章节后回到选择界面 */
async function switchNovel() {
  await trySaveCurrentChapter()
  if (chatStore.busy && chatSession.value) abortChatSession(chatSession.value)
  chatStore.resetForChapter(null)
  chatSession.value = null
  novelStore.openNovel(null)
  loreEntries.value = []
  workspaceReady.value = false
}

/** 在系统文件管理器中打开当前小说文件夹（仅 Tauri） */
async function handleOpenFolder() {
  const dir = getWorkspaceDir()
  if (!dir) return
  try {
    await openPath(dir)
  } catch (e) {
    showErrorMsg(
      '打开文件夹失败：' + (e instanceof Error ? e.message : String(e)),
    )
  }
}

/** 后台读取未计算字数的章节，填充 wordCount 并持久化到 novel.json */
async function loadMissingWordCounts(novel: Novel) {
  const missing = novel.chapters.filter((c) => c.wordCount === undefined)
  if (!missing.length) return
  try {
    const wcMap = await loadAllChapterWordCounts(missing)
    // 确保用户没有切换到其他小说
    if (!currentNovel.value || currentNovel.value.id !== novel.id) return
    const updatedNovel: Novel = {
      ...currentNovel.value,
      chapters: currentNovel.value.chapters.map((c) => ({
        ...c,
        wordCount: wcMap.has(c.id) ? wcMap.get(c.id) : c.wordCount,
      })),
    }
    novelStore.updateCurrentNovel(updatedNovel)
    await saveNovelMeta(updatedNovel)
  } catch {
    // 字数加载失败不影响主流程
  }
}

/** 导入小说完成：导入流程已切换到新小说文件夹，直接加载当前小说 */
async function handleImported(_novel: Novel) {
  showImportDialog.value = false
  await loadCurrentNovelData()
}

// ===== 章节操作 =====
async function handleSelectChapter(chapter: ChapterMeta) {
  if (currentChapter.value?.id === chapter.id) return
  await trySaveCurrentChapter()
  try {
    const content = await loadChapterContent(chapter.filename)
    novelStore.openChapter(chapter, content)
    void loadChatSessionForChapter()
  } catch (e) {
    showErrorMsg(
      '加载章节失败：' + (e instanceof Error ? e.message : String(e)),
    )
  }
}

async function handleCreateChapter(title: string) {
  if (!currentNovel.value) return
  try {
    const { novel, chapter } = await createChapter(currentNovel.value, title)
    novelStore.updateCurrentNovel(novel)
    novelStore.openChapter(chapter, '')
    void loadChatSessionForChapter()
  } catch (e) {
    showErrorMsg(
      '创建章节失败：' + (e instanceof Error ? e.message : String(e)),
    )
  }
}

async function handleDeleteChapter(chapterId: string) {
  if (!currentNovel.value) return
  try {
    const updatedNovel = await deleteChapter(currentNovel.value, chapterId)
    novelStore.updateCurrentNovel(updatedNovel)
    if (currentChapter.value?.id === chapterId) {
      novelStore.openChapter(null as unknown as ChapterMeta, '')
      void loadChatSessionForChapter()
    }
  } catch (e) {
    showErrorMsg(
      '删除章节失败：' + (e instanceof Error ? e.message : String(e)),
    )
  }
}

// ===== 内容编辑 =====
function handleContentChange(content: string) {
  novelStore.updateContent(content)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => handleSave(), 2000)
}

async function handleSave() {
  if (!currentNovel.value || !currentChapter.value) return
  try {
    await saveChapterContent(
      currentChapter.value.filename,
      currentChapterContent.value,
    )
    // 保存时同步更新字数，并持久化到 novel.json
    const wc = countWords(currentChapterContent.value)
    const chapterId = currentChapter.value.id
    const updatedNovel: Novel = {
      ...currentNovel.value,
      chapters: currentNovel.value.chapters.map((c) =>
        c.id === chapterId ? { ...c, wordCount: wc } : c,
      ),
    }
    novelStore.updateCurrentNovel(updatedNovel)
    await saveNovelMeta(updatedNovel)
    novelStore.markSaved()
  } catch (e) {
    showErrorMsg('保存失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function trySaveCurrentChapter() {
  if (isDirty.value && currentNovel.value && currentChapter.value) {
    await handleSave()
  }
}

// ===== 角色管理 =====
async function handleUpdateCharacters(characters: Character[]) {
  if (!currentNovel.value) return
  // 故事状态按角色名关联：改名时同步短期记忆 / 改写日志
  const renames: Record<string, string> = {}
  for (const c of characters) {
    const prev = currentNovel.value.characters.find((x) => x.id === c.id)
    if (prev && prev.name !== c.name && c.name.trim()) renames[prev.name] = c.name
  }
  const updated = { ...currentNovel.value, characters }
  novelStore.updateCurrentNovel(updated)
  await saveNovelMeta(updated).catch((e) =>
    showErrorMsg('保存角色失败：' + e.message),
  )
  if (Object.keys(renames).length) {
    try {
      const state = await loadStoryState(updated.id)
      agentStore.setStoryState(
        await saveStoryState(renameCharactersInState(state, renames)),
      )
    } catch (e) {
      showErrorMsg('同步角色记忆失败：' + errorText(e))
    }
  }
}

// ===== 全局搜索 =====
async function handleSearchJump(result: SearchResult) {
  showGlobalSearch.value = false
  if (!currentNovel.value) return

  // 找到目标章节元数据
  const chapter = currentNovel.value.chapters.find(
    (c) => c.id === result.chapterId,
  )
  if (!chapter) return

  // 如果不是当前章节，先切换
  if (currentChapter.value?.id !== chapter.id) {
    await trySaveCurrentChapter()
    try {
      const content = await loadChapterContent(chapter.filename)
      novelStore.openChapter(chapter, content)
    } catch (e) {
      showErrorMsg(
        '加载章节失败：' + (e instanceof Error ? e.message : String(e)),
      )
      return
    }
  }

  // 等待编辑器渲染后跳转到对应行
  await nextTick()
  editorRef.value?.jumpToLine(result.lineIndex)
}

// ===== Agent 回调与收尾（统一处理取消/失败/成功，避免状态胶囊卡住） =====

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// ===== Agent 交互面板（chat）编排 =====

/** 每轮 turn 的 UI 关联状态（助手气泡 / 写章预览卡 / 工具卡队列） */
interface TurnUiState {
  assistantId: string | null
  previewCardId: string | null
  /** onToolStart 顺序入队、onToolEnd 顺序出队，保证卡片与工具一一对应 */
  pendingCards: string[]
  /** 本轮是否写入了正文（结束时提示「本章定稿」） */
  wrote: boolean
}

function createTurnUi(): TurnUiState {
  return { assistantId: null, previewCardId: null, pendingCards: [], wrote: false }
}

/** 取当前章最新内容（编辑器里未保存的手动编辑也算） */
function liveChapterContent(): string {
  return currentChapterContent.value
}

/** 确保当前章节有会话（章节变化则重建） */
function ensureChatSession(): AgentSession | null {
  const novel = currentNovel.value
  const chapter = currentChapter.value
  if (!novel || !chapter) return null
  if (chatSession.value && chatSession.value.chapterId === chapter.id) {
    // 小说对象可能已被替换（定稿改写了 Skill / 概要等），让会话用最新的
    chatSession.value.novel = novel
    return chatSession.value
  }
  chatSession.value = createChatSession({
    novel,
    chapter,
    chapterContent: currentChapterContent.value,
    liveContent: liveChapterContent,
  })
  return chatSession.value
}

/** 打开章节后：重置转录并恢复该章节的持久化对话 */
async function loadChatSessionForChapter() {
  const chapter = currentChapter.value
  chatStore.resetForChapter(chapter?.id ?? null)
  chatSession.value = null
  if (!chapter) return
  const session = ensureChatSession()
  if (!session) return
  try {
    const file = await loadChatSessionFile(chapter.id)
    // 异步期间用户可能已切章
    if (currentChapter.value?.id !== chapter.id) return
    if (file) {
      chatStore.transcript = file.transcript
      restoreSessionMessages(session, file.llmMessages)
      // 恢复「待确认 plan」：重开面板后 plan 卡仍在，可继续确认/取消
      const pending = chatStore.getPendingPlan()
      if (pending && file.phase === 'awaiting_confirmation') {
        session.plan = { ...pending.plan, outline: pending.outlineDraft }
      }
    }
  } catch {
    // 恢复失败就当新对话
  }
}

/** 持久化当前对话（转录 + LLM 消息历史） */
function persistChatSession() {
  const session = chatSession.value
  const chapter = currentChapter.value
  if (!session || !chapter) return
  // 用引擎阶段（而非 UI 阶段）落盘：plan 待确认时也要记为 awaiting_confirmation
  void saveChatSessionFile(
    chapter.id,
    chapter.title,
    session.messages,
    chatStore.transcript,
    session.phase === 'done' || session.phase === 'canceled' ? 'idle' : session.phase,
  )
}

/** 写章提交：同步编辑器与快照（落盘由工具完成；字数经编辑器自动保存链路同步） */
function commitChatWrite(write: ChatWriteData) {
  const chapter = currentChapter.value
  const session = chatSession.value
  if (!chapter) return
  if (chapter.id !== write.chapterId) {
    chatStore.pushSystem(
      `已写入《${write.chapterTitle}》 ${write.addedChars} 字（切换到该章节查看）`,
    )
    return
  }
  novelStore.updateContent(write.newContent)
  editorRef.value?.replaceContent(write.newContent)
  if (session) session.chapterContent = write.newContent
}

/** 构造 chat 回调：转录同步 + 写章提交 + 统一收尾 */
function makeChatCallbacks(turnUi: TurnUiState): ChatTurnCallbacks {
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    if (turnUi.assistantId) chatStore.endAssistant(turnUi.assistantId)
    chatStore.setBusy(false)
    chatStore.setStatus('')
    chatStore.setPhase('idle')
    novelStore.stopGenerating()
    // 刷新故事状态缓存
    const novelId = currentNovel.value?.id
    if (novelId)
      loadStoryState(novelId)
        .then((s) => agentStore.setStoryState(s))
        .catch(() => {})
    persistChatSession()
  }

  return {
    onPhase: (p) => {
      chatStore.setPhase(p)
      if (p === 'planning' || p === 'generating') {
        if (!isGenerating.value) novelStore.startGenerating()
      }
      if (p === 'canceled') {
        chatStore.pushSystem('已停止')
        finish()
      }
    },
    onStatus: (s) => chatStore.setStatus(s),
    onTextDelta: (delta) => {
      if (!turnUi.assistantId) turnUi.assistantId = chatStore.beginAssistant()
      chatStore.appendAssistant(turnUi.assistantId, delta)
    },
    onToolStart: (tool, argsSummary) => {
      // 写章卡可能已被预览事件提前创建
      if (
        (tool === 'append_to_chapter' || tool === 'replace_tail') &&
        turnUi.previewCardId
      ) {
        chatStore.updateTool(turnUi.previewCardId, { argsSummary })
        turnUi.pendingCards.push(turnUi.previewCardId)
        turnUi.previewCardId = null
        return
      }
      const id = chatStore.pushTool(tool, argsSummary)
      turnUi.pendingCards.push(id)
    },
    onWritePreview: (tool, partial) => {
      if (!turnUi.previewCardId) {
        turnUi.previewCardId = chatStore.pushTool(tool, '正在写入正文…')
      }
      chatStore.setToolPreview(turnUi.previewCardId, partial)
      chatStore.setStatus(`正在写入正文… ${partial.length} 字`)
    },
    onToolEnd: (tool, ok, resultText, write) => {
      const id = turnUi.pendingCards.shift() ?? null
      if (id)
        chatStore.updateTool(id, {
          status: ok ? 'done' : 'error',
          resultText,
          write,
        })
      if (write) {
        turnUi.wrote = true
        commitChatWrite(write)
      }
    },
    onVirtualWrite: (content) => {
      const session = chatSession.value
      if (!session) return
      const write = buildVirtualWrite(session, content)
      void saveChapterContent(session.chapter.filename, write.newContent).catch(
        (e) => {
          showErrorMsg(
            '写入章节失败：' + (e instanceof Error ? e.message : String(e)),
          )
        },
      )
      const id = chatStore.pushTool(
        'append_to_chapter',
        `写入 ${write.addedChars} 字（无工具模式）`,
      )
      chatStore.updateTool(id, {
        status: 'done',
        resultText: `已把 ${write.addedChars} 字正文追加到章节末尾。`,
        write,
      })
      turnUi.wrote = true
      commitChatWrite(write)
    },
    onPlanReady: (plan) => {
      // 展示文本里去掉 PLAN 协议块（已渲染为 plan 卡）
      if (turnUi.assistantId) {
        const m = chatStore.transcript.find((x) => x.id === turnUi.assistantId)
        if (m && m.kind === 'assistant')
          m.text = m.text.replace(PLAN_BLOCK_PATTERN, '').trim()
      }
      chatStore.pushPlan(plan)
      chatStore.setStatus('等待确认规划')
    },
    onContextTrimmed: (info) => {
      chatStore.setContextUsage(info.estimatedTokens, info.trimmed)
      showWarnMsg(
        `上下文接近上限，已省略 ${info.trimmed} 条早期调研结果（约 ${info.estimatedTokens} tokens）。`,
      )
    },
    onWarn: (msg) => showWarnMsg(msg),
    onError: (e) => {
      showErrorMsg(errorText(e))
      finish()
    },
    onDone: () => {
      if (turnUi.wrote) {
        chatStore.pushSystem(
          '正文已写入。本章写完后，点顶部「本章定稿」更新章节概要、角色记忆与整体进度。',
        )
      }
      finish()
    },
  }
}

// ===== 交互面板：发送 / 快捷动作 / 停止 / plan 确认 =====

/** 发送一条自由消息（概要展开 / 提问 / plan 修改意见，由模型判定走哪条路径） */
async function handleChatSend(text: string) {
  const novel = currentNovel.value
  const chapter = currentChapter.value
  if (!novel || !chapter) return
  if (chatStore.busy || isGenerating.value) return
  if (!apiKey.value) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }
  const session = ensureChatSession()
  if (!session) return
  session.forcedMentions = parseMentions(text, novel)

  chatStore.pushUser(text)
  chatStore.setBusy(true)
  const turnUi = createTurnUi()
  // 有待确认 plan 时，本条消息视为对 plan 的修改意见 → 强制 plan 路径
  await runChatTurn(
    session,
    { visibleText: text, forcePlan: chatStore.getPendingPlan() !== null },
    buildAgentConfig(),
    makeChatCallbacks(turnUi),
  )
}

/** 快捷动作：续写上一章（新章场景）/ 续写本章 */
async function handleChatQuickAction(
  action: 'continue-prev' | 'continue-current',
) {
  const novel = currentNovel.value
  const chapter = currentChapter.value
  if (!novel || !chapter) return
  if (chatStore.busy || isGenerating.value) return
  if (!apiKey.value) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }

  let task: { visible: string; llm: string } | null
  try {
    task =
      action === 'continue-prev'
        ? await buildContinuePrevTask(
            novel,
            chapter,
            settingStore.agentWriteLength,
          )
        : buildContinueCurrentTask(
            novel,
            chapter,
            currentChapterContent.value,
            settingStore.agentWriteLength,
            await loadStoryState(novel.id).catch(() => agentStore.storyState),
          )
  } catch (e) {
    showErrorMsg(errorText(e))
    return
  }
  if (!task) {
    showErrorMsg('没有上一章，无法「续写上一章」')
    return
  }

  const session = ensureChatSession()
  if (!session) return
  chatStore.pushUser(task.visible)
  chatStore.setBusy(true)
  const turnUi = createTurnUi()
  await runChatTurn(
    session,
    { visibleText: task.visible, llmText: task.llm, forcePlan: true },
    buildAgentConfig(),
    makeChatCallbacks(turnUi),
  )
}

/** 停止当前轮次（编辑器 Escape 也走这里） */
function handleChatStop() {
  if (finalizeAbort) {
    chatStore.pushSystem('正在停止定稿…')
    finalizeAbort.abort()
    return
  }
  if (chatSession.value && chatStore.busy) {
    chatStore.pushSystem('正在停止…')
    abortChatSession(chatSession.value)
  }
}

/** 确认 plan → 生成轮（写章） */
async function handleChatConfirmPlan(plan: AgentPlan) {
  const session = chatSession.value
  if (!session) return
  if (chatStore.busy || isGenerating.value) return
  if (!apiKey.value) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }
  const pending = chatStore.getPendingPlan()
  if (pending) chatStore.updatePlan(pending.id, { status: 'confirmed' })
  session.plan = plan
  chatStore.setBusy(true)
  const turnUi = createTurnUi()
  await runChatGenerateTurn(
    session,
    buildAgentConfig(),
    makeChatCallbacks(turnUi),
  )
}

/** 取消待确认的 plan */
function handleChatCancelPlan() {
  const pending = chatStore.getPendingPlan()
  if (pending) {
    chatStore.updatePlan(pending.id, { status: 'cancelled' })
    chatStore.pushSystem('规划已取消，可继续调整或让 Agent 重新规划')
  }
  persistChatSession()
}

/** 撤销某次写章（恢复到写入前快照） */
function handleChatUndoWrite(msgId: string) {
  const msg = chatStore.transcript.find((m) => m.id === msgId)
  const session = chatSession.value
  if (!msg || msg.kind !== 'tool' || !msg.write?.snapshot) return
  if (chatStore.busy) return

  const snapshot = msg.write.snapshot
  novelStore.updateContent(snapshot)
  editorRef.value?.replaceContent(snapshot)
  if (session) session.chapterContent = snapshot
  msg.write = { ...msg.write, snapshot: undefined }
  chatStore.pushSystem('已恢复该次写入前的章节内容')
  persistChatSession()
}

/** 清空对话（删持久化文件 + 重建会话） */
async function handleChatClear() {
  const chapter = currentChapter.value
  chatStore.clear()
  chatSession.value = null
  if (chapter) await deleteChatSessionFile(chapter.id)
}

// ===== Agent 配置 =====
function buildAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    apiKey: apiKey.value,
    model: settingStore.deepseekModel,
    lengthTarget: settingStore.agentWriteLength,
    ...overrides,
  }
}

// ===== 角色面板：档案/状态编辑落盘 =====
async function handleUpdateSingleCharacter(character: Character) {
  if (!currentNovel.value) return
  const characters = currentNovel.value.characters.map((c) =>
    c.id === character.id ? character : c,
  )
  await handleUpdateCharacters(characters)
}

/** 角色面板：手动编辑短期记忆 */
async function handleUpdateShortTermMemory(patch: {
  characterName: string
  shortTerm: string
}) {
  if (!currentNovel.value) return
  try {
    const state = await loadStoryState(currentNovel.value.id)
    const saved = await saveStoryState(
      setShortTermMemory(state, patch.characterName, patch.shortTerm),
    )
    agentStore.setStoryState(saved)
  } catch (e) {
    showErrorMsg('保存短期记忆失败：' + errorText(e))
  }
}

/** 故事状态：回滚一次长期记忆（Skill）改写 */
async function handleRevertLongTerm(changeId: string) {
  const novel = currentNovel.value
  if (!novel) return
  if (chatStore.busy) {
    showWarnMsg('Agent 工作中，请稍后再回滚')
    return
  }
  try {
    const state = await loadStoryState(novel.id)
    const r = revertLongTermChange(novel.characters, state, changeId)
    if (!r) {
      showWarnMsg('无法回滚：记录不存在、已回滚，或角色已被删除')
      return
    }
    const updated = { ...novel, characters: r.characters }
    novelStore.updateCurrentNovel(updated)
    await saveNovelMeta(updated)
    agentStore.setStoryState(await saveStoryState(r.state))
    if (r.revertedIds.length > 1) {
      showWarnMsg(`已回滚，并一并撤销了之后对该角色的 ${r.revertedIds.length - 1} 次改写`)
    }
  } catch (e) {
    showErrorMsg('回滚失败：' + errorText(e))
  }
}

// ===== 本章概要 / 本章定稿 =====

/**
 * 当前章的最新元数据：handleSave 会重建 chapters 数组，currentChapter 可能是旧对象，
 * summary / finalizedAt 以 currentNovel.chapters 中的为准。
 */
const currentChapterMeta = computed<ChapterMeta | null>(() => {
  const ch = currentChapter.value
  if (!ch) return null
  return currentNovel.value?.chapters.find((c) => c.id === ch.id) ?? ch
})

/** 更新当前小说中某章的元数据（同时同步 currentChapter），并落盘 */
async function patchChapterMeta(chapterId: string, patch: Partial<ChapterMeta>) {
  const novel = currentNovel.value
  if (!novel) return
  const updated: Novel = {
    ...novel,
    chapters: novel.chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)),
  }
  novelStore.updateCurrentNovel(updated)
  if (currentChapter.value?.id === chapterId) Object.assign(currentChapter.value, patch)
  await saveNovelMeta(updated)
}

async function handleSaveChapterSummary(summary: string) {
  const ch = currentChapterMeta.value
  if (!ch) return
  try {
    await patchChapterMeta(ch.id, { summary: summary || undefined })
  } catch (e) {
    showErrorMsg('保存概要失败：' + errorText(e))
  }
}

const finalizing = ref(false)
let finalizeAbort: AbortController | null = null

function handleFinalizeFromSummaryDialog() {
  sidebarCollapsed.value = false
  sidebarTab.value = 'agent'
  void handleFinalizeChapter()
}

/** 定稿成功：把角色 Skill 与本章概要/定稿时间合并回当前小说（保留期间的字数等变化） */
async function applyFinalizeResult(result: FinalizeResult, chapterId: string) {
  const novel = currentNovel.value
  if (!novel || novel.id !== result.novel.id) return
  const fin = result.novel.chapters.find((c) => c.id === chapterId)
  novelStore.updateCurrentNovel({
    ...novel,
    characters: result.novel.characters,
  })
  await patchChapterMeta(chapterId, {
    summary: fin?.summary,
    finalizedAt: fin?.finalizedAt,
  })
  agentStore.setStoryState(result.state)
}

/** 定稿中断/失败：工具可能已改写部分 Skill，以磁盘为准刷新角色，避免自动保存覆盖回旧值 */
async function syncCharactersFromDisk() {
  const novel = currentNovel.value
  if (!novel) return
  try {
    const disk = await loadCurrentNovel()
    if (disk && disk.id === novel.id) {
      novelStore.updateCurrentNovel({ ...novel, characters: disk.characters })
    }
  } catch {
    // ignore
  }
}

/** 本章定稿：章节概要 → 短期记忆 → 长期记忆 → 整体进度 */
async function handleFinalizeChapter() {
  const novel = currentNovel.value
  const chapter = currentChapterMeta.value
  if (!novel || !chapter) return
  if (chatStore.busy || isGenerating.value) return
  if (!apiKey.value) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }
  await trySaveCurrentChapter()
  const content = currentChapterContent.value
  if (content.trim().length < 50) {
    showWarnMsg('本章正文太短，写完后再定稿')
    return
  }

  const chapterId = chapter.id
  const refinalize = !!chapter.finalizedAt
  chatStore.pushSystem(
    refinalize
      ? `重新定稿《${chapter.title}》：先撤回上次定稿对记忆的改动，再重新整理`
      : `定稿《${chapter.title}》：概要 → 短期记忆 → 长期记忆 → 整体进度`,
  )
  chatStore.setBusy(true)
  chatStore.setPhase('finalizing')
  novelStore.startGenerating()
  finalizing.value = true
  finalizeAbort = new AbortController()
  const cards: Partial<Record<FinalizeStep, string>> = {}

  try {
    const result = await runChapterFinalize(
      {
        novel: currentNovel.value ?? novel,
        chapter,
        chapterContent: content,
        config: buildAgentConfig(),
        abortController: finalizeAbort,
      },
      {
        onStatus: (s) => chatStore.setStatus(s),
        onStepStart: (step) => {
          cards[step] = chatStore.pushTool(`finalize:${step}`, '进行中…')
        },
        onStepEnd: (step, _ok, text) => {
          const id = cards[step]
          if (!id) return
          const firstLine = text.split('\n')[0]
          chatStore.updateTool(id, {
            status: 'done',
            argsSummary: firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine,
            resultText: text,
          })
          delete cards[step]
        },
        onContextTrimmed: (info) =>
          showWarnMsg(`上下文接近上限，已省略 ${info.trimmed} 条早期内容。`),
        onWarn: (m) => showWarnMsg(m),
      },
    )
    await applyFinalizeResult(result, chapterId)
    const parts = [
      `《${chapter.title}》已定稿。`,
      result.shortTermUpdated.length
        ? `短期记忆：${result.shortTermUpdated.join('、')}`
        : '短期记忆：无变化',
      result.longTermChanges.length
        ? `长期记忆改写：${result.longTermChanges.map((c) => c.characterName).join('、')}（可在「故事状态」回滚）`
        : '长期记忆：无需改写',
    ]
    chatStore.pushSystem(parts.join('\n'))
  } catch (e) {
    const aborted =
      finalizeAbort?.signal.aborted ||
      (e instanceof Error && (e.name === 'AbortError' || /abort/i.test(e.message)))
    for (const id of Object.values(cards)) {
      if (id) chatStore.updateTool(id, { status: 'error', argsSummary: aborted ? '已停止' : '失败' })
    }
    if (aborted) chatStore.pushSystem('已停止定稿（已完成的步骤会保留，可重新定稿）')
    else showErrorMsg('定稿失败：' + errorText(e))
    await syncCharactersFromDisk()
    loadStoryState(novel.id)
      .then((s) => agentStore.setStoryState(s))
      .catch(() => {})
  } finally {
    finalizeAbort = null
    finalizing.value = false
    chatStore.setBusy(false)
    chatStore.setStatus('')
    chatStore.setPhase('idle')
    novelStore.stopGenerating()
    persistChatSession()
  }
}

// ===== 工具函数 =====
function showErrorMsg(msg: string) {
  snackColor.value = 'error'
  errorMessage.value = msg
  showError.value = true
}

function showWarnMsg(msg: string) {
  snackColor.value = 'warning'
  errorMessage.value = msg
  showError.value = true
}

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  if (chatStore.busy && chatSession.value) abortChatSession(chatSession.value)
  novelStore.stopGenerating()
})
</script>

<style scoped>
/* ====== 页面根容器（不依赖父链，直接用视口计算） ====== */
.novel-root {
  /* v-main: calc(100vh - 16px)，v-container py-4: 32px */
  height: calc(100vh - 48px);
}

/* ====== 页面容器 ====== */
.novel-page {
  height: 100%;
  overflow: hidden;
}

/* ====== 侧边栏 ====== */
.novel-sidebar {
  width: 248px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgb(var(--v-theme-surface));
  transition: width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 折叠态 rail */
.novel-sidebar--rail {
  width: 60px;
  padding: 12px 6px;
  align-items: center;
  gap: 4px;
}
/* Agent 视图：加宽以容纳聊天 */
.novel-sidebar--agent {
  /* Agent 需要同时展示对话、工具卡和上下文预算；桌面端约占屏幕三分之一 */
  width: clamp(360px, 33.333vw, 560px);
  min-width: 360px;
}
.rail .lg-icon-btn.rail-active {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}

/* 视图切换 Tab（目录 / Agent） */
.sidebar-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  flex-shrink: 0;
}
.sidebar-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}
.sidebar-tab:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.sidebar-tab--active {
  background: rgba(var(--v-theme-primary), 0.13);
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
.sidebar-tabs .collapse-inline {
  margin-left: auto;
}

/* Agent 面板卡容器 */
.agent-sidebar-card {
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.agent-sidebar-card :deep(.agent-panel) {
  min-height: 0;
}
.novel-sidebar--rail .rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.rail-toggle {
  margin-bottom: 2px;
}
.rail-avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}
.rail-avatar--active {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.22);
}
.rail-avatar:hover {
  filter: brightness(1.05);
}

/* 展开态隐藏 rail（默认不渲染，无需额外样式） */

/* 侧栏分组卡片 */
.sidebar-card {
  padding: 10px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sidebar-card--clickable {
  cursor: pointer;
  transition: background 0.15s ease;
}
.sidebar-card--clickable:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.sidebar-card__head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 6px 4px;
}
.sidebar-card__head .lg-section-label {
  flex-shrink: 0;
}
.sidebar-card__head .lg-icon-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 7px;
}
.collapse-inline {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 7px;
}

/* 当前小说区 */
.current-novel-box {
  padding: 2px 6px 4px;
}
.current-novel-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
  line-height: 1.3;
  margin-bottom: 6px;
}
.current-novel-title--empty {
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.4);
}
.current-novel-actions {
  display: flex;
  gap: 6px;
}
.mini-action {
  flex: 1;
  justify-content: center;
  padding: 4px 8px;
  font-size: 11px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgba(var(--v-theme-on-surface), 0.7);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.mini-action:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}
.mini-action--ghost {
  background: transparent;
}

/* 芯片区 */
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 4px 2px;
}
.chip-item {
  font-size: 11px !important;
}
.empty-hint {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  padding: 2px 4px;
}

/* ====== 主编辑区 ====== */
.editor-main {
  min-width: 0;
  position: relative;
}

/* 空状态 */
.empty-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 48px;
  text-align: center;
}
.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: 24px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  margin-bottom: 6px;
}
.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.empty-sub {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  max-width: 320px;
  line-height: 1.6;
}
.empty-btn {
  margin-top: 10px;
  padding: 9px 18px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.2);
}
.empty-btn:hover {
  background: rgba(var(--v-theme-primary), 0.18);
  color: rgb(var(--v-theme-primary));
}
.empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.empty-btn--ghost {
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgba(var(--v-theme-on-surface), 0.7);
  border-color: rgba(var(--v-theme-on-surface), 0.12);
}
.empty-btn--ghost:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
  color: rgba(var(--v-theme-on-surface), 0.85);
}

/* 可点击的角色 chip */
.chip-clickable {
  cursor: pointer;
}
.chip-clickable:hover {
  filter: brightness(1.08);
}

/* ====== 编辑器设置弹窗 ====== */
.settings-dialog {
  padding: 20px 24px;
  border-radius: 20px;
}
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.settings-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setting-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.setting-name {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.setting-value {
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.setting-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-top: -4px;
}
.key-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: -8px;
}
.key-switch {
  flex: 1;
}
.key-clear {
  flex: 0 0 auto;
  max-width: 72px;
}
.settings-note {
  padding: 7px 10px;
  border-radius: 12px;
  font-size: 11.5px;
  line-height: 1.55;
  color: rgba(var(--v-theme-on-surface), 0.62);
  background: rgba(var(--v-theme-primary), 0.07);
}
.model-warn {
  margin-top: -6px;
  padding: 7px 10px;
  border-radius: 12px;
  font-size: 11.5px;
  line-height: 1.55;
  color: rgba(var(--v-theme-on-surface), 0.62);
  background: rgba(var(--v-theme-warning, 255, 179, 0), 0.12);
  border: 1px solid rgba(var(--v-theme-warning, 255, 179, 0), 0.22);
}
.setting-divider {
  height: 1px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  margin: 8px 0;
}
.setting-section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 4px;
}
</style>
