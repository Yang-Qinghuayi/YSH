/**
 * storyMemory.ts
 * 人物记忆（长期记忆 Skill + 短期记忆 POV）与整体进度的纯函数层：
 * 无 IO、无框架依赖，可直接单测。
 *
 *   - normalizeStoryState：容错规整磁盘上的 v2 结构
 *   - applyShortTermMemories：按角色整段改写短期记忆
 *   - applyLongTermChange / revertLongTermChange：改写 / 回滚长期记忆（Skill），并记日志
 *   - setShortTermMemory / renameCharactersInState：作者手动编辑、角色改名
 *   - beginFinalize：定稿前快照；同一章重新定稿时先恢复到「本章之前」
 *   - formatCharacterBlock / formatMainline / POV_RULES：写作 prompt 片段
 */

import type { Character, ChapterMeta } from '@/types/novel'
import type {
  StoryState,
  CharacterMemory,
  LongTermChange,
} from '@/types/storyState'

/** 短期记忆单条上限（字符）：超出截断，防止 prompt 膨胀 */
export const SHORT_TERM_MAX_CHARS = 800
/** 整体进度上限（字符） */
export const MAINLINE_MAX_CHARS = 1500

// ===================== 规整 =====================

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** 把任意 JSON 规整为合法的 v2 StoryState（缺失字段补默认，坏条目丢弃） */
export function normalizeStoryState(raw: unknown, novelId: string): StoryState {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const memories = Array.isArray(obj.characterMemories) ? obj.characterMemories : []
  const log = Array.isArray(obj.longTermLog) ? obj.longTermLog : []

  const characterMemories: CharacterMemory[] = memories
    .filter((m) => m && typeof m === 'object' && str((m as CharacterMemory).characterName))
    .map((m) => {
      const x = m as CharacterMemory
      return {
        characterName: x.characterName,
        shortTerm: str(x.shortTerm),
        lastUpdatedChapterId: str(x.lastUpdatedChapterId),
        updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : 0,
      }
    })

  const longTermLog: LongTermChange[] = log
    .filter((c) => c && typeof c === 'object' && str((c as LongTermChange).characterName))
    .map((c) => {
      const x = c as LongTermChange
      return {
        id: str(x.id) || `lt-${Math.random().toString(36).slice(2, 10)}`,
        characterName: x.characterName,
        chapterId: str(x.chapterId),
        reason: str(x.reason),
        before: str(x.before),
        after: str(x.after),
        at: typeof x.at === 'number' ? x.at : 0,
        revertedAt: typeof x.revertedAt === 'number' ? x.revertedAt : undefined,
      }
    })

  const snap = obj.lastFinalize as StoryState['lastFinalize'] | undefined
  const lastFinalize =
    snap && typeof snap === 'object' && str(snap.chapterId)
      ? {
          chapterId: snap.chapterId,
          mainline: str(snap.mainline),
          mainlineUpdatedChapterId: snap.mainlineUpdatedChapterId || undefined,
          characterMemories: normalizeStoryState(
            { characterMemories: snap.characterMemories },
            novelId,
          ).characterMemories,
        }
      : undefined

  return {
    version: 2,
    novelId,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
    mainline: str(obj.mainline),
    mainlineUpdatedChapterId: str(obj.mainlineUpdatedChapterId) || undefined,
    characterMemories,
    longTermLog,
    lastFinalize,
  }
}

// ===================== 短期记忆 =====================

export interface ShortTermPatch {
  characterName: string
  shortTerm: string
}

/**
 * 按角色整段改写短期记忆（返回新对象，不改入参）。
 * - 只改补丁里出现的角色；未出现的角色（本章未出场/未得知新信息）保持原样 —— 这就是 POV 信息差；
 * - shortTerm 为空的补丁忽略（避免模型漏填把记忆清空）；
 * - 同名多条以最后一条为准。
 */
