import { defineStore } from 'pinia'
import type { Novel, ChapterMeta } from '@/types/novel'

export const useNovelStore = defineStore('novel', () => {
  // 当前打开的小说列表（侧栏展示）
  const novels = ref<Novel[]>([])

  // 当前正在编辑的小说
  const currentNovel = ref<Novel | null>(null)

  // 当前正在编辑的章节元数据
  const currentChapter = ref<ChapterMeta | null>(null)

  // 当前章节的 Markdown 内容
  const currentChapterContent = ref('')

  // 是否有未保存的更改
  const isDirty = ref(false)

  // AI 生成状态
  const isGenerating = ref(false)

  // AI 生成是否被中断
  const abortController = ref<AbortController | null>(null)

  // 设置小说列表
  function setNovels(list: Novel[]) {
    novels.value = list
  }

  // 打开小说
  function openNovel(novel: Novel) {
    currentNovel.value = novel
    currentChapter.value = null
    currentChapterContent.value = ''
    isDirty.value = false
  }

  // 打开章节（只更新元数据，内容由 novelService 加载）
  function openChapter(chapter: ChapterMeta, content: string) {
    currentChapter.value = chapter
    currentChapterContent.value = content
    isDirty.value = false
  }

  // 更新章节内容（用户编辑时调用）
  function updateContent(content: string) {
    currentChapterContent.value = content
    isDirty.value = true
  }

  // 标记已保存
  function markSaved() {
    isDirty.value = false
  }

  // 在当前小说中更新角色/技能等（本地状态）
  function updateCurrentNovel(updated: Novel) {
    currentNovel.value = updated
    const index = novels.value.findIndex((n) => n.id === updated.id)
    if (index !== -1) {
      novels.value[index] = updated
    }
  }

  // 在当前小说中更新章节列表
  function updateChapterList(chapters: ChapterMeta[]) {
    if (!currentNovel.value) return
    currentNovel.value = { ...currentNovel.value, chapters }
    updateCurrentNovel(currentNovel.value)
  }

  // AI 生成状态管理
  function startGenerating() {
    abortController.value = new AbortController()
    isGenerating.value = true
  }

  function stopGenerating() {
    abortController.value?.abort()
    abortController.value = null
    isGenerating.value = false
  }

  return {
    novels,
    currentNovel,
    currentChapter,
    currentChapterContent,
    isDirty,
    isGenerating,
    abortController,
    setNovels,
    openNovel,
    openChapter,
    updateContent,
    markSaved,
    updateCurrentNovel,
    updateChapterList,
    startGenerating,
    stopGenerating,
  }
})
