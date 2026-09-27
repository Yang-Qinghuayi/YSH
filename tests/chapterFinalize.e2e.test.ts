/**
 * chapterFinalize.e2e.test.ts — 「本章定稿」流水线端到端测试（零网络、零依赖）
 *
 * 复用 agentService.e2e 的替身体系（假 openai client + 内存 fs），驱动真实的
 * chapterFinalize.runChapterFinalize：
 *   章节概要 → 短期记忆（update_short_term_memory）→ 长期记忆（update_long_term_memory）→ 整体进度
 * 覆盖：
 *   - 各步骤只挂本步骤的工具；未出场角色的短期记忆保持不变（POV 信息差）
 *   - 长期记忆自动写入 novel.json 并记日志
 *   - 整体进度基于「已有整体进度 + 各章概要（含本章新概要）」
 *   - 同一章重新定稿：先恢复到本章之前（记忆 / 整体进度 / Skill），再重新整理
 *   - deepseek-reasoner（无工具）：MEMORY 协议块 → 同一套工具执行器
 *   - 取消 → 抛出，不写 finalizedAt
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { registerHooks } from 'node:module'

import { createHooks } from './stubs/loader.mjs'
import {
  state as model,
  pushTurn,
  pushTurns,
  resetScript,
  requestText,
  requestToolNames,
  lastMessageText,
} from './stubs/modelScript.mjs'
import { resetFs, seedJson, readJson } from './stubs/fakeFs.ts'

const here = import.meta.dirname
const root = path.resolve(here, '..')
registerHooks(createHooks({ root, stubsDir: path.join(here, 'stubs') }))

const { runChapterFinalize } = await import('../src/services/chapterFinalize.ts')

// ===================== 夹具 =====================

const SKILL_LI = '寒门剑客，洒脱重义。'
const SKILL_SU = '医馆之女，外柔内刚。'
const MEM_LI_BEFORE = '我以为师父只是闭关。'
const MEM_SU_BEFORE = '我在镇上等李明回来，不知道他遇袭。'
const MAINLINE_BEFORE = '李明拜入青城派，师父闭关。'

function makeNovel() {
  return {
    id: 'novel-1',
    title: '测试小说',
    synopsis: '一个用于测试的故事。',
    createdAt: 1,
    updatedAt: 1,
    characters: [
      { id: 'c1', name: '李明', skill: SKILL_LI },
      { id: 'c2', name: '苏婉', skill: SKILL_SU },
    ],
    chapters: [
      { id: 'ch1', filename: '001_第一章.md', title: '第一章', order: 1, summary: '第一章概要：李明拜入师门。' },
      { id: 'ch2', filename: '002_第二章.md', title: '第二章', order: 2 },
    ],
  }
}

const CONTENT = '李明夜探客栈后院，从黑衣人口中得知师父并未闭关，而是早已下山。'.repeat(3)
const CONFIG = { apiKey: 'sk-test', model: 'deepseek-chat' as const }

function seedWorld() {
  resetFs()
  resetScript()
  seedJson('story-state.json', {
    version: 2,
    novelId: 'novel-1',
    updatedAt: 0,
    mainline: MAINLINE_BEFORE,
    characterMemories: [
      { characterName: '李明', shortTerm: MEM_LI_BEFORE, lastUpdatedChapterId: 'ch1', updatedAt: 0 },
      { characterName: '苏婉', shortTerm: MEM_SU_BEFORE, lastUpdatedChapterId: 'ch1', updatedAt: 0 },
    ],
    longTermLog: [],
  })
}

function recorder() {
  const steps: string[] = []
  const statuses: string[] = []
  return {
    steps,
    statuses,
    cb: {
      onStatus: (s: string) => statuses.push(s),
      onStepStart: (s: string) => steps.push(`start:${s}`),
      onStepEnd: (s: string) => steps.push(`end:${s}`),
    },
  }
}

type SavedState = {
  mainline: string
  mainlineUpdatedChapterId?: string
  characterMemories: { characterName: string; shortTerm: string; lastUpdatedChapterId: string }[]
  longTermLog: { characterName: string; chapterId: string; before: string; after: string; revertedAt?: number }[]
  lastFinalize?: { chapterId: string; mainline: string }
}
type SavedNovel = ReturnType<typeof makeNovel> & {
  chapters: { id: string; summary?: string; finalizedAt?: number }[]
}

const MEM_LI_AFTER = '我刚从黑衣人口中得知：师父并未闭关，而是早已下山。我不知道他为何瞒我。'
const SKILL_LI_AFTER = '寒门剑客，洒脱重义；得知师父欺瞒后，开始对师门心存疑虑。'
const MAINLINE_AFTER = '李明拜入青城派；夜探客栈时得知师父早已下山，师门疑云初现。'

function toolModeScript() {
  pushTurns([
    // 1. 章节概要
    { text: '「李明夜探客栈，得知师父早已下山。」' },
    // 2. 短期记忆：带 @ 前缀的名字也能识别；未知角色被忽略
    {
      toolCalls: [
        {
          id: 'st1',
          name: 'update_short_term_memory',
          args: {
            memories: [
              { characterName: '@李明', shortTerm: MEM_LI_AFTER },
              { characterName: '王五', shortTerm: '路人' },
            ],
          },
        },
      ],
    },
    { text: '短期记忆已更新。' },
    // 3. 长期记忆：重大事件 → 改写 Skill
    {
      toolCalls: [
        {
          id: 'lt1',
          name: 'update_long_term_memory',
          args: { characterName: '李明', reason: '得知师父欺瞒', revisedSkill: SKILL_LI_AFTER },
        },
      ],
    },
    { text: '完成。' },
    // 4. 整体进度
    { text: MAINLINE_AFTER },
  ])
}

// ===================== 测试 =====================

test('定稿全流程：概要 → 短期记忆 → 长期记忆 → 整体进度，并落盘', async () => {
  seedWorld()
  toolModeScript()
  const input = makeNovel()
  const rec = recorder()

  const result = await runChapterFinalize(
    { novel: input as never, chapter: input.chapters[1] as never, chapterContent: CONTENT, config: CONFIG as never },
    rec.cb,
  )

  // 步骤顺序
  assert.deepEqual(rec.steps, [
    'start:summary', 'end:summary',
    'start:short_term', 'end:short_term',
    'start:long_term', 'end:long_term',
    'start:mainline', 'end:mainline',
  ])
  assert.equal(model.requests.length, 6)

  // 每步只挂本步骤的工具
  assert.deepEqual(requestToolNames(0), [], '概要步骤不带工具')
  assert.deepEqual(requestToolNames(1), ['update_short_term_memory'])
  assert.deepEqual(requestToolNames(3), ['update_long_term_memory'])
  assert.deepEqual(requestToolNames(5), [], '整体进度步骤不带工具')

  // 定稿 system prompt：本章全文 + 人物记忆 + 整体进度
  const sys = requestText(0)
  assert.match(sys, /得知师父并未闭关/)
  assert.match(sys, new RegExp(MEM_SU_BEFORE))
  assert.match(sys, new RegExp(MAINLINE_BEFORE))
  assert.match(sys, new RegExp(SKILL_LI), '长期记忆判断需要完整 Skill')

  // 整体进度请求：已有整体进度 + 各章概要（含本章新概要）
  const mainlineReq = lastMessageText(5)
  assert.match(mainlineReq, /第一章概要：李明拜入师门/)
  assert.match(mainlineReq, /李明夜探客栈，得知师父早已下山/)
  assert.match(mainlineReq, new RegExp(MAINLINE_BEFORE))

  // 返回值
  assert.equal(result.summary, '李明夜探客栈，得知师父早已下山。')
  assert.equal(result.mainline, MAINLINE_AFTER)
  assert.deepEqual(result.shortTermUpdated, ['李明'])
  assert.equal(result.longTermChanges.length, 1)
  assert.equal(result.refinalized, false)

  // story-state.json
  const st = readJson<SavedState>('story-state.json')!
  const li = st.characterMemories.find((m) => m.characterName === '李明')!
  const su = st.characterMemories.find((m) => m.characterName === '苏婉')!
  assert.equal(li.shortTerm, MEM_LI_AFTER)
  assert.equal(li.lastUpdatedChapterId, 'ch2')
  assert.equal(su.shortTerm, MEM_SU_BEFORE, '未出场角色的短期记忆不变（POV 信息差）')
  assert.equal(su.lastUpdatedChapterId, 'ch1')
  assert.ok(!st.characterMemories.some((m) => m.characterName === '王五'), '未知角色被忽略')
  assert.equal(st.mainline, MAINLINE_AFTER)
  assert.equal(st.mainlineUpdatedChapterId, 'ch2')
  assert.equal(st.longTermLog.length, 1)
  assert.equal(st.longTermLog[0].before, SKILL_LI)
  assert.equal(st.longTermLog[0].after, SKILL_LI_AFTER)
  assert.equal(st.lastFinalize?.chapterId, 'ch2')
  assert.equal(st.lastFinalize?.mainline, MAINLINE_BEFORE, '快照记录的是本章之前')

  // novel.json：Skill 已改写，本章概要与定稿时间已写入
  const saved = readJson<SavedNovel>('novel.json')!
  assert.equal(saved.characters[0].skill, SKILL_LI_AFTER)
  assert.equal(saved.characters[1].skill, SKILL_SU)
  const ch2 = saved.chapters.find((c) => c.id === 'ch2')!
  assert.equal(ch2.summary, '李明夜探客栈，得知师父早已下山。')
  assert.ok(typeof ch2.finalizedAt === 'number')

  // 不改调用方传入的对象
  assert.equal(input.characters[0].skill, SKILL_LI)
  assert.equal((input.chapters[1] as { summary?: string }).summary, undefined)
})

test('同一章重新定稿：先恢复到本章之前（记忆 / 整体进度 / Skill），再重新整理', async () => {
  seedWorld()
  toolModeScript()
  const input = makeNovel()
  const first = await runChapterFinalize({
    novel: input as never,
    chapter: input.chapters[1] as never,
    chapterContent: CONTENT,
    config: CONFIG as never,
  })

  // 第二次：模型认为无需改写任何记忆
  resetScript()
  pushTurns([
    { text: '李明夜探客栈（修订版概要）。' },
    { text: '无需更新。' },
    { text: '无需更新。' },
    { text: '修订后的整体进度。' },
  ])
  const novel2 = first.novel
  const again = await runChapterFinalize({
    novel: novel2 as never,
    chapter: novel2.chapters[1] as never,
    chapterContent: CONTENT,
    config: CONFIG as never,
  })

  assert.equal(again.refinalized, true)
  // 重新定稿的 prompt 看到的是「本章之前」的记忆与 Skill，而不是上次定稿的结果
  const sys = requestText(0)
  assert.match(sys, new RegExp(MEM_LI_BEFORE))
  assert.doesNotMatch(sys, /开始对师门心存疑虑/)
  assert.match(sys, new RegExp(MAINLINE_BEFORE))

  const st = readJson<SavedState>('story-state.json')!
  assert.equal(st.characterMemories.find((m) => m.characterName === '李明')?.shortTerm, MEM_LI_BEFORE)
  assert.equal(st.longTermLog.length, 1)
  assert.ok(typeof st.longTermLog[0].revertedAt === 'number', '上次定稿的 Skill 改写已回滚')
  assert.equal(st.mainline, '修订后的整体进度。')
  assert.deepEqual(again.longTermChanges, [])
  assert.deepEqual(again.shortTermUpdated, [])

  const saved = readJson<SavedNovel>('novel.json')!
  assert.equal(saved.characters[0].skill, SKILL_LI, 'Skill 回到本章之前')
  assert.equal(saved.chapters.find((c) => c.id === 'ch2')?.summary, '李明夜探客栈（修订版概要）。')
})

test('deepseek-reasoner（无工具）：MEMORY 协议块经同一套执行器写入', async () => {
  seedWorld()
  pushTurns([
    { text: '李明得知师父早已下山。' },
    {
      text:
        '<<<MEMORY>>>' +
        JSON.stringify({
          shortTerm: [{ characterName: '李明', shortTerm: MEM_LI_AFTER }],
          longTerm: [{ characterName: '李明', reason: '得知师父欺瞒', revisedSkill: SKILL_LI_AFTER }],
        }) +
        '<<<END>>>',
    },
    { text: MAINLINE_AFTER },
  ])
  const input = makeNovel()
  const rec = recorder()
  const result = await runChapterFinalize(
    {
      novel: input as never,
      chapter: input.chapters[1] as never,
      chapterContent: CONTENT,
      config: { ...CONFIG, model: 'deepseek-reasoner' } as never,
    },
    rec.cb,
  )

  assert.equal(model.requests.length, 3)
  for (let i = 0; i < 3; i++) assert.deepEqual(requestToolNames(i), [], `第 ${i + 1} 次请求不应带工具`)
  assert.match(lastMessageText(1), /<<<MEMORY>>>/)
  assert.deepEqual(result.shortTermUpdated, ['李明'])
  assert.equal(result.longTermChanges.length, 1)
  assert.equal(readJson<SavedNovel>('novel.json')!.characters[0].skill, SKILL_LI_AFTER)
  assert.equal(result.mainline, MAINLINE_AFTER)
  assert.ok(rec.steps.includes('end:short_term') && rec.steps.includes('end:long_term'))
})

test('定稿中途取消：抛出错误，且不写入 finalizedAt', async () => {
  seedWorld()
  pushTurn({ text: '很长的概要', delayMs: 40 })
  const input = makeNovel()
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 10)
  await assert.rejects(
    runChapterFinalize({
      novel: input as never,
      chapter: input.chapters[1] as never,
      chapterContent: CONTENT,
      config: CONFIG as never,
      abortController: ac,
    }),
  )
  const saved = readJson<SavedNovel>('novel.json')
  assert.equal(saved?.chapters.find((c) => c.id === 'ch2')?.finalizedAt, undefined)
})
