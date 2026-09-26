/**
 * storyStateMerge.test.ts
 * 故事状态增量合并的回归测试（对应缺陷 7.2：未提交字段被静默清空）。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyStoryStatePatch,
  mergeCharacterState,
  mergeRelationships,
} from '../src/services/storyStateMerge.ts'
import type { StoryState } from '../src/types/storyState.ts'

function baseState(): StoryState {
  return {
    novelId: 'n1',
    updatedAt: 1,
    characterStates: [
      {
        characterName: '李明',
        mood: '沉着',
        location: '青城山',
        injuries: '左臂擦伤',
        possessions: ['青锋剑'],
        relationships: [
          { target: '苏婉', relation: '同门', sinceChapterId: 'c1' },
          { target: '赵括', relation: '宿敌' },
        ],
        notes: '刚拜入师门',
        lastUpdatedChapterId: 'c1',
        updatedAt: 1,
      },
    ],
    timeline: [{ id: 'tl-1', chapterId: 'c1', label: '入门', order: 0 }],
    foreshadowings: [
      { id: 'fs-1', description: '师父的旧伤', plantedChapterId: 'c1', status: 'open' },
    ],
  }
}

test('只提交变化字段时，其余字段必须原样保留', () => {
  const next = applyStoryStatePatch(
    baseState(),
    { characterStates: [{ characterName: '李明', mood: '狂喜' }] },
    'c2',
    999,
  )
  const character = next.characterStates[0]!
  assert.equal(character.mood, '狂喜', '提交字段应更新')
  assert.equal(character.location, '青城山', '未提交的 location 必须保留')
  assert.equal(character.injuries, '左臂擦伤', '未提交的 injuries 必须保留')
  assert.deepEqual(character.possessions, ['青锋剑'], '未提交的 possessions 必须保留')
  assert.equal(character.notes, '刚拜入师门', '未提交的 notes 必须保留')
  assert.equal(character.relationships.length, 2, '未提交时不得清空关系')
  assert.equal(character.lastUpdatedChapterId, 'c2', '溯源章节应更新')
})

test('关系按 target 合并：同名覆盖、未提及保留、新关系追加', () => {
  const next = applyStoryStatePatch(
    baseState(),
    {
      characterStates: [
        {
          characterName: '李明',
          relationships: [
            { target: '赵括', relation: '化敌为友' },
            { target: '玄机子', relation: '师徒' },
          ],
        },
      ],
    },
    'c3',
    1000,
  )
  const rels = next.characterStates[0]!.relationships
  assert.equal(rels.length, 3, '应按 target 合并而非整体替换')
  assert.equal(rels.find((r) => r.target === '赵括')?.relation, '化敌为友')
  assert.equal(rels.find((r) => r.target === '苏婉')?.relation, '同门', '未提及的关系应保留')
  assert.equal(rels.find((r) => r.target === '玄机子')?.relation, '师徒', '新关系应追加')
})

test('新角色 / 时间线 / 伏笔追加，且 id 与 order 正确', () => {
  const next = applyStoryStatePatch(
    baseState(),
    {
      characterStates: [{ characterName: '苏婉', mood: '担忧' }],
      timeline: [{ label: '下山', detail: '第三章末' }],
      foreshadowings: [{ description: '玉佩的来历' }],
    },
    'c4',
    1001,
  )
  assert.equal(next.characterStates.length, 2)
  assert.deepEqual(next.characterStates[1]!.relationships, [], '新角色的关系为空数组')
  assert.equal(next.characterStates[1]!.mood, '担忧')
  assert.equal(next.timeline.length, 2)
  assert.equal(next.timeline[1]!.order, 1, 'append 的 order 取当前长度')
  assert.equal(next.timeline[1]!.chapterId, 'c4')
  assert.equal(next.foreshadowings[1]!.status, 'open', '伏笔默认 open')
})

test('纯函数：不修改入参', () => {
  const state = baseState()
  applyStoryStatePatch(
    state,
    {
      characterStates: [{ characterName: '李明', location: '江南' }],
      timeline: [{ label: 'x' }],
    },
    'c5',
    1,
  )
  assert.equal(state.characterStates[0]!.location, '青城山', '原状态不应被修改')
  assert.equal(state.timeline.length, 1, '原 timeline 不应被修改')
})

test('空补丁与畸形补丁安全', () => {
  const state = baseState()
  const empty = applyStoryStatePatch(state, {}, 'c6', 2)
  assert.deepEqual(empty.characterStates, state.characterStates)

  const malformed = applyStoryStatePatch(
    state,
    {
      characterStates: [
        { characterName: '' },
        {} as { characterName: string },
      ],
      timeline: [{ label: '' }],
    },
    'c7',
    3,
  )
  assert.equal(malformed.characterStates.length, 1, '缺少 characterName 的条目应被忽略')
  assert.equal(malformed.timeline.length, 1, '缺少 label 的时间线应被忽略')
})

test('mergeCharacterState / mergeRelationships 单元行为', () => {
  const merged = mergeCharacterState(
    undefined,
    { characterName: '新人', injuries: '轻伤' },
    'c9',
    42,
  )
  assert.equal(merged.mood, undefined)
  assert.equal(merged.injuries, '轻伤')
  assert.equal(merged.updatedAt, 42)
  assert.deepEqual(merged.relationships, [])

  const prev = [{ target: 'A', relation: '旧' }]
  assert.equal(mergeRelationships(prev, undefined), prev, '无提交时原样返回')
  assert.deepEqual(
    mergeRelationships(prev, [{ target: '', relation: '空 target 应忽略' }]),
    prev,
  )
})
