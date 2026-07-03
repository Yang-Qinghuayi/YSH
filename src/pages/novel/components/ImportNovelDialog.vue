<template>
  <v-dialog
    :model-value="visible"
    width="92vw"
    max-width="1100px"
    height="88vh"
    scrollable
    @update:model-value="onToggle"
  >
    <v-card class="import-dialog-card lg-card d-flex flex-column h-100">
      <!-- 标题栏 -->
      <div class="import-header d-flex align-center px-4 py-3 flex-shrink-0">
        <v-icon :icon="mdiImport" size="20" class="mr-2" color="primary" />
        <span class="import-title">导入小说</span>
        <span class="import-subtitle ml-2">{{ stepSubtitle }}</span>
        <v-spacer />
        <button class="lg-icon-btn" title="关闭" @click="emit('update:visible', false)">
          <v-icon :icon="mdiClose" size="18" />
        </button>
      </div>

      <!-- 主体 -->
      <div class="import-body flex-1 overflow-y-auto px-4 py-3">
        <!-- ===== Step 1：输入 ===== -->
        <template v-if="step === 'input'">
          <div class="text-body-2 text-medium-emphasis mb-2">
            粘贴小说全文，或上传 .txt / .md 文件。会先按章节标题自动切分，再由 AI 提取人物、情节与设定。
          </div>

          <textarea
            v-model="rawText"
            class="native-input native-textarea-lg"
            placeholder="在此粘贴小说全文（含「第一章」等章节标题效果最佳）…"
            rows="14"
          ></textarea>

          <div class="d-flex align-center gap-2 mt-3 flex-wrap">
            <label class="lg-pill import-file-btn">
              <v-icon :icon="mdiFileUploadOutline" size="15" start />
              上传文件
              <input
                ref="fileInputRef"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                class="import-file-input"
                @change="onFileChange"
              />
            </label>
            <span v-if="fileName" class="text-caption text-medium-emphasis">{{ fileName }}</span>
            <v-spacer />
            <span class="text-caption text-medium-emphasis">{{ rawCharCount }} 字</span>
          </div>

          <v-alert
            v-if="splitPreview.length"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
            closable
          >
            检测到 {{ splitPreview.length }} 个章节
            <span class="text-medium-emphasis ml-1">（示例：{{ splitPreview.slice(0, 3).map((c) => c.title).join('、') }}{{ splitPreview.length > 3 ? '…' : '' }}）</span>
          </v-alert>
        </template>

        <!-- ===== Step 2：预览确认 ===== -->
        <template v-else-if="step === 'preview'">
          <div class="preview-section lg-card--inset pa-3 mb-3">
            <div class="lg-section-label mb-2">小说信息</div>
            <label class="native-label mb-2">
              <span class="native-label-text">小说标题</span>
              <input v-model="form.title" type="text" class="native-input" />
            </label>
            <label class="native-label">
              <span class="native-label-text">故事简介（精简）</span>
              <textarea v-model="form.synopsis" class="native-input native-textarea-sm" rows="2"></textarea>
            </label>
          </div>

          <!-- 章节 -->
          <div class="preview-section lg-card--inset pa-3 mb-3">
            <div class="d-flex align-center mb-2">
              <div class="lg-section-label">章节（{{ form.chapters.length }}）</div>
              <v-spacer />
              <button class="lg-pill import-mini-btn" @click="toggleAllChapters">
                {{ allChaptersSelected ? '取消全选' : '全选' }}
              </button>
            </div>
            <div class="chapter-check-list">
              <label
                v-for="(ch, i) in form.chapters"
                :key="i"
                class="chapter-check-item"
                :class="{ 'chapter-check-item--off': !ch.selected }"
              >
                <input v-model="ch.selected" type="checkbox" class="chapter-check-box" />
                <span class="chapter-check-title text-truncate">{{ i + 1 }}. {{ ch.title }}</span>
                <span class="chapter-check-meta">{{ ch.wordCount }} 字</span>
              </label>
            </div>
          </div>

          <!-- 情节梗概 -->
          <div class="preview-section lg-card--inset pa-3 mb-3">
            <label class="native-label">
              <span class="native-label-text">情节梗概（详细，将作为设定条目）</span>
              <textarea v-model="form.plotProgress" class="native-input native-textarea-sm" rows="3"></textarea>
            </label>
          </div>

          <!-- 人物 -->
          <div class="preview-section lg-card--inset pa-3 mb-3">
            <div class="d-flex align-center mb-2">
              <div class="lg-section-label">人物（{{ selectedCharacters.length }}/{{ form.characters.length }}）</div>
              <v-spacer />
              <button class="lg-pill import-mini-btn" @click="addCharacter">
                <v-icon :icon="mdiPlus" size="13" start />新增
              </button>
            </div>
            <div
              v-for="(c, i) in form.characters"
              :key="i"
              class="char-row"
              :class="{ 'char-row--off': !c.selected }"
            >
              <input v-model="c.selected" type="checkbox" class="chapter-check-box mt-2" />
              <div class="char-row__fields">
                <input v-model="c.name" type="text" class="native-input native-input-sm mb-1" placeholder="姓名" />
                <input v-model="c.aliasesText" type="text" class="native-input native-input-sm mb-1" placeholder="别名（逗号分隔）" />
                <textarea v-model="c.profile" class="native-input native-input-sm native-textarea-xs mb-1" rows="2" placeholder="角色描述"></textarea>
                <input v-model="c.literaryReference" type="text" class="native-input native-input-sm" placeholder="文学形象参考" />
              </div>
              <button class="lg-icon-btn char-row__del" title="删除" @click="form.characters.splice(i, 1)">
                <v-icon :icon="mdiClose" size="15" />
              </button>
            </div>
            <div v-if="!form.characters.length" class="text-caption text-medium-emphasis pa-2">暂无人物</div>
          </div>

          <!-- 设定 -->
          <div class="preview-section lg-card--inset pa-3 mb-3">
            <div class="d-flex align-center mb-2">
              <div class="lg-section-label">设定条目（{{ selectedLoreEntries.length }}/{{ form.loreEntries.length }}）</div>
              <v-spacer />
              <button class="lg-pill import-mini-btn" @click="addLoreEntry">
                <v-icon :icon="mdiPlus" size="13" start />新增
              </button>
            </div>
            <div
              v-for="(e, i) in form.loreEntries"
              :key="i"
              class="char-row"
              :class="{ 'char-row--off': !e.selected }"
            >
              <input v-model="e.selected" type="checkbox" class="chapter-check-box mt-2" />
              <div class="char-row__fields">
                <div class="d-flex gap-2 mb-1">
                  <input v-model="e.name" type="text" class="native-input native-input-sm flex-1" placeholder="名称" />
                  <select v-model="e.importance" class="native-input native-input-sm native-select">
                    <option v-for="it in importanceItems" :key="it.value" :value="it.value">{{ it.title }}</option>
                  </select>
                </div>
                <input v-model="e.keywordsText" type="text" class="native-input native-input-sm mb-1" placeholder="别名/触发词（逗号分隔）" />
                <input v-model="e.briefDescription" type="text" class="native-input native-input-sm mb-1" placeholder="索引简介" />
                <textarea v-model="e.content" class="native-input native-input-sm native-textarea-xs" rows="2" placeholder="详细正文"></textarea>
              </div>
              <button class="lg-icon-btn char-row__del" title="删除" @click="form.loreEntries.splice(i, 1)">
                <v-icon :icon="mdiClose" size="15" />
              </button>
            </div>
            <div v-if="!form.loreEntries.length" class="text-caption text-medium-emphasis pa-2">暂无设定</div>
          </div>
        </template>

        <!-- ===== Step 3：完成 ===== -->
        <template v-else>
          <div class="import-done d-flex flex-column align-center justify-center h-100 gap-3 pa-6">
            <div class="import-done-icon lg-card--inset">
              <v-icon :icon="mdiCheckCircleOutline" size="44" color="success" />
            </div>
            <div class="import-done-title">导入成功</div>
            <div class="import-done-sub text-center">
              《{{ importedNovel?.title }}》已导入<br />
              {{ importedNovel?.chapters.length }} 章 · {{ importedNovel?.characters.length }} 个人物 · {{ loreCount }} 条设定
            </div>
          </div>
        </template>
      </div>

      <!-- 底部操作栏 -->
      <div class="import-footer d-flex align-center px-4 py-3 flex-shrink-0 gap-2">
        <v-btn
          v-if="step === 'preview'"
          variant="text"
          size="small"
          rounded="pill"
          @click="backToInput"
        >
          返回
        </v-btn>
        <v-spacer />
        <template v-if="step === 'input'">
          <span v-if="statusText" class="text-caption text-medium-emphasis mr-2">{{ statusText }}</span>
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            rounded="pill"
            :loading="parsing"
            :disabled="!rawText.trim() || parsing"
            @click="startParse"
          >
            <v-icon :icon="mdiAutoFix" size="15" start />
            开始解析
          </v-btn>
        </template>
        <template v-else-if="step === 'preview'">
          <span v-if="statusText" class="text-caption text-medium-emphasis mr-2">{{ statusText }}</span>
          <v-btn
            color="primary"
            size="small"
            rounded="pill"
            :loading="persisting"
            :disabled="persisting"
            @click="confirmImport"
          >
            确认导入
          </v-btn>
        </template>
        <template v-else>
          <v-btn color="primary" size="small" rounded="pill" @click="finish">完成</v-btn>
        </template>
      </div>

      <!-- 错误提示 -->
      <v-snackbar v-model="showError" color="error" timeout="5000" location="top">
        {{ errorMessage }}
      </v-snackbar>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import {
  mdiImport,
  mdiClose,
  mdiAutoFix,
  mdiFileUploadOutline,
  mdiPlus,
  mdiCheckCircleOutline,
} from '@mdi/js'
import { useSettingStore } from '@/store/setting'
import {
  splitChapters,
  extractImportMeta,
  persistImport,
  type SplitChapter,
  type ImportCharacter,
  type ImportLoreEntry,
  type ImportMeta,
} from '@/services/importService'
import { countWords } from '@/services/novelService'
import { pickWorkspaceDir, createNovelFolder } from '@/services/workspaceService'
import { isTauriAppPlatform } from '@/services/environment'
import type { EntryImportance } from '@/types/lore'
import type { Novel } from '@/types/novel'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  imported: [novel: Novel]
}>()

