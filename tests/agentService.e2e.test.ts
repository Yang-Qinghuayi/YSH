/**
 * agentService.e2e.test.ts — Agent 主循环的端到端测试（零网络、零依赖）
 *
 * 与 tests/ 下另外三个文件不同：这里**不测纯函数**，而是驱动真实的
 * agentService.runPlanPhase / runGeneratePhase 全链路，只把三个模块换成替身：
 *   - `openai`（唯一网络边界，见 stubs/openai.mjs）
 *   - `@/hooks/useEnv`（import.meta.env / Pinia 依赖 → 内存 fs）
 *   - `@/services/workspaceService`（setting store → 固定路径）
 *
 * 因此被覆盖的是真实的状态机、工具执行、lore/story-state 落盘与合并逻辑。
 * 覆盖的关键回归：
 *   - 作者在规划面板改过的大纲必须进入生成请求（原 P0 缺陷）
 *   - update_story_state 增量合并，不静默清空未提交字段（原 P0 缺陷）
 *   - 章节摘要生成 → onChapterSummary；前情提要注入下次规划
 *   - 正文被 length 截断 → 自动续写；无 PLAN 块 + 截断 → 报错
 *   - 未知工具名不中断会话，错误文本回传给模型
 *   - 上下文超预算裁剪后，assistant/tool 配对仍完整
 *   - 取消（abort）→ canceled 相位，且不触发 onError
 *   - deepseek-reasoner（不支持工具调用）→ 无工具直读模式
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
import { resetFs, seedFile, seedJson, readJson, listFiles } from './stubs/fakeFs.ts'

const here = import.meta.dirname
const root = path.resolve(here, '..')
registerHooks(createHooks({ root, stubsDir: path.join(here, 'stubs') }))

// 必须动态导入：确保 registerHooks 先生效，否则 `@/` 别名解析不到
const { createSession, runPlanPhase, runGeneratePhase, INLINE_PLAN_MAX_TOOL_ROUNDS } = await import(
  '../src/services/agentService.ts'
)
const { CONTINUE_INSTRUCTION, NUDGE_OUTPUT_PLAN } = await import('../src/services/agentProtocol.ts')

// ===================== 测试夹具 =====================

const CHAPTER_1 = { id: 'ch1', filename: '001_第一章.md', title: '第一章', order: 1, summary: '第一章摘要：李明拜入师门。' }
const CHAPTER_2 = { id: 'ch2', filename: '002_第二章.md', title: '第二章', order: 2 }

function makeNovel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'novel-1',
    title: '测试小说',
    synopsis: '一个用于测试的故事。',
    createdAt: 1,
    updatedAt: 1,
    characters: [
      { id: 'c1', name: '李明', profile: '年轻的剑客', literaryReference: '令狐冲' },
      { id: 'c2', name: '苏婉', profile: '医馆之女' },
    ],
    chapters: [CHAPTER_1, CHAPTER_2],
    ...overrides,
  }
}

const CONFIG = {
  apiKey: 'sk-test',
  model: 'deepseek-chat' as const,
  autoUpdateStoryState: true,
  autoChapterSummary: true,
}

/** 让 planner 输出一份可解析的 PLAN 块 */
function planTurn(outline: string, approach = '冷峻笔调') {
  const plan = {
    outline,
    selectedCharacters: [{ id: 'c1', name: '李明', reason: '主角' }],
    referencedLoreEntries: [],
    approach,
  }
  return { text: `调研完成。\n<<<PLAN>>>${JSON.stringify(plan)}<<<END>>>\n`, finishReason: 'stop' }
}

/** 回调记录器 */
function recorder() {
  const phases: string[] = []
  const toolLog: { tool: string; status: string; text: string }[] = []
  const plans: unknown[] = []
  const summaries: string[] = []
  const warns: string[] = []
  const errors: unknown[] = []
  const trimmed: { trimmed: number; estimatedTokens: number }[] = []
  let done = 0
  let text = ''
  const cb = {
    onStatus: () => {},
    onPhase: (p: string) => phases.push(p),
    onToolCall: (l: { tool: string; status: string; text: string }) => toolLog.push(l),
    onPlanReady: (p: unknown) => plans.push(p),
    onChapterSummary: (s: string) => summaries.push(s),
    onContextTrimmed: (i: { trimmed: number; estimatedTokens: number }) => trimmed.push(i),
    onWarn: (m: string) => warns.push(m),
    onError: (e: unknown) => errors.push(e),
    onTextDelta: (d: string) => {
      text += d
    },
    onDone: () => {
      done += 1
    },
  }
  return {
    cb,
    phases,
    toolLog,
    plans,
    summaries,
    warns,
    errors,
    trimmed,
    get done() {
      return done
    },
    get text() {
      return text
    },
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return createSession({
    novel: makeNovel() as never,
    chapter: CHAPTER_2 as never,
    chapterContent: '第二章正文……',
    cursorPosition: 6,
    forcedMentions: [],
    skipConfirmation: false,
    ...overrides,
  } as never)
}

/** 每条 tool 消息都必须对应某个 assistant 的 tool_calls；反向也必须闭合 */
function assertToolPairing(messages: { role: string; tool_calls?: { id: string }[]; tool_call_id?: string }[]) {
  const declared = new Set<string>()
  const answered = new Set<string>()
  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) declared.add(tc.id)
    }
    if (m.role === 'tool' && m.tool_call_id) {
      assert.ok(declared.has(m.tool_call_id), `孤立的 tool 消息（无对应 tool_calls）：${m.tool_call_id}`)
      answered.add(m.tool_call_id)
    }
  }
  for (const id of declared) {
    assert.ok(answered.has(id), `assistant.tool_calls 缺少 tool 响应：${id}`)
  }
}

