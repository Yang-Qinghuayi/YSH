<template>
  <div class="novel-root">
  <!-- 未选择工作区时：显示选择界面 -->
  <WorkspaceInit v-if="!workspaceReady" @done="workspaceReady = true" class="h-100" />

  <div v-else class="novel-page d-flex h-100">
    <!-- ===== 左侧栏 ===== -->
    <div class="novel-sidebar d-flex flex-column">

      <!-- 小说区 -->
      <div class="sidebar-section">
        <div class="sidebar-section-label">我的小说</div>
        <NovelList
          :novels="novels"
          :current-novel-id="currentNovel?.id"
          @select="handleSelectNovel"
          @delete="handleDeleteNovel"
          @create="handleCreateNovel"
        />
      </div>

      <!-- 章节区 -->
      <div v-if="currentNovel" class="sidebar-section">
        <div class="sidebar-section-label">章节</div>
        <ChapterList
          :chapters="currentNovel.chapters"
          :current-chapter-id="currentChapter?.id"
          @select="handleSelectChapter"
          @delete="handleDeleteChapter"
          @create="handleCreateChapter"
        />
      </div>

      <!-- 角色区 -->
      <div v-if="currentNovel" class="sidebar-section">
        <div class="sidebar-section-label-row">
          <span class="sidebar-section-label">角色</span>
          <button class="icon-btn" @click="showCharacterDialog = true">
            <v-icon :icon="mdiCog" size="13" />
          </button>
        </div>
        <div class="chip-wrap">
          <v-chip
            v-for="char in currentNovel.characters"
            :key="char.id"
            size="x-small"
            variant="tonal"
            color="primary"
            class="chip-item"
          >
            {{ char.name }}
          </v-chip>
          <span v-if="!currentNovel.characters.length" class="text-caption text-medium-emphasis">暂无角色</span>
        </div>
      </div>

      <!-- 剧情技能区 -->
      <div v-if="currentNovel" class="sidebar-section">
        <div class="sidebar-section-label-row">
          <span class="sidebar-section-label">剧情技能</span>
          <button class="icon-btn" @click="showPlotSkillDialog = true">
            <v-icon :icon="mdiCog" size="13" />
          </button>
        </div>
        <div class="chip-wrap">
          <v-chip
            v-for="skill in currentNovel.plotSkills"
            :key="skill.id"
            size="x-small"
            color="secondary"
            variant="tonal"
            class="chip-item"
          >
            {{ skill.name }}
          </v-chip>
          <span v-if="!currentNovel.plotSkills.length" class="text-caption text-medium-emphasis">暂无技能</span>
        </div>
      </div>
    </div>

    <!-- ===== 主编辑区 ===== -->
    <div class="editor-main flex-1 d-flex flex-column overflow-hidden">
      <!-- 未选择章节时的占位 -->
      <div
        v-if="!currentChapter"
        class="d-flex flex-column align-center justify-center h-100 gap-3"
        style="opacity: 0.35;"
      >
        <v-icon :icon="mdiPenPlus" size="52" />
        <div class="text-body-2" v-if="!currentNovel">选择或新建一部小说</div>
        <div class="text-body-2" v-else>选择或新建章节开始写作</div>
      </div>

      <!-- 编辑器 -->
      <NovelEditor
        v-else
        ref="editorRef"
        :novel="currentNovel"
        :chapter="currentChapter"
        :content="currentChapterContent"
        :is-generating="isGenerating"
        :is-dirty="isDirty"
        @update:content="handleContentChange"
        @save="handleSave"
        @generate="handleGenerate"
        @stop-generate="handleStopGenerate"
        @open-search="showGlobalSearch = true"
      />
    </div>

    <!-- ===== 弹窗 ===== -->
    <CharacterDialog
      v-if="currentNovel"
      v-model="showCharacterDialog"
      :characters="currentNovel.characters"
      @update:characters="handleUpdateCharacters"
    />

    <PlotSkillDialog
      v-if="currentNovel"
      v-model="showPlotSkillDialog"
      :plot-skills="currentNovel.plotSkills"
      @update:plot-skills="handleUpdatePlotSkills"
    />

    <!-- 全局搜索浮窗 -->
    <GlobalSearch
      v-if="currentNovel"
      v-model:visible="showGlobalSearch"
      :novel-id="currentNovel.id"
      :chapters="currentNovel.chapters"
      :search-fn="searchInChapters"
      @jump="handleSearchJump"
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
import { mdiCog, mdiPenPlus } from '@mdi/js'
import { useNovelStore } from '@/store/novelStore'
import { useSettingStore } from '@/store/setting'
import {
  loadAllNovels,
  createNovel,
  deleteNovel,
  saveNovelMeta,
  loadChapterContent,
  saveChapterContent,
  createChapter,
  deleteChapter,
  countWords,
  loadAllChapterWordCounts,
  searchInChapters,
} from '@/services/novelService'
import { generateWithDeepSeek, parseMentions } from '@/services/deepseekService'
import { loadOrCreateLore, loadEntryContent, buildLoreContext } from '@/services/loreService'
import { isWorkspaceInitialized } from '@/services/workspaceService'
import type { Novel, ChapterMeta, Character, PlotSkill, SearchResult } from '@/types/novel'
import WorkspaceInit from '@/components/WorkspaceInit.vue'
import NovelList from './components/NovelList.vue'
import ChapterList from './components/ChapterList.vue'
import NovelEditor from './components/NovelEditor.vue'
import CharacterDialog from './components/CharacterDialog.vue'
import PlotSkillDialog from './components/PlotSkillDialog.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'

