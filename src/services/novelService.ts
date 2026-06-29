/**
 * novelService.ts
 * 小说数据的文件读写服务
 * 数据存储路径（Data 基目录下）：
 *   novels/<novel-id>/novel.json      ← 小说元数据 + 角色 + 技能 + 章节列表
 *   novels/<novel-id>/chapters/<filename>.md  ← 每章节的 Markdown 内容
 */

import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'
import type { Novel, ChapterMeta } from '@/types/novel'

const NOVELS_DIR = 'novels'

// 获取小说根目录路径（相对于数据根目录）
function novelDir(novelId: string) {
  return `${NOVELS_DIR}/${novelId}`
}

// 获取 novel.json 路径
function novelMetaPath(novelId: string) {
  return `${novelDir(novelId)}/novel.json`
}

// 获取章节文件路径
function chapterPath(novelId: string, filename: string) {
  return `${novelDir(novelId)}/chapters/${filename}`
}

/** 加载所有小说（扫描 novels/ 目录） */
export async function loadAllNovels(): Promise<Novel[]> {
  const appService = await useAppService()
  const fs = appService.fs
  const { base, pathPrefix: P } = getDataBase()

  const dirExists = await fs.exists(P + NOVELS_DIR, base).catch(() => false)
  if (!dirExists) return []

  const entries = await fs.readDir(P + NOVELS_DIR, base).catch(() => [] as { path: string; isDir: boolean }[])
  const novels: Novel[] = []

  for (const entry of entries) {
    if (!entry.isDir) continue
    // entry.path 可能是完整路径或相对路径，取最后一段作为 novelId
    const novelId = entry.path.split('/').pop() || entry.path
    const metaPath = P + novelMetaPath(novelId)
    const exists = await fs.exists(metaPath, base).catch(() => false)
    if (!exists) continue

    const raw = await fs.readFile(metaPath, base, 'text').catch(() => null)
    if (!raw || typeof raw !== 'string') continue

    try {
      const novel = JSON.parse(raw) as Novel
      novels.push(novel)
    } catch {
      // 忽略格式错误的文件
    }
  }

  return novels.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 保存小说元数据（含角色、技能、章节列表） */
export async function saveNovelMeta(novel: Novel): Promise<void> {
  const appService = await useAppService()
  const fs = appService.fs
  const { base, pathPrefix: P } = getDataBase()

  // 确保目录存在
  await fs.createDir(P + novelDir(novel.id), base, true).catch(() => {})
  await fs.createDir(P + `${novelDir(novel.id)}/chapters`, base, true).catch(() => {})

  const updated = { ...novel, updatedAt: Date.now() }
  await fs.writeFile(P + novelMetaPath(novel.id), base, JSON.stringify(updated, null, 2))
}

/** 创建新小说 */
export async function createNovel(title: string, synopsis = ''): Promise<Novel> {
  const novel: Novel = {
    id: `novel-${Date.now()}`,
    title,
    synopsis,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    characters: [],
    plotSkills: [],
    chapters: [],
  }
  await saveNovelMeta(novel)
  return novel
}

/** 删除小说（删除整个目录） */
export async function deleteNovel(novelId: string): Promise<void> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.removeDir(P + novelDir(novelId), base, true).catch(() => {})
}

/** 加载章节内容 */
export async function loadChapterContent(novelId: string, filename: string): Promise<string> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  const path = P + chapterPath(novelId, filename)
  const exists = await appService.fs.exists(path, base).catch(() => false)
  if (!exists) return ''

  const content = await appService.fs.readFile(path, base, 'text')
  return typeof content === 'string' ? content : ''
}

/** 保存章节内容 */
export async function saveChapterContent(
  novelId: string,
  filename: string,
  content: string,
): Promise<void> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.writeFile(P + chapterPath(novelId, filename), base, content)
}

/** 新建章节 */
export async function createChapter(novel: Novel, title: string): Promise<{ novel: Novel; chapter: ChapterMeta }> {
  const order = novel.chapters.length + 1
  const paddedOrder = String(order).padStart(3, '0')
  const filename = `${paddedOrder}_${title.replace(/[/\\?*:|"<>]/g, '_')}.md`

  const chapter: ChapterMeta = {
    id: `chapter-${Date.now()}`,
    filename,
    title,
    order,
  }

  // 创建空 md 文件
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.createDir(P + `${novelDir(novel.id)}/chapters`, base, true).catch(() => {})
  await appService.fs.writeFile(
    P + chapterPath(novel.id, filename),
    base,
    `# ${title}\n\n`,
  )

  const updatedNovel: Novel = {
    ...novel,
    chapters: [...novel.chapters, chapter],
    updatedAt: Date.now(),
  }
  await saveNovelMeta(updatedNovel)

  return { novel: updatedNovel, chapter }
}

/** 删除章节 */
export async function deleteChapter(novel: Novel, chapterId: string): Promise<Novel> {
  const chapter = novel.chapters.find((c) => c.id === chapterId)
  if (!chapter) return novel

  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.removeFile(P + chapterPath(novel.id, chapter.filename), base).catch(() => {})

  const updatedNovel: Novel = {
    ...novel,
    chapters: novel.chapters.filter((c) => c.id !== chapterId),
    updatedAt: Date.now(),
  }
  await saveNovelMeta(updatedNovel)
  return updatedNovel
}
