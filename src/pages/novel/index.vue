<template>
  <div class="novel-root">
  <!-- 未选择工作区时：显示选择界面 -->
  <WorkspaceInit v-if="!workspaceReady" @done="handleWorkspaceReady" class="h-100" />

  <div v-else class="novel-page d-flex h-100">
    <!-- ===== 主编辑区 ===== -->
    <div class="editor-main flex-1 d-flex flex-column overflow-hidden">
      <!-- 顶部小说概览栏 -->
      <NovelOverviewBar
        v-if="currentNovel"
        :novel="currentNovel"
        @open-folder="handleOpenFolder"
        @view-state="showStoryStateDialog = true"
        @switch-novel="switchNovel"
      />

      <!-- 未选择章节时的占位 -->
      <div
        v-if="!currentChapter"
        class="empty-stage"
      >
        <div class="empty-card lg-card">
          <div class="empty-icon">
            <v-icon :icon="currentNovel ? mdiPenPlus : mdiBookPlus" size="44" />
          </div>
          <div class="empty-title">
            {{ currentNovel ? '开始创作新章节' : '开启你的第一部小说' }}
          </div>
          <div class="empty-sub">
            {{ currentNovel ? '在左侧选择章节，或新建一章开始写作' : '在左侧新建一部小说，开启 AI 辅助写作之旅' }}
          </div>
          <div v-if="!currentNovel" class="empty-actions">
            <button class="lg-pill empty-btn" @click="switchNovel">
              <v-icon :icon="mdiPlus" size="16" />
              新建 / 打开小说
            </button>
            <button class="lg-pill empty-btn empty-btn--ghost" @click="showImportDialog = true">
              <v-icon :icon="mdiImport" size="16" />
              导入小说
            </button>
          </div>
          <button v-else class="lg-pill empty-btn" @click="chapterListRef?.openCreate()">
            <v-icon :icon="mdiPlus" size="16" />
            新建章节
          </button>
        </div>
      </div>

      <template v-else>
        <!-- 章节概要输入条 -->
        <div class="brief-bar lg-card--inset">
          <v-textarea
            v-model="chapterBrief"
            :placeholder="briefPlaceholder"
            variant="plain"
            density="compact"
            rows="1"
            auto-grow
            max-rows="4"
            hide-details
            class="brief-input"
          />
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            rounded="pill"
            :disabled="isGenerating"
            class="brief-btn"
            @click="startChapterAgent"
          >
            <v-icon :icon="mdiAutoFix" size="15" start />
            生成整章
          </v-btn>
        </div>

        <!-- 编辑器 -->
        <NovelEditor
          ref="editorRef"
          class="flex-1"
          style="min-height: 0;"
          :novel="currentNovel"
          :chapter="currentChapter"
          :content="currentChapterContent"
          :is-generating="isGenerating"
          @update:content="handleContentChange"
          @generate="handleGenerate"
          @stop-generate="handleStopGenerate"
          @open-search="showGlobalSearch = true"
        />

        <!-- Agent 状态条 -->
        <AgentStatusBar @stop="handleStopGenerate" />
      </template>
    </div>

    <!-- ===== 右侧栏（可折叠为图标 rail） ===== -->
    <aside
      class="novel-sidebar"
      :class="{ 'novel-sidebar--rail': sidebarCollapsed }"
    >
      <!-- 折叠态：图标 rail -->
      <div v-if="sidebarCollapsed" class="rail">
        <button class="lg-icon-btn rail-toggle" title="展开侧栏" @click="sidebarCollapsed = false">
          <v-icon :icon="mdiMenuClose" size="18" />
        </button>
        <button class="rail-avatar" :class="{ 'rail-avatar--active': currentNovel }" :title="currentNovel ? currentNovel.title : '切换小说'" @click="switchNovel">
          {{ currentNovel ? currentNovel.title.slice(0, 1) : '书' }}
        </button>
        <button class="lg-icon-btn" title="章节" :disabled="!currentNovel" @click="sidebarCollapsed = false">
          <v-icon :icon="mdiFormatListBulleted" size="18" />
        </button>
        <button class="lg-icon-btn" title="角色" :disabled="!currentNovel" @click="onOpenCharacters">
          <v-icon :icon="mdiAccountGroupOutline" size="18" />
        </button>
        <button class="lg-icon-btn" title="设定" :disabled="!currentNovel" @click="onOpenLore">
          <v-icon :icon="mdiBookshelf" size="18" />
        </button>
      </div>

      <!-- 展开态：分组玻璃卡片 -->
      <template v-else>
        <!-- 当前小说区：标题 + 切换/导入入口 -->
        <div class="sidebar-card lg-card">
          <div class="sidebar-card__head">
            <v-icon :icon="mdiBookOpenVariant" size="14" class="lg-section-label" />
            <span class="lg-section-label">当前小说</span>
            <button class="lg-icon-btn collapse-inline" title="折叠侧栏" @click="sidebarCollapsed = true">
              <v-icon :icon="mdiMenuOpen" size="16" />
            </button>
          </div>
          <div class="current-novel-box">
            <div v-if="currentNovel" class="current-novel-title text-truncate">{{ currentNovel.title }}</div>
            <div v-else class="current-novel-title current-novel-title--empty">未打开小说</div>
            <div class="current-novel-actions">
              <button class="lg-pill mini-action" @click="switchNovel">
                <v-icon :icon="mdiSwapHorizontal" size="13" /> 切换
              </button>
              <button class="lg-pill mini-action mini-action--ghost" @click="showImportDialog = true">
                <v-icon :icon="mdiImport" size="13" /> 导入
              </button>
            </div>
          </div>
        </div>

        <!-- 章节区 -->
        <div v-if="currentNovel" class="sidebar-card lg-card">
          <div class="sidebar-card__head">
            <v-icon :icon="mdiFormatListBulleted" size="14" class="lg-section-label" />
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
        <div v-if="currentNovel" class="sidebar-card lg-card sidebar-card--clickable" @click="showCharacterDialog = true">
          <div class="sidebar-card__head">
            <v-icon :icon="mdiAccountGroupOutline" size="14" class="lg-section-label" />
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
            <span v-if="!currentNovel.characters.length" class="empty-hint">暂无角色</span>
          </div>
        </div>

        <!-- 设定资料库区 -->
        <div v-if="currentNovel" class="sidebar-card lg-card sidebar-card--clickable" @click="showLorePanel = true">
          <div class="sidebar-card__head">
            <v-icon :icon="mdiBookshelf" size="14" class="lg-section-label" />
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
            <span v-if="!loreEntries.length" class="empty-hint">暂无设定</span>
          </div>
        </div>
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

    <!-- Agent plan 确认面板 -->
    <AgentPlanPanel @confirm="handleConfirmPlan" @cancel="handleCancelPlan" />

    <!-- 角色面板（档案 + 状态） -->
    <CharacterPanel
      v-if="currentNovel"
      :characters="currentNovel.characters"
      @update:character="handleUpdateSingleCharacter"
      @update:state="handleUpdateCharacterState"
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
    />

    <!-- 导入小说对话框 -->
    <ImportNovelDialog
      v-model:visible="showImportDialog"
      @imported="handleImported"
    />

    <!-- 错误提示 -->
    <v-snackbar v-model="showError" color="error" timeout="4000" location="top">
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
  mdiAutoFix,
  mdiMenuOpen,
  mdiMenuClose,
  mdiBookOpenVariant,
  mdiFormatListBulleted,
  mdiAccountGroupOutline,
  mdiBookshelf,
  mdiImport,
  mdiSwapHorizontal,
} from '@mdi/js'
import { useNovelStore } from '@/store/novelStore'
import { useSettingStore } from '@/store/setting'
import { useAgentStore } from '@/store/agentStore'
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
import {
  createSession,
  runPlanPhase,
  runGeneratePhase,
  abort as abortSession,
  type AgentSession,
  type AgentPlan,
  type AgentConfig,
} from '@/services/agentService'
import { loadStoryState, saveStoryState } from '@/services/storyStateService'
import { loadOrCreateLore } from '@/services/loreService'
import {
  isWorkspaceInitialized,
  getWorkspaceDir,
  getDirName,
} from '@/services/workspaceService'
import { isTauriAppPlatform } from '@/services/environment'
import { openPath } from '@tauri-apps/plugin-opener'
import type { Novel, ChapterMeta, Character, SearchResult } from '@/types/novel'
import type { CharacterState } from '@/types/storyState'
import type { EntryMeta } from '@/types/lore'
import WorkspaceInit from '@/components/WorkspaceInit.vue'
import ChapterList from './components/ChapterList.vue'
import NovelEditor from './components/NovelEditor.vue'
import NovelOverviewBar from './components/NovelOverviewBar.vue'
import CharacterDialog from './components/CharacterDialog.vue'
import AgentPlanPanel from './components/AgentPlanPanel.vue'
import AgentStatusBar from './components/AgentStatusBar.vue'
import CharacterPanel from './components/CharacterPanel.vue'
import LorePanel from './components/LorePanel.vue'
import StoryStateDialog from './components/StoryStateDialog.vue'
import ImportNovelDialog from './components/ImportNovelDialog.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'

