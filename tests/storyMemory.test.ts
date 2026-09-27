/**
 * storyMemory.test.ts
 * 人物记忆纯函数层：短期记忆改写 / 长期记忆改写与回滚 / 定稿快照（重新定稿）/ prompt 片段。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeStoryState,
  applyShortTermMemories,
  applyLongTermChange,
  revertLongTermChange,
  setShortTermMemory,
  renameCharactersInState,
  beginFinalize,
  formatCharacterBlock,
  formatMainline,
  formatStoryStateForTool,
  cleanMainline,
  SHORT_TERM_MAX_CHARS,
  MAINLINE_MAX_CHARS,
} from '../src/services/storyMemory.ts'

const chars = () => [
  { id: 'c1', name: '李明', skill: '寒门剑客，重义。' },
  { id: 'c2', name: '苏婉', skill: '医馆之女。' },
]
const empty = () => normalizeStoryState({}, 'n1')

test('normalizeStoryState：坏数据容错，补齐 v2 默认值', () => {
  const s = normalizeStoryState(
    {
      mainline: '主线',
      characterMemories: [{ characterName: '李明', shortTerm: '知道A' }, { shortTerm: '无名' }, null],
      longTermLog: [{ characterName: '李明', before: 'x', after: 'y' }, 42],
      lastFinalize: { chapterId: 'ch1', characterMemories: [{ characterName: '苏婉', shortTerm: 's' }] },
    },
    'n1',
  )
  assert.equal(s.version, 2)
  assert.equal(s.novelId, 'n1')
  assert.equal(s.mainline, '主线')
  assert.deepEqual(s.characterMemories.map((m) => m.characterName), ['李明'])
  assert.equal(s.characterMemories[0].lastUpdatedChapterId, '')
  assert.equal(s.longTermLog.length, 1)
  assert.ok(s.longTermLog[0].id, '缺 id 时补一个')
  assert.equal(s.lastFinalize?.chapterId, 'ch1')
  assert.equal(s.lastFinalize?.characterMemories[0].characterName, '苏婉')
  assert.equal(normalizeStoryState(null, 'n1').characterMemories.length, 0)
})

test('applyShortTermMemories：只改提交的角色（POV 信息差），空文本忽略，超长截断', () => {
  let s = empty()
  s = setShortTermMemory(s, '苏婉', '苏婉不知道李明受伤。', 1)
  const r = applyShortTermMemories(
    s,
    [
      { characterName: '李明', shortTerm: '我在山道遇袭受伤。' },
      { characterName: '苏婉', shortTerm: '   ' },
      { characterName: '', shortTerm: '无名' },
      { characterName: '李明', shortTerm: '长'.repeat(SHORT_TERM_MAX_CHARS + 50) },
    ],
    'ch2',
    9,
  )
  assert.deepEqual(r.updated, ['李明'])
  const li = r.state.characterMemories.find((m) => m.characterName === '李明')
  assert.equal(li?.shortTerm.length, SHORT_TERM_MAX_CHARS, '同名以最后一条为准，且截断')
  assert.equal(li?.lastUpdatedChapterId, 'ch2')
  assert.equal(
    r.state.characterMemories.find((m) => m.characterName === '苏婉')?.shortTerm,
    '苏婉不知道李明受伤。',
    '未提交/空文本的角色保持原样',
  )
  assert.equal(s.characterMemories.length, 1, '不改入参')
})

test('setShortTermMemory：保留原章节标记；清空即删除', () => {
  const base = applyShortTermMemories(empty(), [{ characterName: '李明', shortTerm: 'a' }], 'ch3').state
  const edited = setShortTermMemory(base, '李明', ' 手改 ', 5)
  assert.equal(edited.characterMemories[0].shortTerm, '手改')
  assert.equal(edited.characterMemories[0].lastUpdatedChapterId, 'ch3')
  assert.equal(setShortTermMemory(edited, '李明', '').characterMemories.length, 0)
})

test('applyLongTermChange：改写 Skill 并记日志；无变化 / 未知角色 / 空文本返回 null', () => {
  const r = applyLongTermChange(chars(), empty(), { characterName: '李明', reason: '师父之死', revisedSkill: '寒门剑客，重义；师父死后沉郁寡言。' }, 'ch2', 7)
  assert.ok(r)
  assert.equal(r.characters[0].skill, '寒门剑客，重义；师父死后沉郁寡言。')
  assert.equal(r.characters[1].skill, '医馆之女。')
  assert.equal(r.change.before, '寒门剑客，重义。')
  assert.equal(r.change.reason, '师父之死')
  assert.equal(r.state.longTermLog.length, 1)

  assert.equal(applyLongTermChange(chars(), empty(), { characterName: '李明', reason: 'x', revisedSkill: ' 寒门剑客，重义。 ' }, 'ch2'), null)
  assert.equal(applyLongTermChange(chars(), empty(), { characterName: '王五', reason: 'x', revisedSkill: 'y' }, 'ch2'), null)
  assert.equal(applyLongTermChange(chars(), empty(), { characterName: '李明', reason: 'x', revisedSkill: '' }, 'ch2'), null)
})

test('revertLongTermChange：恢复改写前文本；回滚较早的改写会一并作废其后同角色的改写', () => {
  const a = applyLongTermChange(chars(), empty(), { characterName: '李明', reason: '1', revisedSkill: 'v1' }, 'ch2', 1)!
  const b = applyLongTermChange(a.characters, a.state, { characterName: '李明', reason: '2', revisedSkill: 'v2' }, 'ch3', 2)!
  const c = applyLongTermChange(b.characters, b.state, { characterName: '苏婉', reason: '3', revisedSkill: 'w1' }, 'ch3', 3)!

  const r = revertLongTermChange(c.characters, c.state, a.change.id, 10)
  assert.ok(r)
  assert.equal(r.characters[0].skill, '寒门剑客，重义。')
  assert.deepEqual(r.revertedIds, [a.change.id, b.change.id])
  assert.equal(r.characters[1].skill, 'w1', '其他角色不受影响')
  assert.equal(r.state.longTermLog.find((x) => x.id === c.change.id)?.revertedAt, undefined)

  assert.equal(revertLongTermChange(r.characters, r.state, a.change.id), null, '已回滚不能再回滚')
  assert.equal(revertLongTermChange(r.characters, r.state, 'nope'), null)
})

test('beginFinalize：首次定稿只记快照；同一章重新定稿恢复到本章之前并回滚本章的 Skill 改写', () => {
  let s = { ...empty(), mainline: '第一章后的主线' }
  s = applyShortTermMemories(s, [{ characterName: '李明', shortTerm: '第一章后的记忆' }], 'ch1').state

  // 首次定稿 ch2
  const first = beginFinalize(chars(), s, 'ch2', 1)
  assert.equal(first.refinalized, false)
  assert.equal(first.state.lastFinalize?.chapterId, 'ch2')
  assert.equal(first.state.lastFinalize?.mainline, '第一章后的主线')

  // 模拟 ch2 定稿产生的变化
  let st = applyShortTermMemories(first.state, [{ characterName: '李明', shortTerm: '第二章后的记忆' }], 'ch2').state
  st = { ...st, mainline: '第二章后的主线', mainlineUpdatedChapterId: 'ch2' }
  const lt1 = applyLongTermChange(first.characters, st, { characterName: '李明', reason: 'a', revisedSkill: 'v1' }, 'ch2', 2)!
  const lt2 = applyLongTermChange(lt1.characters, lt1.state, { characterName: '李明', reason: 'b', revisedSkill: 'v2' }, 'ch2', 3)!

  // 重新定稿 ch2
  const again = beginFinalize(lt2.characters, lt2.state, 'ch2', 10)
  assert.equal(again.refinalized, true)
  assert.equal(again.state.mainline, '第一章后的主线')
  assert.equal(again.state.mainlineUpdatedChapterId, undefined)
  assert.equal(again.state.characterMemories[0].shortTerm, '第一章后的记忆')
  assert.equal(again.characters[0].skill, '寒门剑客，重义。', '回到本章之前的 Skill')
  assert.ok(again.state.longTermLog.every((c) => c.revertedAt === 10))
  assert.equal(again.state.lastFinalize?.mainline, '第一章后的主线', '新快照仍是本章之前')

  // 定稿另一章不会触发恢复
  const other = beginFinalize(lt2.characters, lt2.state, 'ch3', 11)
  assert.equal(other.refinalized, false)
  assert.equal(other.characters[0].skill, 'v2')
})

test('renameCharactersInState：同步短期记忆、改写日志与快照', () => {
  let s = applyShortTermMemories(empty(), [{ characterName: '李明', shortTerm: 'x' }], 'ch1').state
  s = applyLongTermChange(chars(), s, { characterName: '李明', reason: 'r', revisedSkill: 'y' }, 'ch1')!.state
  s = beginFinalize(chars(), s, 'ch2').state
  const r = renameCharactersInState(s, { 李明: '李明远', 苏婉: '苏婉' })
  assert.equal(r.characterMemories[0].characterName, '李明远')
  assert.equal(r.longTermLog[0].characterName, '李明远')
  assert.equal(r.lastFinalize?.characterMemories[0].characterName, '李明远')
  assert.equal(renameCharactersInState(s, {}), s)
})

test('prompt 片段：人物块含 Skill（可截断）与短期记忆；整体进度 / 工具文本 / 清洗', () => {
  const s = applyShortTermMemories({ ...empty(), mainline: '主线梳理' }, [{ characterName: '李明', shortTerm: '我不知道信的内容。' }], 'ch1').state
  const long = [{ id: 'c1', name: '李明', skill: '剑'.repeat(300) }, { id: 'c2', name: '苏婉' }]
  const brief = formatCharacterBlock(long, s, { chapters: [{ id: 'ch1', filename: '', title: '第一章', order: 1 }] })
  assert.match(brief, /◆ @李明（id: c1）/)
  assert.match(brief, /剑…/, '默认截断 Skill')
  assert.match(brief, /短期记忆（POV，截至《第一章》）：我不知道信的内容。/)
  assert.match(brief, /@苏婉[\s\S]*长期记忆（Skill）：（未填写）[\s\S]*短期记忆（POV）：（暂无）/)
  assert.ok(formatCharacterBlock(long, s, { fullSkill: true }).includes('剑'.repeat(300)))
  assert.equal(formatCharacterBlock([], s), '')

  assert.equal(formatMainline(s), '【整体进度】\n主线梳理')
  assert.equal(formatMainline(empty()), '')

  const tool = formatStoryStateForTool(s, { characterNames: ['李明', '苏婉'] })
  assert.match(tool, /整体进度：主线梳理/)
  assert.match(tool, /- 李明：我不知道信的内容。/)
  assert.match(tool, /苏婉 暂无短期记忆/)
  assert.doesNotMatch(formatStoryStateForTool(s, { section: 'mainline' }), /短期记忆/)

  assert.equal(cleanMainline('```\n# 整体进度\n\n\n\n第一段\n```'), '整体进度\n\n第一段')
  assert.equal(cleanMainline('长'.repeat(MAINLINE_MAX_CHARS + 10)).length, MAINLINE_MAX_CHARS)
})
