<template>
  <!-- 未选择工作区时：显示选择界面 -->
  <WorkspaceInit v-if="!workspaceReady" @done="workspaceReady = true" class="h-100" />

  <div v-else class="novel-page d-flex h-100">
    <!-- ===== 左侧栏 ===== -->
    <div class="novel-sidebar d-flex flex-column pa-2 gap-3">
      <!-- 小说区 -->
      <div>
        <div class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis px-2 mb-1">
          我的小说
        </div>
        <NovelList
          :novels="novels"
          :current-novel-id="currentNovel?.id"
          @select="handleSelectNovel"
          @delete="handleDeleteNovel"
          @create="handleCreateNovel"
        />
      </div>

      <v-divider />

      <!-- 章节区 -->
      <div v-if="currentNovel">
        <div class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis px-2 mb-1">
          章节
        </div>
        <ChapterList
          :chapters="currentNovel.chapters"
          :current-chapter-id="currentChapter?.id"
          @select="handleSelectChapter"
          @delete="handleDeleteChapter"
          @create="handleCreateChapter"
        />
      </div>

      <v-divider v-if="currentNovel" />

      <!-- 角色区 -->
      <div v-if="currentNovel">
        <div class="d-flex align-center justify-space-between px-2 mb-1">
          <span class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis">角色</span>
          <v-btn icon size="x-small" variant="text" @click="showCharacterDialog = true">
            <v-icon :icon="mdiCog" size="16" />
          </v-btn>
        </div>
        <div class="px-2">
          <v-chip
            v-for="char in currentNovel.characters"
            :key="char.id"
            size="x-small"
            class="mr-1 mb-1"
            variant="tonal"
          >
            {{ char.name }}
          </v-chip>
          <div v-if="!currentNovel.characters.length" class="text-caption text-medium-emphasis">
            暂无角色
          </div>
        </div>
      </div>

      <v-divider v-if="currentNovel" />

      <!-- 剧情技能区 -->
      <div v-if="currentNovel">
        <div class="d-flex align-center justify-space-between px-2 mb-1">
          <span class="sidebar-section-title text-caption font-weight-bold text-medium-emphasis">剧情技能</span>
          <v-btn icon size="x-small" variant="text" @click="showPlotSkillDialog = true">
            <v-icon :icon="mdiCog" size="16" />
          </v-btn>
        </div>
        <div class="px-2">
          <v-chip
            v-for="skill in currentNovel.plotSkills"
            :key="skill.id"
            size="x-small"
            class="mr-1 mb-1"
            color="secondary"
            variant="tonal"
          >
            {{ skill.name }}
          </v-chip>
          <div v-if="!currentNovel.plotSkills.length" class="text-caption text-medium-emphasis">
            暂无剧情技能
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 主编辑区 ===== -->
    <div class="editor-main flex-1 d-flex flex-column overflow-hidden">
      <!-- 未选择章节时的占位 -->
      <div
        v-if="!currentChapter"
        class="d-flex flex-column align-center justify-center h-100 gap-3 text-medium-emphasis"
      >
        <v-icon :icon="mdiPenPlus" size="56" />
        <div v-if="!currentNovel">请从左侧选择或新建一部小说</div>
        <div v-else>请从左侧选择或新建章节开始写作</div>
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

    <!-- 错误提示 -->
    <v-snackbar v-model="showError" color="error" timeout="4000" location="top">
      {{ errorMessage }}
    </v-snackbar>
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
} from '@/services/novelService'
import { generateWithDeepSeek, parseMentions } from '@/services/deepseekService'
import { loadOrCreateLore, loadEntryContent, buildLoreContext } from '@/services/loreService'
import { isWorkspaceInitialized } from '@/services/workspaceService'
import type { Novel, ChapterMeta, Character, PlotSkill } from '@/types/novel'
import WorkspaceInit from '@/components/WorkspaceInit.vue'
import NovelList from './components/NovelList.vue'
import ChapterList from './components/ChapterList.vue'
import NovelEditor from './components/NovelEditor.vue'
import CharacterDialog from './components/CharacterDialog.vue'
import PlotSkillDialog from './components/PlotSkillDialog.vue'

// ===== Store =====
const novelStore = useNovelStore()
const settingStore = useSettingStore()

const { novels, currentNovel, currentChapter, currentChapterContent, isDirty, isGenerating } =
  storeToRefs(novelStore)

// ===== 工作区状态 =====
// workspaceDir === null 表示从未选择过，需要先完成初始化
const workspaceReady = ref(isWorkspaceInitialized())

// ===== 本地状态 =====
const showCharacterDialog = ref(false)
const showPlotSkillDialog = ref(false)
const showError = ref(false)
const errorMessage = ref('')

const editorRef = ref<InstanceType<typeof NovelEditor> | null>(null)

// 自动保存定时器
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// ===== 初始化 =====
onMounted(async () => {
  try {
    const list = await loadAllNovels()
    novelStore.setNovels(list)
  } catch (e) {
    showErrorMsg('加载小说列表失败：' + (e instanceof Error ? e.message : String(e)))
  }
})

// ===== 小说操作 =====
async function handleSelectNovel(novel: Novel) {
  if (currentNovel.value?.id === novel.id) return
  await trySaveCurrentChapter()
  novelStore.openNovel(novel)
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
    // 自动打开新章节
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
  // 防抖自动保存（2s 无操作后保存）
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    handleSave()
  }, 2000)
}

async function handleSave() {
  if (!currentNovel.value || !currentChapter.value) return
  try {
    await saveChapterContent(
      currentNovel.value.id,
      currentChapter.value.filename,
      currentChapterContent.value,
    )
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

  // 移到下一行开始写入
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
.novel-page {
  height: 100%;
  overflow: hidden;
}

.novel-sidebar {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.editor-main {
  min-width: 0;
}

.sidebar-section-title {
  letter-spacing: 0.05em;
}
</style>
