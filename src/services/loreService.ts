/**
 * loreService.ts
 * Lore 资料库的文件读写服务
 * 数据存储路径（Data 基目录下，与 novel 同级）：
 *   novels/<novel-id>/lore/lore.json             ← Lore 元数据 + 全部 EntryMeta
 *   novels/<novel-id>/lore/entries/<id>.md        ← 每条条目的 Markdown 正文
 */

import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'
import type { Novel } from '@/types/novel'
import type { Lore, EntryMeta, EntryType, EntryImportance } from '@/types/lore'
import { ENTRY_TYPE_LABELS } from '@/types/lore'

const NOVELS_DIR = 'novels'

// 路径工具函数（返回相对路径，由 getDataBase() 拼接前缀）
function loreDir(novelId: string) {
  return `${NOVELS_DIR}/${novelId}/lore`
}

function loreMetaPath(novelId: string) {
  return `${loreDir(novelId)}/lore.json`
}

function entryPath(novelId: string, filename: string) {
  return `${loreDir(novelId)}/entries/${filename}`
}

/**
 * 迁移旧 character 类型条目为 other（角色已由 Character 档案管理，Lore 不再保留 character 类型）。
 * 幂等：无 character 条目时返回 { changed: false }。
 */
function migrateLoreCharacterEntries(lore: Lore): { lore: Lore; changed: boolean } {
  let changed = false
  const entries = lore.entries.map((e) => {
    if ((e as { type?: string }).type === 'character') {
      changed = true
      return { ...e, type: 'other' as EntryType }
    }
    return e
  })
  if (!changed) return { lore, changed: false }
  return { lore: { ...lore, entries }, changed: true }
}

/** 加载或创建指定小说的资料库 */
export async function loadOrCreateLore(novel: Novel): Promise<Lore> {
  const appService = await useAppService()
  const fs = appService.fs
  const { base, pathPrefix: P } = getDataBase()

  const metaPath = P + loreMetaPath(novel.id)
  const exists = await fs.exists(metaPath, base).catch(() => false)

  if (exists) {
    const raw = await fs.readFile(metaPath, base, 'text').catch(() => null)
    if (raw && typeof raw === 'string') {
      try {
        const lore = JSON.parse(raw) as Lore
        // 迁移：旧 character 类型条目归一为 other（角色已由 Character 档案管理）
        const migrated = migrateLoreCharacterEntries(lore)
        if (migrated.changed) {
          await saveLoreMeta(migrated.lore).catch(() => {})
        }
        return migrated.lore
      } catch {
        // 格式错误时重建
      }
    }
  }

  // 不存在则新建空资料库
  const lore: Lore = {
    id: novel.id,
    novelTitle: novel.title,
    updatedAt: Date.now(),
    entries: [],
  }
  await saveLoreMeta(lore)
  return lore
}

/** 保存资料库元数据（含全部 EntryMeta） */
export async function saveLoreMeta(lore: Lore): Promise<void> {
  const appService = await useAppService()
  const fs = appService.fs
  const { base, pathPrefix: P } = getDataBase()

  const dir = P + loreDir(lore.id)
  await fs.createDir(dir, base, true).catch(() => {})
  await fs.createDir(`${dir}/entries`, base, true).catch(() => {})

  const updated = { ...lore, updatedAt: Date.now() }
  await fs.writeFile(P + loreMetaPath(lore.id), base, JSON.stringify(updated, null, 2))
}

/** 加载条目正文内容 */
export async function loadEntryContent(novelId: string, filename: string): Promise<string> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  const path = P + entryPath(novelId, filename)
  const exists = await appService.fs.exists(path, base).catch(() => false)
  if (!exists) return ''
  const content = await appService.fs.readFile(path, base, 'text')
  return typeof content === 'string' ? content : ''
}

/** 保存条目正文内容 */
export async function saveEntryContent(
  novelId: string,
  filename: string,
  content: string,
): Promise<void> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.writeFile(P + entryPath(novelId, filename), base, content)
}

