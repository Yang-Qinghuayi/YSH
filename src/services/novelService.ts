/**
 * novelService.ts
 * 小说数据的文件读写服务
 * 数据存储路径（扁平结构：一个文件夹 = 一本小说，文件夹直接是小说根）：
 *   <小说文件夹>/novel.json            ← 小说元数据 + 角色 + 章节列表
 *   <小说文件夹>/chapters/<filename>.md ← 每章节的 Markdown 内容
 */

import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'
import type { Novel, ChapterMeta, Character, SearchResult, LegacyCharacter } from '@/types/novel'

/**
 * V2 迁移：将分离的静态档案字段（personality/background/appearance/hobbies）
 * 合并为 profile（自然语言角色描述），并将旧 voice/description 转为 literaryReference。
 * 幂等：已迁移（无上述旧字段）的角色直接返回。
 */
function migrateCharacterV2(raw: Character): Character {
  // 访问旧字段（类型定义已移除，需 any 转型用于迁移逻辑）
  const old = raw as any
  const hasOldFields =
    old.personality || old.background || old.appearance || old.hobbies || old.voice || old.description
  if (!hasOldFields) return raw

  const parts: string[] = []
  if (old.personality) parts.push(`性格：${old.personality}`)
  if (old.background) parts.push(`出身背景：${old.background}`)
  if (old.appearance) parts.push(`外貌：${old.appearance}`)
  if (old.hobbies) parts.push(`爱好：${old.hobbies}`)

  const literaryRef = old.voice?.prompt || old.voice?.description || old.description || undefined

  const {
    personality: _p,
    background: _bg,
    appearance: _ap,
    hobbies: _hb,
    voice: _v,
    description: _d,
    ...rest
  } = old

  const migrated: Character = { ...rest } as Character
  if (parts.length > 0) migrated.profile = parts.join('\n')
  if (literaryRef) migrated.literaryReference = literaryRef
  return migrated
}

/**
 * 将旧版角色（含 profile / skills）迁移为新的静态档案结构（含 voice）。
 * 幂等：已迁移（无 skills 且无 profile）的角色直接返回。
 * - profile → background（旧 profile 是"基本背景、性格、外貌"的混合，归入 background 最接近）
 * - skills → voice：把所有技能合并为一条文风指导（多条用换行拼接）
 */
export function migrateCharacter(raw: LegacyCharacter): Character {
  // 已无旧字段，视为已迁移
  if (raw.profile === undefined && (!Array.isArray(raw.skills) || raw.skills.length === 0)) {
    const { profile: _p, skills: _s, ...rest } = raw
    return rest as Character
  }

  const voice = raw.skills && raw.skills.length > 0
    ? {
        prompt: raw.skills
          .map((s) => (s.name ? `${s.name}：${s.prompt}` : s.prompt))
          .filter(Boolean)
          .join('\n'),
      }
    : undefined

  const { profile, skills, ...rest } = raw
  const migrated: Character = {
    ...rest,
  } as Character

  // 中间态字段（将被 V2 迁移处理），需 any 转型
  if (profile && !(migrated as any).background) {
    (migrated as any).background = profile
  }
  if (voice && voice.prompt) {
    (migrated as any).voice = voice
  }
  return migrated
}

/** 迁移整部小说的角色列表，返回 { novel, changed } */
function migrateNovel(novel: Novel): { novel: Novel; changed: boolean } {
  let changed = false
  const characters = novel.characters.map((c) => {
    const legacy = c as LegacyCharacter
    // V1：旧 profile/skills → personality/background/voice
    if (legacy.profile !== undefined || (Array.isArray(legacy.skills) && legacy.skills.length > 0)) {
      changed = true
      return migrateCharacter(legacy)
    }
    return c
  })
  // V2：分离静态档案字段 → profile + literaryReference
  const v2Characters = characters.map((c) => {
    const hasOldFields =
      (c as any).personality || (c as any).background || (c as any).appearance ||
      (c as any).hobbies || (c as any).voice || (c as any).description
    if (hasOldFields) {
      changed = true
      return migrateCharacterV2(c)
    }
    return c
  })
  if (!changed) return { novel, changed: false }
  return { novel: { ...novel, characters: v2Characters }, changed: true }
}

// novel.json 路径（相对于小说文件夹根）
function novelMetaPath() {
  return 'novel.json'
}

// 获取章节文件路径（相对于小说文件夹根）
function chapterPath(filename: string) {
  return `chapters/${filename}`
}

/** 加载当前小说（读 novel.json，不存在返回 null） */
export async function loadCurrentNovel(): Promise<Novel | null> {
  const appService = await useAppService()
  const fs = appService.fs
  const { base, pathPrefix: P } = getDataBase()

  const metaPath = P + novelMetaPath()
  const exists = await fs.exists(metaPath, base).catch(() => false)
  if (!exists) return null

  const raw = await fs.readFile(metaPath, base, 'text').catch(() => null)
  if (!raw || typeof raw !== 'string') return null

  try {
    const novel = JSON.parse(raw) as Novel
    // 迁移旧版角色结构（profile/skills → 静态档案 + voice），迁移后写回
    const { novel: migrated, changed } = migrateNovel(novel)
    if (changed) {
      await saveNovelMeta(migrated).catch(() => {})
    }
    return migrated
  } catch {
    return null
  }
}

