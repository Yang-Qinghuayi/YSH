/**
 * storyStateService.ts
 * 故事状态层的文件读写服务
 * 数据存储路径（扁平结构，与 novel.json / lore 同级，均在小说文件夹根）：
 *   <小说文件夹>/story-state.json  ← 故事状态（角色动态状态/时间线/伏笔）
 */

import { useAppService } from '@/hooks/useEnv'
import { getDataBase } from '@/services/workspaceService'
import type { StoryState } from '@/types/storyState'

function storyStatePath() {
  return 'story-state.json'
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

/** 加载故事状态（不存在则返回空骨架，不写盘）。novelId 仅用于写元数据，不参与路径 */
export async function loadStoryState(novelId: string): Promise<StoryState> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()
  const path = P + storyStatePath()

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

/** 保存故事状态，返回写入磁盘的最终对象（含 updatedAt） */
export async function saveStoryState(state: StoryState): Promise<StoryState> {
  const appService = await useAppService()
  const { base, pathPrefix: P } = getDataBase()

  // 确保小说文件夹根存在
  await appService.fs.createDir(P, base, true).catch(() => {})

  const updated = { ...state, updatedAt: Date.now() }
  await appService.fs.writeFile(P + storyStatePath(), base, JSON.stringify(updated, null, 2))
  return updated
}

/** 按 characterName 取单个角色状态（不存在则返回 null） */
export function getCharacterState(
  state: StoryState,
  characterName: string,
): StoryState['characterStates'][number] | null {
  return state.characterStates.find((c) => c.characterName === characterName) ?? null
}