function resetWorld() {
  resetScript()
  resetFs()
}

// ===================== 1. 全链路：plan → 确认 → generate → finalizing =====================

test('全链路：工具循环 → 规划 → 作者改稿 → 生成 → 状态增量更新 + 章节摘要', async () => {
  resetWorld()
  seedJson('story-state.json', {
    novelId: 'novel-1',
    updatedAt: 0,
    characterStates: [
      {
        characterName: '李明',
        mood: '平静',
        location: '家乡',
        relationships: [{ target: '苏婉', relation: '青梅竹马' }],
        lastUpdatedChapterId: 'ch1',
        updatedAt: 0,
      },
    ],
    timeline: [],
    foreshadowings: [],
  })

  pushTurns([
    // 规划第 1 轮：调用只读工具
    { toolCalls: [{ id: 'call_1', name: 'select_characters', args: { characterIds: ['c1'] } }] },
    // 规划第 2 轮：产出 PLAN
    planTurn('原始大纲：李明夜访客栈'),
    // 生成：正文
    { text: '李明推开客栈的门。', finishReason: 'stop' },
    // finalizing 第 1 轮：更新故事状态
    {
      toolCalls: [
        {
          id: 'call_2',
          name: 'update_story_state',
          args: { characterStates: [{ characterName: '李明', location: '悦来客栈' }] },
        },
      ],
    },
    // finalizing 第 2 轮：无工具调用 → 退出循环
    { text: '', finishReason: 'stop' },
    // 章节摘要
    { text: '「李明在悦来客栈遇袭，情绪紧张。」', finishReason: 'stop' },
  ])

  const plan = recorder()
  const session = makeSession()

  // ---- 规划阶段 ----
  await runPlanPhase(session, '第二章概要：李明夜访客栈', CONFIG as never, plan.cb as never)

  assert.deepEqual(plan.phases, ['planning', 'awaiting_confirmation'])
  assert.equal(plan.errors.length, 0, `规划不应报错：${plan.errors}`)
  assert.equal(plan.plans.length, 1)
  assert.equal((plan.plans[0] as { outline: string }).outline, '原始大纲：李明夜访客栈')

  // 工具确实被调用且结果回传模型
  assert.deepEqual(
    plan.toolLog.filter((l) => l.status === 'done').map((l) => l.tool),
    ['select_characters'],
  )
  assert.deepEqual(requestToolNames(0), [
    'query_lore',
    'search_chapters',
    'read_story_state',
    'read_context',
    'select_characters',
  ])
  assert.match(requestText(1), /李明/)
  // 前情提要（上一章摘要）已注入 system prompt
  assert.match(requestText(0), /第一章摘要：李明拜入师门/)

  // ---- 作者在规划面板里改稿后确认 ----
  const edited = { ...(session.plan as object), outline: '作者修订后的大纲：李明夜探客栈后院' }
  session.plan = edited as never

  const gen = recorder()
  await runGeneratePhase(session, CONFIG as never, gen.cb as never)

  assert.deepEqual(gen.phases, ['generating', 'finalizing', 'done'])
  assert.equal(gen.errors.length, 0, `生成不应报错：${gen.errors}`)
  assert.equal(gen.done, 1)
  assert.equal(gen.text, '李明推开客栈的门。')

  // ★ P0 回归：生成指令（最后一条 user 消息）必须是作者改过的大纲
  const genInstruction = lastMessageText(2)
  assert.match(genInstruction, /作者修订后的大纲：李明夜探客栈后院/)
  assert.match(genInstruction, /已确认大纲/)
  assert.match(genInstruction, /作者可能已修订/)
  assert.doesNotMatch(genInstruction, /原始大纲：李明夜访客栈/, '指令中不应再出现模型自己的旧版大纲')

  // ★ P0 回归：增量合并——未提交的 mood/relationships 必须保留
  const saved = readJson<{
    characterStates: {
      characterName: string
      mood?: string
      location?: string
      relationships: { target: string; relation: string }[]
      lastUpdatedChapterId: string
    }[]
  }>('story-state.json')
  assert.ok(saved, '故事状态应已落盘')
  const li = saved.characterStates.find((c) => c.characterName === '李明')
  assert.ok(li, '李明 的状态应存在')
  assert.equal(li.mood, '平静', '未提交的 mood 不应被清空')
  assert.equal(li.location, '悦来客栈', '提交的 location 应被更新')
  assert.deepEqual(li.relationships, [{ target: '苏婉', relation: '青梅竹马' }], '未提交的关系不应被清空')
  assert.equal(li.lastUpdatedChapterId, 'ch2')

  // 章节摘要：清洗掉引号后交给 UI 落盘
  assert.deepEqual(gen.summaries, ['李明在悦来客栈遇袭，情绪紧张。'])

  // 消息序列协议完整
  assertToolPairing(session.messages as never)
})

