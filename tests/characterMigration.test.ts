/**
 * characterMigration.test.ts
 * 角色迁移：所有历史字段并入 skill（长期记忆），且幂等、修复「出身背景：」堆叠 bug。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  migrateCharacter,
  migrateCharacters,
  needsCharacterMigration,
  stripStackedBackgroundPrefix,
} from '../src/services/characterMigration.ts'

test('上一版 profile + aliases + literaryReference → 只剩 name + skill', () => {
  const c = migrateCharacter({
    id: 'c1',
    name: '李明',
    profile: '寒门出身，性格坚毅。',
    aliases: ['青衫客', '小李'],
    literaryReference: '令狐冲',
  })
  assert.deepEqual(Object.keys(c).sort(), ['id', 'name', 'skill'])
  assert.equal(c.id, 'c1')
  assert.equal(c.name, '李明')
  assert.equal(c.skill, '寒门出身，性格坚毅。\n别名：青衫客、小李\n文学形象参考：令狐冲')
})

test('修复旧迁移 bug：开头堆叠的「出身背景：」全部去掉', () => {
  assert.equal(stripStackedBackgroundPrefix('出身背景：出身背景：出身背景：寒门子弟'), '寒门子弟')
  assert.equal(stripStackedBackgroundPrefix(' 出身背景: 出身背景：寒门'), '寒门')
  assert.equal(stripStackedBackgroundPrefix('寒门，出身背景：不详'), '寒门，出身背景：不详', '只去开头')
  const c = migrateCharacter({ id: 'c1', name: '李明', profile: '出身背景：出身背景：寒门子弟' })
  assert.equal(c.skill, '寒门子弟')
})

test('最早一版 skills[] 与中间版结构化字段都并入 skill', () => {
  const c = migrateCharacter({
    id: 'c2',
    name: '苏婉',
    personality: '外柔内刚',
    background: '医馆之女',
    appearance: '清秀',
    hobbies: '抚琴',
    skills: [{ name: '医术', prompt: '擅长针灸' }, { prompt: '说话温和' }, null],
    voice: { prompt: '黄蓉' },
  })
  assert.equal(
    c.skill,
    ['性格：外柔内刚', '出身背景：医馆之女', '外貌：清秀', '爱好：抚琴', '医术：擅长针灸', '说话温和', '文学形象参考：黄蓉'].join('\n'),
  )
})

test('幂等：迁移结果不再触发迁移；已有 skill 与旧字段合并时去重', () => {
  const once = migrateCharacter({ id: 'c1', name: '李明', profile: '剑客' })
  assert.equal(needsCharacterMigration(once), false)
  assert.deepEqual(migrateCharacters([once]), { characters: [once], changed: false })

  const dup = migrateCharacter({ id: 'c1', name: '李明', skill: '剑客', profile: '剑客' })
  assert.equal(dup.skill, '剑客')
})

test('migrateCharacters：只迁移需要的条目并报告 changed；空字段不产生 skill', () => {
  const list = [
    { id: 'a', name: '甲', skill: '已是新结构' },
    { id: 'b', name: '乙', profile: '', aliases: [] },
  ]
  const { characters, changed } = migrateCharacters(list)
  assert.equal(changed, true)
  assert.equal(characters[0], list[0], '新结构条目原样保留')
  assert.deepEqual(characters[1], { id: 'b', name: '乙' })
  assert.deepEqual(migrateCharacters(undefined), { characters: [], changed: false })
})
