/**
 * characterMigration.ts
 * 角色数据迁移（纯函数，可单测）。
 *
 * 人物现在只剩 { id, name, skill }：skill = 长期记忆。历史上出现过的所有字段都并入 skill：
 *   - 最早一版：profile（背景）+ skills[]（技能/文风）
 *   - 中间一版：personality / background / appearance / hobbies / voice / description
 *   - 上一版：profile（角色描述）+ aliases（别名）+ literaryReference（文学形象参考）
 *
 * 顺带清理旧迁移代码的 bug 留下的痕迹：旧代码把「上一版」的 profile 误判为最早一版，
 * 每次打开小说都会在前面再加一层「出身背景：」，这里把开头堆叠的前缀全部去掉。
 */

import type { Character } from '@/types/novel'

const LEGACY_KEYS = [
  'profile',
  'skills',
  'aliases',
  'literaryReference',
  'personality',
  'background',
  'appearance',
  'hobbies',
  'voice',
  'description',
] as const

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 去掉开头堆叠的「出身背景：」前缀（旧迁移 bug 的产物） */
export function stripStackedBackgroundPrefix(s: string): string {
  return s.replace(/^(?:\s*出身背景[：:]\s*)+/, '').trim()
}

/** 是否含任何旧字段（需要迁移） */
export function needsCharacterMigration(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  return LEGACY_KEYS.some((k) => k in obj)
}

/** 把任意历史版本的角色对象迁移为 { id, name, skill } */
export function migrateCharacter(raw: unknown): Character {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const parts: string[] = []

  const existing = text(obj.skill)
  if (existing) parts.push(existing)

  const profile = stripStackedBackgroundPrefix(text(obj.profile))
  if (profile) parts.push(profile)

  if (text(obj.personality)) parts.push(`性格：${text(obj.personality)}`)
  if (text(obj.background)) parts.push(`出身背景：${text(obj.background)}`)
  if (text(obj.appearance)) parts.push(`外貌：${text(obj.appearance)}`)
  if (text(obj.hobbies)) parts.push(`爱好：${text(obj.hobbies)}`)

  // 最早一版的 skills[]：{ name, prompt }
  if (Array.isArray(obj.skills)) {
    for (const s of obj.skills) {
      if (!s || typeof s !== 'object') continue
      const name = text((s as Record<string, unknown>).name)
      const prompt = text((s as Record<string, unknown>).prompt)
      if (prompt) parts.push(name ? `${name}：${prompt}` : prompt)
    }
  }

  if (Array.isArray(obj.aliases)) {
    const aliases = obj.aliases.map(text).filter(Boolean)
    if (aliases.length) parts.push(`别名：${aliases.join('、')}`)
  }

  const voice = obj.voice as Record<string, unknown> | undefined
  const literary =
    text(obj.literaryReference) ||
    text(voice?.prompt) ||
    text(voice?.description) ||
    text(obj.description)
  if (literary) parts.push(`文学形象参考：${literary}`)

  // 去重（同一段文字可能经多次迁移重复出现）
  const unique = parts.filter((p, i) => parts.indexOf(p) === i)
  const character: Character = {
    id: text(obj.id) || `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: text(obj.name),
  }
  if (unique.length) character.skill = unique.join('\n')
  return character
}

/** 迁移整部小说的角色列表：{ characters, changed } */
export function migrateCharacters(list: unknown): { characters: Character[]; changed: boolean } {
  if (!Array.isArray(list)) return { characters: [], changed: list !== undefined }
  let changed = false
  const characters = list.map((c) => {
    if (needsCharacterMigration(c)) {
      changed = true
      return migrateCharacter(c)
    }
    return c as Character
  })
  return { characters, changed }
}