// ===================== 2. 截断续写 =====================

test('正文被 length 截断 → 自动续写一次，且续写指令进入请求', async () => {
  resetWorld()
  pushTurns([
    planTurn('截断测试大纲'),
    { text: '第一段（被截断）', finishReason: 'length' },
    { text: '第二段收尾。', finishReason: 'stop' },
  ])

  const rec = recorder()
  const session = makeSession({ skipConfirmation: true })
  await runPlanPhase(session, '概要', { ...CONFIG, autoUpdateStoryState: false, autoChapterSummary: false } as never, rec.cb as never)

  assert.equal(rec.errors.length, 0)
  assert.equal(rec.text, '第一段（被截断）第二段收尾。')
  assert.deepEqual(rec.phases, ['planning', 'awaiting_confirmation', 'generating', 'done'])
  // 第 3 次请求（index 2）的最后一条消息应为续写指令
  assert.equal(lastMessageText(2), CONTINUE_INSTRUCTION)
  // 仅续写一次，不应触发告警
  assert.deepEqual(rec.warns, [])
  assertToolPairing(session.messages as never)
})

test('规划输出被截断且没有 PLAN 块 → 报错而非把半截文本当大纲', async () => {
  resetWorld()
  pushTurns([{ text: '我正在思考……', finishReason: 'length' }])

  const rec = recorder()
  const session = makeSession()
  await runPlanPhase(session, '概要', CONFIG as never, rec.cb as never)

  assert.equal(rec.errors.length, 1)
  assert.match(String(rec.errors[0]), /截断/)
  assert.equal(rec.plans.length, 0)
})

// ===================== 3. 工具容错 =====================

test('模型幻想的未知工具：返回错误文本给模型，会话继续并完成规划', async () => {
  resetWorld()
  pushTurns([
    { toolCalls: [{ id: 'call_x', name: 'teleport_hero', args: { to: '长安' } }] },
    planTurn('未知工具后仍能规划'),
  ])

  const rec = recorder()
  const session = makeSession()
  await runPlanPhase(session, '概要', CONFIG as never, rec.cb as never)

  assert.equal(rec.errors.length, 0)
  const log = rec.toolLog.find((l) => l.tool === 'teleport_hero' && l.status === 'done')
  assert.ok(log, '应记录未知工具的完成回调')
  assert.match(log.text, /未知工具/)
  // 错误文本回传给了模型
  assert.match(requestText(1), /未知工具：teleport_hero/)
  assert.deepEqual(rec.phases, ['planning', 'awaiting_confirmation'])
})

// ===================== 4. 上下文预算 =====================