export function applyShortTermMemories(
  state: StoryState,
  patches: ShortTermPatch[],
  chapterId: string,
  now: number = Date.now(),
): { state: StoryState; updated: string[] } {
  const memories = state.characterMemories.map((m) => ({ ...m }))
  const updated: string[] = []
  for (const p of patches ?? []) {
    const name = str(p?.characterName).trim()
    const text = str(p?.shortTerm).trim().slice(0, SHORT_TERM_MAX_CHARS)
    if (!name || !text) continue
    const next: CharacterMemory = {
      characterName: name,
      shortTerm: text,
      lastUpdatedChapterId: chapterId,
      updatedAt: now,
    }
    const idx = memories.findIndex((m) => m.characterName === name)
    if (idx >= 0) memories[idx] = next
    else memories.push(next)
    if (!updated.includes(name)) updated.push(name)
  }
  return { state: { ...state, characterMemories: memories }, updated }
}

// ===================== 长期记忆（Skill） =====================

export interface LongTermPatch {
  characterName: string
  reason: string
  revisedSkill: string
}

/**
 * 改写某角色的长期记忆（Skill），并追加改写日志。
 * 返回 null 表示未改动（角色不存在 / 新 Skill 为空 / 与原文相同）。
 */
export function applyLongTermChange(
  characters: Character[],
  state: StoryState,
  patch: LongTermPatch,
  chapterId: string,
  now: number = Date.now(),
): { characters: Character[]; state: StoryState; change: LongTermChange } | null {
  const name = str(patch?.characterName).trim()
  const after = str(patch?.revisedSkill).trim()
  if (!name || !after) return null
  const idx = characters.findIndex((c) => c.name === name)
  if (idx < 0) return null
  const before = characters[idx].skill ?? ''
  if (before.trim() === after) return null

  const change: LongTermChange = {
    id: `lt-${now}-${Math.random().toString(36).slice(2, 8)}`,
    characterName: name,
    chapterId,
    reason: str(patch.reason).trim() || '（未说明）',
    before,
    after,
    at: now,
  }
  const nextChars = characters.map((c, i) => (i === idx ? { ...c, skill: after } : c))
  return {
    characters: nextChars,
    state: { ...state, longTermLog: [...state.longTermLog, change] },
    change,
  }
}

/**
 * 回滚一次长期记忆改写：把角色 Skill 恢复为改写前的文本，并标记 revertedAt。
 * 返回 null 表示无法回滚（记录不存在 / 已回滚 / 角色已删除）。
 */
export function revertLongTermChange(
  characters: Character[],
  state: StoryState,
  changeId: string,
  now: number = Date.now(),
): { characters: Character[]; state: StoryState; revertedIds: string[] } | null {
  const change = state.longTermLog.find((c) => c.id === changeId)
  if (!change || change.revertedAt) return null
  const idx = characters.findIndex((c) => c.name === change.characterName)
  if (idx < 0) return null
  // 回到这次改写之前 = 这次及其之后对同一角色的改写一并作废（否则 before 会覆盖掉后来的改写）
  const pos = state.longTermLog.indexOf(change)
  const revertedIds = state.longTermLog
    .filter(
      (c, i) => i >= pos && !c.revertedAt && c.characterName === change.characterName,
    )
    .map((c) => c.id)
  return {
    characters: characters.map((c, i) => (i === idx ? { ...c, skill: change.before } : c)),
    state: {
      ...state,
      longTermLog: state.longTermLog.map((c) =>
        revertedIds.includes(c.id) ? { ...c, revertedAt: now } : c,
      ),
    },
    revertedIds,
  }
}

// ===================== 手动编辑 / 改名 =====================

/**
 * 作者手动编辑某角色短期记忆：保留原 lastUpdatedChapterId；清空文本即删除该条记忆。
 */
export function setShortTermMemory(
  state: StoryState,
  characterName: string,
  shortTerm: string,
  now: number = Date.now(),
): StoryState {
  const text = shortTerm.trim()
  const rest = state.characterMemories.filter((m) => m.characterName !== characterName)
  if (!text) return { ...state, characterMemories: rest }
  const prev = state.characterMemories.find((m) => m.characterName === characterName)
  const next: CharacterMemory = {
    characterName,
    shortTerm: text,
    lastUpdatedChapterId: prev?.lastUpdatedChapterId ?? '',
    updatedAt: now,
  }
  return {
    ...state,
    characterMemories: prev
      ? state.characterMemories.map((m) => (m.characterName === characterName ? next : m))
      : [...rest, next],
  }
}

