/**
 * storyStateService.ts
 * 故事状态（v2）的文件读写服务
 * 数据存储路径（扁平结构，与 novel.json / lore 同级，均在小说文件夹根）：
 *   <小说文件夹>/story-state.json  ← 整体进度 + 角色短期记忆 + 长期记忆改写日志
 *
 * 旧版（v1：心情/位置/伤势/关系/时间线/伏笔）不再迁移：首次读取时原样备份为
 * story-state.v1.bak.json，然后按空状态处理。
 */

import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'
import { normalizeStoryState } from '@/services/storyMemory'
import type { StoryState } from '@/types/storyState'

const STORY_STATE_FILE = 'story-state.json'
const LEGACY_BACKUP_FILE = 'story-state.v1.bak.json'

/** 构造空骨架 */
export function emptyStoryState(novelId: string): StoryState {
  return {
    version: 2,
    novelId,
    updatedAt: Date.now(),
    mainline: '',
    characterMemories: [],
    longTermLog: [],
  }
}

/** 加载故事状态（不存在则返回空骨架，不写盘）。novelId 仅用于写元数据，不参与路径 */
export async function loadStoryState(novelId: string): Promise<StoryState> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  const path = P + STORY_STATE_FILE

  const exists = await appService.fs.exists(path, base).catch(() => false)
  if (!exists) return emptyStoryState(novelId)

  const raw = await appService.fs.readFile(path, base, 'text').catch(() => null)
  if (!raw || typeof raw !== 'string') return emptyStoryState(novelId)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyStoryState(novelId)
  }

  if ((parsed as { version?: unknown })?.version !== 2) {
    // 旧版结构：备份一次后丢弃（不覆盖已有备份）
    const bak = P + LEGACY_BACKUP_FILE
    const hasBak = await appService.fs.exists(bak, base).catch(() => false)
    if (!hasBak) await appService.fs.writeFile(bak, base, raw).catch(() => {})
    return emptyStoryState(novelId)
  }

  return normalizeStoryState(parsed, novelId)
}

/** 保存故事状态，返回写入磁盘的最终对象（含 updatedAt） */
export async function saveStoryState(state: StoryState): Promise<StoryState> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()

  // 确保小说文件夹根存在
  await appService.fs.createDir(P, base, true).catch(() => {})

  const updated: StoryState = { ...state, version: 2, updatedAt: Date.now() }
  await appService.fs.writeFile(P + STORY_STATE_FILE, base, JSON.stringify(updated, null, 2))
  return updated
}