// ===== Store =====
const novelStore = useNovelStore()
const settingStore = useSettingStore()
const agentStore = useAgentStore()

const { currentNovel, currentChapter, currentChapterContent, isDirty, isGenerating } =
  storeToRefs(novelStore)

// ===== 工作区状态 =====
const workspaceReady = ref(isWorkspaceInitialized())
const isTauri = isTauriAppPlatform()

// ===== 本地状态 =====
const showCharacterDialog = ref(false)
const showError = ref(false)
const errorMessage = ref('')
const showGlobalSearch = ref(false)
const showLorePanel = ref(false)
const showImportDialog = ref(false)
const showStoryStateDialog = ref(false)
const loreEntries = ref<EntryMeta[]>([])
const pendingLoreEntryId = ref<string | null>(null)

const editorRef = ref<InstanceType<typeof NovelEditor> | null>(null)
const chapterListRef = ref<InstanceType<typeof ChapterList> | null>(null)

// ===== 侧栏折叠 =====
const sidebarCollapsed = ref(false)

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

// ===== Agent 状态 =====
const chapterBrief = ref('')
const agentSession = ref<AgentSession | null>(null)
const briefPlaceholder = '写本章概要，Agent 会自动检索资料、选定角色并规划大纲（可用 @角色名 强制指定）'

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
  onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalSearchKey))
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
    loadStoryState(novel.id).then((s) => agentStore.setStoryState(s)).catch(() => {})
    // 加载设定资料库条目缓存（供侧栏 chip 展示）
    loadLoreEntries(novel)
    // 后台异步加载尚未计算字数的章节
    loadMissingWordCounts(novel)
  } catch (e) {
    showErrorMsg('加载小说失败：' + (e instanceof Error ? e.message : String(e)))
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
    showErrorMsg('打开文件夹失败：' + (e instanceof Error ? e.message : String(e)))
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
  } catch (e) {
    showErrorMsg('加载章节失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleCreateChapter(title: string) {
  if (!currentNovel.value) return
  try {
    const { novel, chapter } = await createChapter(currentNovel.value, title)
    novelStore.updateCurrentNovel(novel)
    novelStore.openChapter(chapter, '')
  } catch (e) {
    showErrorMsg('创建章节失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleDeleteChapter(chapterId: string) {
  if (!currentNovel.value) return
  try {
    const updatedNovel = await deleteChapter(currentNovel.value, chapterId)
    novelStore.updateCurrentNovel(updatedNovel)
    if (currentChapter.value?.id === chapterId) {
      novelStore.openChapter(null as unknown as ChapterMeta, '')
    }
  } catch (e) {
    showErrorMsg('删除章节失败：' + (e instanceof Error ? e.message : String(e)))
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
  const updated = { ...currentNovel.value, characters }
  novelStore.updateCurrentNovel(updated)
  await saveNovelMeta(updated).catch((e) => showErrorMsg('保存角色失败：' + e.message))
}

// ===== 全局搜索 =====
async function handleSearchJump(result: SearchResult) {
  showGlobalSearch.value = false
  if (!currentNovel.value) return

  // 找到目标章节元数据
  const chapter = currentNovel.value.chapters.find((c) => c.id === result.chapterId)
  if (!chapter) return

  // 如果不是当前章节，先切换
  if (currentChapter.value?.id !== chapter.id) {
    await trySaveCurrentChapter()
    try {
      const content = await loadChapterContent(chapter.filename)
      novelStore.openChapter(chapter, content)
    } catch (e) {
      showErrorMsg('加载章节失败：' + (e instanceof Error ? e.message : String(e)))
      return
    }
  }

  // 等待编辑器渲染后跳转到对应行
  await nextTick()
  editorRef.value?.jumpToLine(result.lineIndex)
}

// ===== AI 生成（内联续写：Tab 触发，走 Agent 快速模式，跳过确认） =====
async function handleGenerate(cursorPos: number, lineText: string) {
  if (!currentNovel.value || !currentChapter.value) return
  if (isGenerating.value) return

  const apiKey = settingStore.deepseekApiKey
  if (!apiKey) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }

  const forcedMentions = parseMentions(lineText, currentNovel.value)
  const brief = `续写一小段，自然衔接前文。${lineText.trim() ? `本行提示：${lineText.trim()}` : ''}`

  const session = createSession({
    novel: currentNovel.value,
    chapter: currentChapter.value,
    chapterContent: currentChapterContent.value,
    cursorPosition: cursorPos,
    forcedMentions,
    skipConfirmation: true,
  })
  agentSession.value = session
  agentStore.clearToolLog()
  agentStore.setPlan(null)
  agentStore.setPhase('planning')
  editorRef.value?.moveCursorToNextLine()

  await runPlanPhase(session, brief, buildAgentConfig(), {
    onStatus: (s) => agentStore.setStatus(s),
    onPhase: (p) => {
      agentStore.setPhase(p)
      syncGenerating(p)
    },
    onToolCall: (log) => agentStore.addToolLog(log),
    onTextDelta: (delta) => {
      editorRef.value?.appendContent(delta)
    },
    onError: (e) => {
      showErrorMsg('AI 生成失败：' + (e instanceof Error ? e.message : String(e)))
    },
    onDone: async () => {
      try {
        const s = await loadStoryState(session.novelId)
        agentStore.setStoryState(s)
      } catch {
        // 忽略
      }
      agentStore.resetAgent()
      agentSession.value = null
      novelStore.stopGenerating()
    },
  })
}

function handleStopGenerate() {
  if (agentSession.value) {
    abortSession(agentSession.value)
  }
  novelStore.stopGenerating()
}

// ===== Agent 整章生成（plan → 确认 → 生成） =====
function buildAgentConfig(): AgentConfig {
  return {
    apiKey: settingStore.deepseekApiKey,
    model: settingStore.deepseekModel,
    autoUpdateStoryState: agentStore.autoUpdateStoryState,
  }
}

function syncGenerating(phase: string) {
  if (phase === 'planning' || phase === 'generating' || phase === 'finalizing') {
    if (!isGenerating.value) novelStore.startGenerating()
  } else {
    novelStore.stopGenerating()
  }
}

async function startChapterAgent() {
  if (!currentNovel.value || !currentChapter.value) return
  if (isGenerating.value) return

  const apiKey = settingStore.deepseekApiKey
  if (!apiKey) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }
  if (!chapterBrief.value.trim()) {
    showErrorMsg('请先填写本章概要')
    return
  }

  const forcedMentions = parseMentions(chapterBrief.value, currentNovel.value)
  const session = createSession({
    novel: currentNovel.value,
    chapter: currentChapter.value,
    chapterContent: currentChapterContent.value,
    cursorPosition: currentChapterContent.value.length,
    forcedMentions,
    skipConfirmation: false,
  })
  agentSession.value = session
  agentStore.clearToolLog()
  agentStore.setPlan(null)
  agentStore.setPhase('planning')

  await runPlanPhase(session, chapterBrief.value, buildAgentConfig(), {
    onStatus: (s) => agentStore.setStatus(s),
    onPhase: (p) => {
      agentStore.setPhase(p)
      syncGenerating(p)
    },
    onToolCall: (log) => agentStore.addToolLog(log),
    onPlanReady: (plan) => {
      agentStore.setPlan(plan)
      agentStore.planDialogVisible = true
    },
    onError: (e) => {
      showErrorMsg('Agent 规划失败：' + (e instanceof Error ? e.message : String(e)))
      agentStore.resetAgent()
      novelStore.stopGenerating()
    },
  })
}

async function handleConfirmPlan(plan: AgentPlan) {
  const session = agentSession.value
  if (!session) return
  session.plan = plan
  agentStore.planDialogVisible = false
  agentStore.setPhase('generating')
  syncGenerating('generating')

  await runGeneratePhase(session, buildAgentConfig(), {
    onStatus: (s) => agentStore.setStatus(s),
    onPhase: (p) => {
      agentStore.setPhase(p)
      syncGenerating(p)
    },
    onToolCall: (log) => agentStore.addToolLog(log),
    onTextDelta: (delta) => {
      editorRef.value?.appendContent(delta)
    },
    onError: (e) => {
      showErrorMsg('Agent 生成失败：' + (e instanceof Error ? e.message : String(e)))
    },
    onDone: async () => {
      // 刷新故事状态缓存，角色面板实时更新
      try {
        const s = await loadStoryState(session.novelId)
        agentStore.setStoryState(s)
      } catch {
        // 忽略
      }
      agentStore.resetAgent()
      agentSession.value = null
      novelStore.stopGenerating()
    },
  })
}

function handleCancelPlan() {
  const session = agentSession.value
  if (session) abortSession(session)
  agentStore.planDialogVisible = false
  agentStore.resetAgent()
  agentSession.value = null
  novelStore.stopGenerating()
}

// ===== 角色面板：档案/状态编辑落盘 =====
async function handleUpdateSingleCharacter(character: Character) {
  if (!currentNovel.value) return
  const characters = currentNovel.value.characters.map((c) =>
    c.id === character.id ? character : c,
  )
  await handleUpdateCharacters(characters)
}

async function handleUpdateCharacterState(patch: {
  characterName: string
  data: Partial<CharacterState>
}) {
  if (!currentNovel.value) return
  try {
    const state = await loadStoryState(currentNovel.value.id)
    const idx = state.characterStates.findIndex((c) => c.characterName === patch.characterName)
    const now = Date.now()
    if (idx >= 0) {
      state.characterStates[idx] = {
        ...state.characterStates[idx],
        ...patch.data,
        characterName: patch.characterName,
        relationships: state.characterStates[idx].relationships,
        updatedAt: now,
      }
    } else {
      state.characterStates.push({
        characterName: patch.characterName,
        mood: patch.data.mood,
        location: patch.data.location,
        injuries: patch.data.injuries,
        notes: patch.data.notes,
        relationships: [],
        lastUpdatedChapterId: currentChapter.value?.id ?? '',
        updatedAt: now,
      })
    }
    await saveStoryState(state)
    agentStore.setStoryState(state)
  } catch (e) {
    showErrorMsg('保存角色状态失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// ===== 工具函数 =====
function showErrorMsg(msg: string) {
  errorMessage.value = msg
  showError.value = true
}

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
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

/* ====== 侧边栏 — Liquid Glass ====== */
.novel-sidebar {
  width: 248px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(var(--v-theme-surface), 0.6);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  transition: width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 折叠态 rail */
.novel-sidebar--rail {
  width: 60px;
  padding: 12px 6px;
  align-items: center;
  gap: 4px;
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
  transition: background 0.18s ease, color 0.18s ease;
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

/* 章节概要输入条 */
.brief-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 8px 12px;
  margin: 10px 14px 0;
  border-radius: 16px;
  flex-shrink: 0;
}
.brief-input {
  flex: 1;
  font-size: 13px;
}
.brief-input :deep(.v-field__input) {
  padding-top: 6px;
  padding-bottom: 6px;
}
.brief-btn {
  flex-shrink: 0;
}

/* 可点击的角色 chip */
.chip-clickable {
  cursor: pointer;
}
.chip-clickable:hover {
  filter: brightness(1.08);
}
</style>