const settingStore = useSettingStore()

type Step = 'input' | 'preview' | 'done'
const step = ref<Step>('input')

const rawText = ref('')
const fileName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const parsing = ref(false)
const persisting = ref(false)
const statusText = ref('')
const showError = ref(false)
const errorMessage = ref('')

const importedNovel = ref<Novel | null>(null)
const loreCount = ref(0)

const importanceItems: { title: string; value: EntryImportance }[] = [
  { title: '主要', value: 'major' },
  { title: '重要', value: 'important' },
  { title: '次要', value: 'minor' },
]

// ===== 表单模型 =====
interface ChapterForm { title: string; content: string; wordCount: number; selected: boolean }
interface CharacterForm extends ImportCharacter { aliasesText: string; selected: boolean }
interface LoreEntryForm extends ImportLoreEntry { keywordsText: string; selected: boolean }

const form = reactive<{
  title: string
  synopsis: string
  plotProgress: string
  chapters: ChapterForm[]
  characters: CharacterForm[]
  loreEntries: LoreEntryForm[]
}>({
  title: '',
  synopsis: '',
  plotProgress: '',
  chapters: [],
  characters: [],
  loreEntries: [],
})

const rawCharCount = computed(() => rawText.value.length)

const splitPreview = computed<SplitChapter[]>(() => {
  if (!rawText.value.trim()) return []
  return splitChapters(rawText.value)
})