// ===== Store =====
const novelStore = useNovelStore()
const settingStore = useSettingStore()

const { novels, currentNovel, currentChapter, currentChapterContent, isDirty, isGenerating } =
  storeToRefs(novelStore)

// ===== 工作区状态 =====
const workspaceReady = ref(isWorkspaceInitialized())

// ===== 本地状态 =====
const showCharacterDialog = ref(false)
const showPlotSkillDialog = ref(false)
const showError = ref(false)
const errorMessage = ref('')
const showGlobalSearch = ref(false)

const editorRef = ref<InstanceType<typeof NovelEditor> | null>(null)

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// ===== 初始化 =====
onMounted(async () => {
  try {
    const list = await loadAllNovels()
    novelStore.setNovels(list)
  } catch (e) {
    showErrorMsg('加载小说列表失败：' + (e instanceof Error ? e.message : String(e)))
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

// ===== 小说操作 =====
async function handleSelectNovel(novel: Novel) {
  if (currentNovel.value?.id === novel.id) return
  await trySaveCurrentChapter()
  novelStore.openNovel(novel)
  // 后台异步加载尚未计算字数的章节
  loadMissingWordCounts(novel)
}

/** 后台读取未计算字数的章节，填充 wordCount 并持久化到 novel.json */
async function loadMissingWordCounts(novel: Novel) {
  const missing = novel.chapters.filter((c) => c.wordCount === undefined)
  if (!missing.length) return
  try {
    const wcMap = await loadAllChapterWordCounts(novel.id, missing)
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

async function handleCreateNovel(title: string, synopsis: string) {
  try {
    const novel = await createNovel(title, synopsis)
    novelStore.setNovels([...novels.value, novel])
    novelStore.openNovel(novel)
  } catch (e) {
    showErrorMsg('创建小说失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleDeleteNovel(novelId: string) {
  try {
    await deleteNovel(novelId)
    const updated = novels.value.filter((n) => n.id !== novelId)
    novelStore.setNovels(updated)
    if (currentNovel.value?.id === novelId) {
      novelStore.openNovel(updated[0] ?? null)
    }
  } catch (e) {
    showErrorMsg('删除小说失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

// ===== 章节操作 =====
async function handleSelectChapter(chapter: ChapterMeta) {
  if (currentChapter.value?.id === chapter.id) return
  await trySaveCurrentChapter()
  try {
    const content = await loadChapterContent(currentNovel.value!.id, chapter.filename)
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
    novelStore.openChapter(chapter, `# ${title}\n\n`)
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
      currentNovel.value.id,
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

// ===== 角色/技能管理 =====
async function handleUpdateCharacters(characters: Character[]) {
  if (!currentNovel.value) return
  const updated = { ...currentNovel.value, characters }
  novelStore.updateCurrentNovel(updated)
  await saveNovelMeta(updated).catch((e) => showErrorMsg('保存角色失败：' + e.message))
}

async function handleUpdatePlotSkills(plotSkills: PlotSkill[]) {
  if (!currentNovel.value) return
  const updated = { ...currentNovel.value, plotSkills }
  novelStore.updateCurrentNovel(updated)
  await saveNovelMeta(updated).catch((e) => showErrorMsg('保存剧情技能失败：' + e.message))
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
      const content = await loadChapterContent(currentNovel.value.id, chapter.filename)
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

// ===== AI 生成 =====
async function handleGenerate(cursorPos: number, lineText: string) {
  if (!currentNovel.value || !currentChapter.value) return
  if (isGenerating.value) return

  const apiKey = settingStore.deepseekApiKey
  if (!apiKey) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }

  const mentions = parseMentions(lineText, currentNovel.value)
  if (!mentions.length) {
    showErrorMsg('当前行没有有效的 @技能提及，请先输入如 @角色名.技能名')
    return
  }

  // 加载 Lore 资料库上下文（忽略错误，不影响主流程）
  let loreContextText: string | undefined
  try {
    const loreMeta = await loadOrCreateLore(currentNovel.value)
    const enabledMajor = loreMeta.entries.filter((e) => e.enabled && e.importance === 'major')
    const contentMap = new Map<string, string>()
    await Promise.all(
      enabledMajor.map(async (entry) => {
        const content = await loadEntryContent(loreMeta.id, entry.filename)
        contentMap.set(entry.id, content)
      }),
    )
    const ctx = buildLoreContext(loreMeta, contentMap)
    if (ctx.trim()) loreContextText = ctx
  } catch {
    // Lore 加载失败不阻断生成
  }

  novelStore.startGenerating()
  const abortSignal = novelStore.abortController?.signal

  editorRef.value?.moveCursorToNextLine()

  try {
    const stream = generateWithDeepSeek(
      {
        novel: currentNovel.value,
        chapter: currentChapter.value,
        chapterContent: currentChapterContent.value,
        cursorPosition: cursorPos,
        mentions,
        loreContextText,
      },
      apiKey,
      settingStore.deepseekModel,
      600,
      abortSignal,
    )

    for await (const chunk of stream) {
      if (abortSignal?.aborted) break
      editorRef.value?.appendContent(chunk)
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError') {
      showErrorMsg('AI 生成失败：' + e.message)
    }
  } finally {
    novelStore.stopGenerating()
  }
}

function handleStopGenerate() {
  novelStore.stopGenerating()
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
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 8px 20px;
  gap: 4px;

  /* 磨砂玻璃背景 */
  background: rgba(var(--v-theme-surface), 0.88);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

/* 侧栏区块 */
.sidebar-section {
  padding: 8px 4px 4px;
}

/* iOS-style 章节标签：全大写、间距、淡色 */
.sidebar-section-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.38);
  padding: 0 8px;
  margin-bottom: 4px;
  display: block;
}

.sidebar-section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 4px;
}

/* 小齿轮按钮 */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.38);
  transition: background 0.18s ease, color 0.18s ease;
  padding: 0;
}
.icon-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.65);
}

/* 芯片区 */
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 6px;
}

.chip-item {
  font-size: 11px !important;
}

/* ====== 主编辑区 ====== */
.editor-main {
  min-width: 0;
}
</style>