/**
 * 角色改名：故事状态按角色名关联，改名时同步短期记忆、改写日志与定稿快照。
 * renames: 旧名 → 新名
 */
export function renameCharactersInState(
  state: StoryState,
  renames: Record<string, string>,
): StoryState {
  const keys = Object.keys(renames).filter((k) => renames[k] && renames[k] !== k)
  if (!keys.length) return state
  const rn = (name: string) => (keys.includes(name) ? renames[name] : name)
  return {
    ...state,
    characterMemories: state.characterMemories.map((m) => ({
      ...m,
      characterName: rn(m.characterName),
    })),
    longTermLog: state.longTermLog.map((c) => ({ ...c, characterName: rn(c.characterName) })),
    lastFinalize: state.lastFinalize
      ? {
          ...state.lastFinalize,
          characterMemories: state.lastFinalize.characterMemories.map((m) => ({
            ...m,
            characterName: rn(m.characterName),
          })),
        }
      : undefined,
  }
}

// ===================== 定稿快照 =====================

/**
 * 定稿开始前调用：
 * - 若上一次定稿就是这一章（重新定稿），先把整体进度与短期记忆恢复到「本章之前」，
 *   并回滚这一章产生的、尚未回滚的长期记忆改写（由模型重新判断）；
 * - 然后记录新的快照。
 */
export function beginFinalize(
  characters: Character[],
  state: StoryState,
  chapterId: string,
  now: number = Date.now(),
): { characters: Character[]; state: StoryState; refinalized: boolean } {
  let chars = characters
  let s: StoryState = state
  const refinalized = state.lastFinalize?.chapterId === chapterId

  if (refinalized && state.lastFinalize) {
    const snap = state.lastFinalize
    s = {
      ...s,
      mainline: snap.mainline,
      mainlineUpdatedChapterId: snap.mainlineUpdatedChapterId,
      characterMemories: snap.characterMemories.map((m) => ({ ...m })),
    }
    // 倒序回滚本章的长期记忆改写（多次改写同一角色时能回到最初）
    const toRevert = [...s.longTermLog]
      .filter((c) => c.chapterId === chapterId && !c.revertedAt)
      .reverse()
    for (const c of toRevert) {
      const r = revertLongTermChange(chars, s, c.id, now)
      if (r) {
        chars = r.characters
        s = r.state
      }
    }
  }

  s = {
    ...s,
    lastFinalize: {
      chapterId,
      mainline: s.mainline,
      mainlineUpdatedChapterId: s.mainlineUpdatedChapterId,
      characterMemories: s.characterMemories.map((m) => ({ ...m })),
    },
  }
  return { characters: chars, state: s, refinalized }
}

// ===================== prompt 片段 =====================

/** POV 认知规则：续写 / 写新章时注入 system prompt */
export const POV_RULES = [
  '【POV 认知规则（必须遵守）】',
  '1. 每个角色只知道自己「短期记忆」里的信息和在本章亲历的事。角色的台词、内心独白、判断与行动，只能基于 TA 自己知道的事。',
  '2. 读者或其他角色知道、但该角色不知道的信息，不得出现在该角色的言行与心理中；可以用误会、猜测、试探来制造张力。',
  '3. 角色若在本章得知新信息，正文里要写出 TA 得知的过程（亲眼所见 / 被告知 / 推理），不能凭空知道。',
  '4. 角色的反应要符合其「长期记忆（Skill）」中的性格、信念与说话方式；短期记忆里的情绪与处境要自然延续。',
].join('\n')