const allChaptersSelected = computed(() =>
  form.chapters.length > 0 && form.chapters.every((c) => c.selected),
)

const selectedCharacters = computed(() => form.characters.filter((c) => c.selected))
const selectedLoreEntries = computed(() => form.loreEntries.filter((e) => e.selected))

const stepSubtitle = computed(() => {
  if (step.value === 'input') return '· 输入文本'
  if (step.value === 'preview') return '· 预览确认'
  return '· 完成'
})

// ===== 文件上传 =====
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    rawText.value = String(reader.result ?? '')
  }
  reader.onerror = () => showErrorMsg('读取文件失败')
  reader.readAsText(file, 'utf-8')
  // 允许重复选同一文件
  input.value = ''
}

// ===== 解析 =====
let abortCtrl: AbortController | null = null

async function startParse() {
  const apiKey = settingStore.deepseekApiKey
  if (!apiKey) {
    showErrorMsg('请先在「设置」中填写 DeepSeek API Key')
    return
  }
  const chapters = splitChapters(rawText.value)
  if (!chapters.length) {
    showErrorMsg('未识别到任何内容，请检查输入')
    return
  }

  parsing.value = true
  statusText.value = '正在切分章节…'
  abortCtrl = new AbortController()
  try {
    const meta: ImportMeta = await extractImportMeta(
      {
        apiKey,
        model: settingStore.deepseekModel,
        chapters,
        signal: abortCtrl.signal,
      },
      { onStatus: (s) => (statusText.value = s) },
    )
    fillForm(meta, chapters)
    step.value = 'preview'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // 取消，静默
    } else {
      showErrorMsg('解析失败：' + (e instanceof Error ? e.message : String(e)))
    }
  } finally {
    parsing.value = false
    statusText.value = ''
    abortCtrl = null
  }
}

