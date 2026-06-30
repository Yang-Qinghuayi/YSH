/**
 * storyStateService.ts
 * 故事状态层的文件读写服务
 * 数据存储路径（Data 基目录下，与 novel.json / lore 同级）：
 *   novels/<novel-id>/story-state.json  ← 故事状态（角色动态状态/时间线/伏笔）
 */

import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'
import type { StoryState } from '@/types/storyState'

const NOVELS_DIR = 'novels'

function storyStatePath(novelId: string) {
  return `${NOVELS_DIR}/${novelId}/story-state.json`
}

/** 构造空骨架 */
export function emptyStoryState(novelId: string): StoryState {
  return {
    novelId,
    updatedAt: Date.now(),
    characterStates: [],
    timeline: [],
    foreshadowings: [],
  }
}

/** 加载故事状态（不存在则返回空骨架，不写盘） */
export async function loadStoryState(novelId: string): Promise<StoryState> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  const path = P + storyStatePath(novelId)

  const exists = await appService.fs.exists(path, base).catch(() => false)
  if (!exists) return emptyStoryState(novelId)

  const raw = await appService.fs.readFile(path, base, 'text').catch(() => null)
  if (!raw || typeof raw !== 'string') return emptyStoryState(novelId)

  try {
    const parsed = JSON.parse(raw) as Partial<StoryState>
    return {
      ...emptyStoryState(novelId),
      ...parsed,
      novelId,
      characterStates: parsed.characterStates ?? [],
      timeline: parsed.timeline ?? [],
      foreshadowings: parsed.foreshadowings ?? [],
    }
  } catch {
    return emptyStoryState(novelId)
  }
}

/** 保存故事状态 */
export async function saveStoryState(state: StoryState): Promise<void> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()

  const dir = P + `${NOVELS_DIR}/${state.novelId}`
  await appService.fs.createDir(dir, base, true).catch(() => {})

  const updated = { ...state, updatedAt: Date.now() }
  await appService.fs.writeFile(P + storyStatePath(state.novelId), base, JSON.stringify(updated, null, 2))
}

/** 按 characterName 取单个角色状态（不存在则返回 null） */
export function getCharacterState(
  state: StoryState,
  characterName: string,
): StoryState['characterStates'][number] | null {
  return state.characterStates.find((c) => c.characterName === characterName) ?? null
}