function clip(s: string, n: number): string {
  const t = s.trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

/**
 * 人物清单：每个角色的长期记忆（Skill）+ 短期记忆（POV）。
 * fullSkill=false 时 Skill 只给摘要（完整内容由 select_characters 工具按需取回）。
 */
export function formatCharacterBlock(
  characters: Character[],
  state: StoryState | null | undefined,
  opts: { fullSkill?: boolean; chapters?: ChapterMeta[]; skillPreviewChars?: number } = {},
): string {
  if (!characters.length) return ''
  const memories = state?.characterMemories ?? []
  const chapterTitle = (id: string) =>
    opts.chapters?.find((c) => c.id === id)?.title ?? ''
  const lines: string[] = [
    '【人物】（长期记忆 Skill 决定 TA 是谁；短期记忆是 TA 此刻的认知，以 TA 的视角书写）',
  ]
  for (const c of characters) {
    lines.push(`◆ @${c.name}（id: ${c.id}）`)
    const skill = (c.skill ?? '').trim()
    lines.push(
      `  · 长期记忆（Skill）：${
        skill ? (opts.fullSkill ? skill : clip(skill, opts.skillPreviewChars ?? 120)) : '（未填写）'
      }`,
    )
    const mem = memories.find((m) => m.characterName === c.name)
    if (mem?.shortTerm.trim()) {
      const title = chapterTitle(mem.lastUpdatedChapterId)
      lines.push(`  · 短期记忆（POV${title ? `，截至《${title}》` : ''}）：${mem.shortTerm.trim()}`)
    } else {
      lines.push('  · 短期记忆（POV）：（暂无）')
    }
  }
  return lines.join('\n')
}

/**
 * 续写 / 写新章任务里的 POV 提醒：列出各角色此刻的短期记忆（只含 TA 知道的信息）。
 * 与 system prompt 中的 POV_RULES 配合，确保写作任务本身也带着 POV。
 */
export function formatPovReminder(
  characters: Character[],
  state: StoryState | null | undefined,
): string {
  if (!characters.length) return ''
  const names = new Set(characters.map((c) => c.name))
  const memories = (state?.characterMemories ?? []).filter(
    (m) => names.has(m.characterName) && m.shortTerm.trim(),
  )
  const lines = [
    '【POV 提醒】写作时每个角色只能基于 TA 自己知道的信息说话、思考和行动；本章新得知的信息要写出得知的过程。',
  ]
  if (memories.length) {
    lines.push('各角色此刻的认知（短期记忆）：')
    for (const m of memories) lines.push(`- ${m.characterName}：${m.shortTerm.trim()}`)
  } else {
    lines.push('（暂无角色短期记忆，按各角色的长期记忆与前文把握 TA 知道什么）')
  }
  return lines.join('\n')
}

/** 整体进度片段（为空返回 ''） */
export function formatMainline(state: StoryState | null | undefined): string {
  const m = state?.mainline?.trim()
  return m ? `【整体进度】\n${m}` : ''
}

/**
 * 故事状态 → 文本（read_story_state 工具使用）。
 * characterNames 为空时返回全部角色的短期记忆。
 */
export function formatStoryStateForTool(
  state: StoryState,
  opts: {
    section?: 'mainline' | 'memories' | 'all'
    characterNames?: string[]
    chapters?: ChapterMeta[]
  } = {},
): string {
  const section = opts.section ?? 'all'
  const lines: string[] = []
  if (section === 'mainline' || section === 'all') {
    lines.push(`整体进度：${state.mainline.trim() || '暂无'}`)
  }
  if (section === 'memories' || section === 'all') {
    const names = (opts.characterNames ?? []).filter(Boolean)
    const list = names.length
      ? state.characterMemories.filter((m) => names.includes(m.characterName))
      : state.characterMemories
    if (!list.length) {
      lines.push('角色短期记忆：暂无')
    } else {
      lines.push('角色短期记忆（POV，只含该角色知道的信息）：')
      for (const m of list) {
        const title = opts.chapters?.find((c) => c.id === m.lastUpdatedChapterId)?.title
        lines.push(`- ${m.characterName}${title ? `（截至《${title}》）` : ''}：${m.shortTerm}`)
      }
    }
    const missing = names.filter((n) => !state.characterMemories.some((m) => m.characterName === n))
    if (missing.length) lines.push(`（${missing.join('、')} 暂无短期记忆）`)
  }
  return lines.join('\n')
}

/** 清理模型输出的整体进度：去协议标记与代码围栏，保留段落，限长 */
export function cleanMainline(text: string): string {
  return text
    .replace(/<<<[\s\S]*?>>>/g, '')
    .replace(/```[a-zA-Z]*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAINLINE_MAX_CHARS)
}