function fillForm(meta: ImportMeta, chapters: SplitChapter[]) {
  form.title = meta.novelTitle || '导入的小说'
  form.synopsis = meta.synopsisBrief
  form.plotProgress = meta.plotProgress
  form.chapters = chapters.map((c) => ({
    title: c.title,
    content: c.content,
    wordCount: countWords(c.content),
    selected: true,
  }))
  form.characters = meta.characters.map((c) => ({
    ...c,
    aliasesText: (c.aliases ?? []).join(', '),
    selected: true,
  }))
  form.loreEntries = meta.loreEntries.map((e) => ({
    ...e,
    keywordsText: (e.keywords ?? []).join(', '),
    selected: true,
  }))
}

function backToInput() {
  step.value = 'input'
}

function toggleAllChapters() {
  const target = !allChaptersSelected.value
  form.chapters.forEach((c) => (c.selected = target))
}

function addCharacter() {
  form.characters.push({
    name: '',
    profile: '',
    literaryReference: '',
    aliasesText: '',
    selected: true,
  })
}

function addLoreEntry() {
  form.loreEntries.push({
    name: '',
    importance: 'important',
    briefDescription: '',
    keywords: [],
    keywordsText: '',
    content: '',
    selected: true,
  })
}

// ===== 确认导入 =====
async function confirmImport() {
  const chapters = form.chapters.filter((c) => c.selected)
  if (!chapters.length) {
    showErrorMsg('请至少选择一个章节')
    return
  }
  if (!form.title.trim()) {
    showErrorMsg('请填写小说标题')
    return
  }

  persisting.value = true
  statusText.value = '正在写入…'
  try {
    // Tauri 下：先选父目录，以标题创建独立小说文件夹并切换为当前工作区
    if (isTauriAppPlatform()) {
      const parent = await pickWorkspaceDir()
      if (!parent) {
        persisting.value = false
        statusText.value = ''
        return
      }
      await createNovelFolder(parent, form.title.trim())
    }

    const novel = await persistImport({
      title: form.title.trim(),
      synopsis: form.synopsis.trim(),
      chapters: chapters.map((c) => ({ title: c.title, content: c.content })),
      characters: selectedCharacters.value.map(toImportCharacter),
      loreEntries: selectedLoreEntries.value.map(toImportLoreEntry),
      plotProgress: form.plotProgress.trim(),
    })
    importedNovel.value = novel
    loreCount.value = 1 + selectedLoreEntries.value.length // 含情节梗概
    step.value = 'done'
  } catch (e) {
    showErrorMsg('导入失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    persisting.value = false
    statusText.value = ''
  }
}

function toImportCharacter(c: CharacterForm): ImportCharacter {
  const aliases = c.aliasesText
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    name: c.name.trim() || '未命名',
    profile: c.profile || undefined,
    aliases: aliases.length ? aliases : undefined,
    literaryReference: c.literaryReference || undefined,
  }
}