/** 保存小说元数据（含角色、章节列表） */
export async function saveNovelMeta(novel: Novel): Promise<void> {
  const appService = await useAppService()
  const fs = appService.fs
  const { base, pathPrefix: P } = getDataBase()

  // 确保章节目录存在
  await fs.createDir(P + 'chapters', base, true).catch(() => {})

  const updated = { ...novel, updatedAt: Date.now() }
  await fs.writeFile(P + novelMetaPath(), base, JSON.stringify(updated, null, 2))
}

/** 创建新小说（在当前小说文件夹根写入 novel.json） */
export async function createNovel(title: string, synopsis = ''): Promise<Novel> {
  const novel: Novel = {
    id: `novel-${Date.now()}`,
    title,
    synopsis,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    characters: [],
    chapters: [],
  }
  await saveNovelMeta(novel)
  return novel
}

/** 加载章节内容 */
export async function loadChapterContent(filename: string): Promise<string> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  const path = P + chapterPath(filename)
  const exists = await appService.fs.exists(path, base).catch(() => false)
  if (!exists) return ''

  const content = await appService.fs.readFile(path, base, 'text')
  return typeof content === 'string' ? content : ''
}

/** 保存章节内容 */
export async function saveChapterContent(
  filename: string,
  content: string,
): Promise<void> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.writeFile(P + chapterPath(filename), base, content)
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
  await appService.fs.createDir(P + 'chapters', base, true).catch(() => {})
  await appService.fs.writeFile(
    P + chapterPath(filename),
    base,
    '',
  )

  const updatedNovel: Novel = {
    ...novel,
    chapters: [...novel.chapters, chapter],
    updatedAt: Date.now(),
  }
  await saveNovelMeta(updatedNovel)

  return { novel: updatedNovel, chapter }
}

/**
 * 计算字数：去掉 Markdown 格式符和空白后的字符数
 * 适合中文长篇写作的"有效字数"口径
 */
export function countWords(content: string): number {
  return content
    .replace(/#{1,6}\s+/g, '')  // 去掉 Markdown 标题符
    .replace(/[*_`~]/g, '')     // 去掉加粗/斜体/代码/删除线
    .replace(/\s/g, '')         // 去掉所有空白（空格、换行等）
    .length
}

/** 格式化单章字数：undefined 显示 —，过万显示 x.x 万，否则本地化数字 */
export function formatWordCount(n: number | undefined): string {
  if (n === undefined) return '—'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toLocaleString('zh-CN')
}

/** 格式化总字数，带单位 */
export function formatTotalWordCount(n: number): string {
  if (n === 0) return '0 字'
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万字`
  return `${n.toLocaleString('zh-CN')} 字`
}

/** 批量读取章节文件，返回 chapterId → wordCount 的 Map */
export async function loadAllChapterWordCounts(
  chapters: ChapterMeta[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  await Promise.all(
    chapters.map(async (chapter) => {
      try {
        const content = await loadChapterContent(chapter.filename)
        result.set(chapter.id, countWords(content))
      } catch {
        // 读取失败忽略，保留 undefined
      }
    }),
  )
  return result
}

/** 跨章节全文搜索，返回所有匹配行（并发读取） */
export async function searchInChapters(
  chapters: ChapterMeta[],
  query: string,
): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  const allResults: SearchResult[] = []

  await Promise.all(
    chapters.map(async (chapter) => {
      try {
        const content = await loadChapterContent(chapter.filename)
        const lines = content.split('\n')
        lines.forEach((line, lineIndex) => {
          const lowerLine = line.toLowerCase()
          let searchFrom = 0
          let matchStart: number
          while ((matchStart = lowerLine.indexOf(lowerQuery, searchFrom)) !== -1) {
            allResults.push({
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              chapterFilename: chapter.filename,
              lineIndex,
              lineContent: line,
              matchStart,
              matchEnd: matchStart + query.length,
            })
            searchFrom = matchStart + 1
          }
        })
      } catch {
        // 读取失败忽略
      }
    }),
  )

  // 按章节顺序、再按行号排序
  const orderMap = new Map(chapters.map((c, i) => [c.id, i]))
  allResults.sort((a, b) => {
    const diff = (orderMap.get(a.chapterId) ?? 0) - (orderMap.get(b.chapterId) ?? 0)
    return diff !== 0 ? diff : a.lineIndex - b.lineIndex
  })

  return allResults
}

/** 删除章节 */
export async function deleteChapter(novel: Novel, chapterId: string): Promise<Novel> {
  const chapter = novel.chapters.find((c) => c.id === chapterId)
  if (!chapter) return novel

  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.removeFile(P + chapterPath(chapter.filename), base).catch(() => {})

  const updatedNovel: Novel = {
    ...novel,
    chapters: novel.chapters.filter((c) => c.id !== chapterId),
    updatedAt: Date.now(),
  }
  await saveNovelMeta(updatedNovel)
  return updatedNovel
}