/** 创建新条目（返回更新后的 lore 和新条目 meta） */
export async function createEntry(
  lore: Lore,
  meta: {
    name: string
    type?: EntryType
    importance?: EntryImportance
  },
): Promise<{ lore: Lore; entry: EntryMeta }> {
  const id = `entry-${Date.now()}`
  const filename = `${id}.md`

  const entry: EntryMeta = {
    id,
    filename,
    name: meta.name.trim() || '未命名条目',
    type: meta.type ?? 'other',
    importance: meta.importance ?? 'important',
    tags: [],
    briefDescription: '',
    keywords: [],
    enabled: true,
    order: lore.entries.length + 1,
  }

  // 创建空正文文件
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.createDir(P + `${loreDir(lore.id)}/entries`, base, true).catch(() => {})
  await appService.fs.writeFile(
    P + entryPath(lore.id, filename),
    base,
    `# ${entry.name}\n\n`,
  )

  const updatedLore: Lore = {
    ...lore,
    entries: [...lore.entries, entry],
    updatedAt: Date.now(),
  }
  await saveLoreMeta(updatedLore)

  return { lore: updatedLore, entry }
}

/** 更新条目元数据（部分更新） */
export async function updateEntryMeta(
  lore: Lore,
  entryId: string,
  patch: Partial<Omit<EntryMeta, 'id' | 'filename'>>,
): Promise<Lore> {
  const entries = lore.entries.map((e) =>
    e.id === entryId ? { ...e, ...patch } : e,
  )
  const updatedLore: Lore = { ...lore, entries, updatedAt: Date.now() }
  await saveLoreMeta(updatedLore)
  return updatedLore
}

/** 删除条目（同时删除正文文件） */
export async function deleteEntry(lore: Lore, entryId: string): Promise<Lore> {
  const entry = lore.entries.find((e) => e.id === entryId)
  if (!entry) return lore

  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  await appService.fs.removeFile(P + entryPath(lore.id, entry.filename), base).catch(() => {})

  const updatedLore: Lore = {
    ...lore,
    entries: lore.entries.filter((e) => e.id !== entryId),
    updatedAt: Date.now(),
  }
  await saveLoreMeta(updatedLore)
  return updatedLore
}

/**
 * 生成资料库的 AI 上下文文本
 * major 条目 → 需调用方传入完整内容（content 参数）
 * important/minor 条目 → 仅注入索引（名称 + 简介）
 */
export function buildLoreContext(
  lore: Lore,
  entryContents: Map<string, string>, // entryId → 完整正文
): string {
  const enabled = lore.entries.filter((e) => e.enabled)
  if (enabled.length === 0) return ''

  const lines: string[] = ['【资料库】', '']

  // 1. 常驻条目（major）→ 完整内容
  const majorEntries = enabled.filter((e) => e.importance === 'major')
  if (majorEntries.length > 0) {
    lines.push('## 重要设定')
    for (const entry of majorEntries) {
      const content = entryContents.get(entry.id) ?? ''
      lines.push(`### ${entry.name}（${ENTRY_TYPE_LABELS[entry.type]} · 主要）`)
      if (entry.keywords.length > 0) {
        lines.push(`别名：${entry.keywords.join('、')}`)
      }
      if (entry.briefDescription) {
        lines.push(`简介：${entry.briefDescription}`)
      }
      if (content.trim()) {
        lines.push(content)
      }
      lines.push('')
    }
  }

  // 2. 普通条目（important/minor）→ 索引
  const indexEntries = enabled.filter((e) => e.importance !== 'major')
  if (indexEntries.length > 0) {
    lines.push('## 资料索引')
    for (const entry of indexEntries) {
      const typeLabel = ENTRY_TYPE_LABELS[entry.type] ?? entry.type
      let line = `- ${entry.name}（${typeLabel}）`
      if (entry.briefDescription) {
        line += `：${entry.briefDescription}`
      }
      if (entry.keywords.length > 0) {
        line += ` [别名：${entry.keywords.join('/')}]`
      }
      lines.push(line)
    }
    lines.push('')
  }

  return lines.join('\n')
}