function toImportLoreEntry(e: LoreEntryForm): ImportLoreEntry {
  const keywords = e.keywordsText
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    name: e.name.trim() || '未命名条目',
    importance: e.importance,
    briefDescription: e.briefDescription || '',
    keywords,
    content: e.content || '',
  }
}

function finish() {
  emit('update:visible', false)
  resetState()
}

function resetState() {
  step.value = 'input'
  rawText.value = ''
  fileName.value = ''
  statusText.value = ''
  importedNovel.value = null
  loreCount.value = 0
  form.title = ''
  form.synopsis = ''
  form.plotProgress = ''
  form.chapters = []
  form.characters = []
  form.loreEntries = []
}

function onToggle(v: boolean) {
  emit('update:visible', v)
  if (!v) {
    // 关闭时取消进行中的解析
    abortCtrl?.abort()
    if (!parsing.value && !persisting.value) resetState()
  }
}

function showErrorMsg(msg: string) {
  errorMessage.value = msg
  showError.value = true
}

// 持久化成功后通知父组件打开新小说（完成页展示期间即触发，无需等点「完成」）
watch(step, (s) => {
  if (s === 'done' && importedNovel.value) {
    emit('imported', importedNovel.value)
  }
})
</script>

<style scoped>
.import-dialog-card {
  overflow: hidden;
}

.import-header {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.import-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.87);
}
.import-subtitle {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}

.import-body {
  min-height: 0;
}

/* ===== 原生输入框 ===== */
.native-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.native-label-text {
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  padding-left: 4px;
}
.native-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: none;
  border-radius: 14px;
  outline: none;
  transition: box-shadow 0.2s;
  box-sizing: border-box;
}
.native-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.4);
}
.native-input:focus {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.45);
}
.native-input-sm {
  padding: 7px 10px;
  font-size: 13px;
  border-radius: 10px;
}
.native-textarea-lg {
  resize: vertical;
  min-height: 200px;
}
.native-textarea-sm {
  resize: vertical;
  min-height: 56px;
}
.native-textarea-xs {
  resize: vertical;
  min-height: 44px;
}
.native-select {
  max-width: 110px;
  cursor: pointer;
  appearance: auto;
}

.import-file-btn {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 6px 14px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  font-size: 13px;
}
.import-file-btn:hover {
  background: rgba(var(--v-theme-primary), 0.18);
}
.import-file-input {
  display: none;
}

.preview-section {
  border-radius: 14px;
}

/* 章节勾选列表 */
.chapter-check-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
}
.chapter-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
.chapter-check-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.chapter-check-item--off {
  opacity: 0.45;
}
.chapter-check-box {
  accent-color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
.chapter-check-title {
  flex: 1;
  min-width: 0;
}
.chapter-check-meta {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.4);
  flex-shrink: 0;
}

.import-mini-btn {
  padding: 3px 10px;
  font-size: 12px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.7);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.import-mini-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}

/* 人物/设定行 */
.char-row {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  margin-bottom: 8px;
  align-items: flex-start;
}
.char-row--off {
  opacity: 0.5;
}
.char-row__fields {
  flex: 1;
  min-width: 0;
}
.char-row__del {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: rgba(var(--v-theme-error), 0.7);
}
.char-row__del:hover {
  background: rgba(var(--v-theme-error), 0.1);
}

.import-footer {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* 完成 */
.import-done {
  min-height: 320px;
}
.import-done-icon {
  width: 76px;
  height: 76px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-success), 0.1);
}
.import-done-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.87);
}
.import-done-sub {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.8;
}

.gap-2 {
  gap: 8px;
}
</style>
