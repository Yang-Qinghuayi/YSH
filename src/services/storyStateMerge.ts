/**
 * storyStateMerge.ts
 * 故事状态补丁的合并规则（纯函数：无 IO、无框架依赖，可直接单测）。
 *
 * 语义 —— 增量合并：
 *   - 只覆盖补丁中「明确提供」的字段，未提供的字段保留原值，避免模型漏填导致状态被静默清空；
 *   - 角色按 characterName 匹配更新或新增；
 *   - relationships 按 target 合并（同名覆盖、未提及保留），属于历史沉淀型数据；
 *   - timeline / foreshadowings 一律追加。
 */

import type {
  StoryState,
  CharacterState,
  Relationship,
  TimelineNode,
  Foreshadowing,
} from '@/types/storyState'

/** 补丁中的角色状态：字段全部可选，仅提供的字段生效 */
export type CharacterStatePatch = Partial<CharacterState> & { characterName: string }

/** 补丁中的时间线节点 */
export interface TimelinePatch {
  label: string
  detail?: string
}

/** 补丁中的伏笔 */
export interface ForeshadowingPatch {
  description: string
  status?: Foreshadowing['status']
}

/** 故事状态补丁 */
export interface StoryStatePatch {
  characterStates?: CharacterStatePatch[]
  timeline?: TimelinePatch[]
  foreshadowings?: ForeshadowingPatch[]
}

/**
 * 人物关系按 target 合并：本次提交的同名关系覆盖旧值，未提及的关系保留。
 */
export function mergeRelationships(
  prev: Relationship[],
  incoming?: Relationship[],
): Relationship[] {
  if (!incoming || incoming.length === 0) return prev
  const merged = prev.map((r) => ({ ...r }))
  for (const rel of incoming) {
    if (!rel || !rel.target) continue
    const i = merged.findIndex((m) => m.target === rel.target)
    if (i >= 0) merged[i] = { ...merged[i], ...rel }
    else merged.push({ ...rel })
  }
  return merged
}

/** 合并单个角色的状态：未提供的字段保留原值 */
export function mergeCharacterState(
  prev: CharacterState | undefined,
  patch: CharacterStatePatch,
  chapterId: string,
  now: number,
): CharacterState {
  return {
    characterName: patch.characterName,
    mood: patch.mood !== undefined ? patch.mood : prev?.mood,
    location: patch.location !== undefined ? patch.location : prev?.location,
    injuries: patch.injuries !== undefined ? patch.injuries : prev?.injuries,
    possessions: patch.possessions !== undefined ? patch.possessions : prev?.possessions,
    relationships: mergeRelationships(prev?.relationships ?? [], patch.relationships),
    notes: patch.notes !== undefined ? patch.notes : prev?.notes,
    lastUpdatedChapterId: chapterId,
    updatedAt: now,
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * 把补丁应用到故事状态，返回新对象（不改动入参）。
 */
export function applyStoryStatePatch(
  state: StoryState,
  patch: StoryStatePatch,
  chapterId: string,
  now: number = Date.now(),
): StoryState {
  const characterStates: CharacterState[] = state.characterStates.map((c) => ({
    ...c,
    relationships: (c.relationships ?? []).map((r) => ({ ...r })),
  }))

  for (const p of patch.characterStates ?? []) {
    if (!p?.characterName) continue
    const idx = characterStates.findIndex((s) => s.characterName === p.characterName)
    const merged = mergeCharacterState(
      idx >= 0 ? characterStates[idx] : undefined,
      p,
      chapterId,
      now,
    )
    if (idx >= 0) characterStates[idx] = merged
    else characterStates.push(merged)
  }

  const timeline: TimelineNode[] = [...state.timeline]
  for (const t of patch.timeline ?? []) {
    if (!t?.label) continue
    timeline.push({
      id: `tl-${now}-${randomSuffix()}`,
      chapterId,
      label: t.label,
      detail: t.detail,
      order: timeline.length,
    })
  }

  const foreshadowings: Foreshadowing[] = [...state.foreshadowings]
  for (const f of patch.foreshadowings ?? []) {
    if (!f?.description) continue
    foreshadowings.push({
      id: `fs-${now}-${randomSuffix()}`,
      description: f.description,
      plantedChapterId: chapterId,
      status: f.status ?? 'open',
    })
  }

  return { ...state, characterStates, timeline, foreshadowings }
}