test('上下文超预算：触发裁剪、发出告警，且 assistant/tool 配对不被拆散', async () => {
  resetWorld()
  // 20 条 major 条目，每条 1200 字正文 → 单轮检索结果约 16k 字符 ≈ 16k tokens
  const longBody = '剑'.repeat(1200)
  for (let i = 0; i < 20; i++) {
    seedFile(`lore/entries/entry-${i}.md`, `${longBody}${i}`)
  }
  seedJson('lore/lore.json', {
    id: 'novel-1',
    novelTitle: '测试小说',
    updatedAt: 0,
    entries: Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      name: `设定剑${i}`,
      filename: `entry-${i}.md`,
      importance: 'major',
      briefDescription: '测试条目',
      keywords: ['剑'],
      enabled: true,
    })),
  })

  // 6 轮检索 + 1 轮产出 PLAN
  const turns = Array.from({ length: 6 }, () => ({
    toolCalls: [{ id: `call_${Math.random().toString(36).slice(2)}`, name: 'query_lore', args: { keywords: ['剑'] } }],
  }))
  turns.push(planTurn('长会话后的大纲'))
  pushTurns(turns)

  const rec = recorder()
  const session = makeSession()
  await runPlanPhase(session, '概要', CONFIG as never, rec.cb as never)

  assert.equal(rec.errors.length, 0, `不应报错：${rec.errors}`)
  assert.ok(rec.trimmed.length > 0, '应触发上下文裁剪告警')
  assert.ok(rec.trimmed[0].trimmed > 0)
  // 裁剪后协议仍完整
  assertToolPairing(session.messages as never)
  // system 与首条 user 消息（会话基线）必须保留
  assert.equal((session.messages as { role: string }[])[0].role, 'system')
  assert.equal((session.messages as { role: string }[])[1].role, 'user')
  // 裁剪之后仍然拿到了可解析的规划
  assert.equal((rec.plans[0] as { outline: string }).outline, '长会话后的大纲')
  assert.ok(model.requests.length >= 7, `应发出至少 7 次请求，实际 ${model.requests.length}`)
})

// ===================== 5. 取消 =====================

test('运行中取消 → canceled 相位，不触发 onError', async () => {
  resetWorld()
  pushTurn({ text: '很长的回复', delayMs: 40 })

  const rec = recorder()
  const session = makeSession()
  const running = runPlanPhase(session, '概要', CONFIG as never, rec.cb as never)
  setTimeout(() => session.abortController.abort(), 15)
  await running

  assert.deepEqual(rec.phases, ['planning', 'canceled'])
  assert.equal(rec.errors.length, 0, `取消不应报错：${rec.errors}`)
  assert.equal(rec.plans.length, 0)
})

// ===================== 6. 无工具模式（deepseek-reasoner 降级） =====================

test('deepseek-reasoner：走无工具直读模式，请求不带 tools 且注入故事状态', async () => {
  resetWorld()
  seedJson('story-state.json', {
    novelId: 'novel-1',
    updatedAt: 0,
    characterStates: [
      { characterName: '李明', mood: '紧张', location: '山道', relationships: [], lastUpdatedChapterId: 'ch1', updatedAt: 0 },
    ],
    timeline: [],
    foreshadowings: [],
  })
  seedFile('lore/entries/major.md', '世界观：此界以剑为尊。')
  seedJson('lore/lore.json', {
    id: 'novel-1',
    novelTitle: '测试小说',
    updatedAt: 0,
    entries: [
      {
        id: 'm1',
        name: '剑道体系',
        filename: 'major.md',
        importance: 'major',
        briefDescription: '核心设定',
        keywords: ['剑'],
        enabled: true,
      },
    ],
  })
  pushTurns([planTurn('无工具模式大纲')])

  const rec = recorder()
  const session = makeSession()
  await runPlanPhase(session, '概要', { ...CONFIG, model: 'deepseek-reasoner' } as never, rec.cb as never)

  assert.equal(rec.errors.length, 0, `不应报错：${rec.errors}`)
  assert.deepEqual(requestToolNames(0), [], '无工具模式不应携带 tools')
  const sys = requestText(0)
  assert.match(sys, /无工具模式|直读|【故事状态】|山道/)
  assert.match(sys, /此界以剑为尊/)
  assert.equal((rec.plans[0] as { outline: string }).outline, '无工具模式大纲')
  assert.equal(rec.phases[0], 'planning')
})

// ===================== 7. 快速模式（跳过确认）参数一致性 =====================

test('skipConfirmation + 轻量轮数：内联续写一次跑完，且落盘摘要被关闭', async () => {
  resetWorld()
  pushTurns([planTurn('内联续写大纲'), { text: '续写的一小段。', finishReason: 'stop' }])

  const rec = recorder()
  const session = makeSession({ skipConfirmation: true, planMaxToolRounds: INLINE_PLAN_MAX_TOOL_ROUNDS })
  await runPlanPhase(
    session,
    '续写一小段',
    { ...CONFIG, autoUpdateStoryState: false, autoChapterSummary: false } as never,
    rec.cb as never,
  )

  assert.equal(rec.errors.length, 0)
  assert.deepEqual(rec.phases, ['planning', 'awaiting_confirmation', 'generating', 'done'])
  assert.equal(rec.summaries.length, 0, '内联续写不应生成章节摘要')
  assert.equal(listFiles().some((f) => f.includes('story-state')), false, '关闭状态更新后不应写 story-state.json')
  // 催促信息不应在这次短会话里出现（轮数上限 4 → 阈值 2/3）
  assert.doesNotMatch(requestText(0), new RegExp(NUDGE_OUTPUT_PLAN.slice(0, 12)))
})
