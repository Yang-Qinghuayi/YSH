/**
 * agentChat.e2e.test.ts — 交互面板（chat 模式）引擎的端到端测试（零网络、零依赖）
 *
 * 复用 agentService.e2e.test.ts 的替身体系（假 openai client + 内存 fs），
 * 驱动真实的 agentChat 多轮循环：
 *   - 概要 → 调研工具 → PLAN 闸门（awaiting_confirmation）
 *   - 确认后生成轮：append_to_chapter 工具落盘 + 实时预览事件 + finalizing
 *   - 自由对话轮（无 PLAN）→ 普通回复；多轮上下文保留
 *   - deepseek-reasoner（无工具）→ CONTENT 块降级落笔
 *   - 会话文件持久化往返 + 转录裁剪（快照限量）
 *   - 「续写上一章」任务构造（注入上一章结尾）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { registerHooks } from 'node:module'

import { createHooks } from './stubs/loader.mjs'
import {
  pushTurn,
  pushTurns,
  resetScript,
  requestText,
  lastMessageText,
} from './stubs/modelScript.mjs'
import {
  resetFs,
  seedFile,
  seedJson,
  readJson,
  fakeFs,
} from './stubs/fakeFs.ts'

const here = import.meta.dirname
const root = path.resolve(here, '..')
registerHooks(createHooks({ root, stubsDir: path.join(here, 'stubs') }))

const {
  createChatSession,
  runChatTurn,
  runChatGenerateTurn,
  buildContinuePrevTask,
  findPrevChapter,
  saveChatSessionFile,
  loadChatSessionFile,
  prepareTranscriptForPersist,
} = await import('../src/services/agentChat.ts')

// ===================== 夹具 =====================

const CHAPTER_1 = {
  id: 'ch1',
  filename: '001_第一章.md',
  title: '第一章',
  order: 1,
  summary: '第一章摘要：李明拜入师门。',
}
const CHAPTER_2 = {
  id: 'ch2',
  filename: '002_第二章.md',
  title: '第二章',
  order: 2,
}

function makeNovel() {
  return {
    id: 'novel-1',
    title: '测试小说',
    synopsis: '一个用于测试的故事。',
    createdAt: 1,
    updatedAt: 1,
    characters: [{ id: 'c1', name: '李明', profile: '年轻的剑客' }],
    chapters: [CHAPTER_1, CHAPTER_2],
  }
}

const CONFIG = {
  apiKey: 'sk-test',
  model: 'deepseek-chat' as const,
  autoUpdateStoryState: true,
  autoChapterSummary: true,
  lengthTarget: 1000,
}

function makeSession() {
  return createChatSession({
    novel: makeNovel(),
    chapter: CHAPTER_2,
    chapterContent: '',
    liveContent: () => '',
  })
}

/** 回调记录器 */
function makeRecorder() {
  const rec: {
    phases: string[]
    statuses: string[]
    textDeltas: string[]
    toolStarts: { tool: string; argsSummary: string }[]
    toolEnds: { tool: string; ok: boolean; text: string; write?: unknown }[]
    previews: { tool: string; partial: string }[]
    plans: unknown[]
    virtualWrites: string[]
    summaries: string[]
    warns: string[]
    errors: unknown[]
    done: number
  } = {
    phases: [],
    statuses: [],
    textDeltas: [],
    toolStarts: [],
    toolEnds: [],
    previews: [],
    plans: [],
    virtualWrites: [],
    summaries: [],
    warns: [],
    errors: [],
    done: 0,
  }
  const cb = {
    onPhase: (p: string) => rec.phases.push(p),
    onStatus: (s: string) => rec.statuses.push(s),
    onTextDelta: (d: string) => rec.textDeltas.push(d),
    onToolStart: (tool: string, argsSummary: string) =>
      rec.toolStarts.push({ tool, argsSummary }),
    onToolEnd: (tool: string, ok: boolean, text: string, write?: unknown) =>
      rec.toolEnds.push({ tool, ok, text, write }),
    onWritePreview: (tool: string, partial: string) =>
      rec.previews.push({ tool, partial }),
    onPlanReady: (p: unknown) => rec.plans.push(p),
    onVirtualWrite: (c: string) => rec.virtualWrites.push(c),
    onChapterSummary: (s: string) => rec.summaries.push(s),
    onWarn: (m: string) => rec.warns.push(m),
    onError: (e: unknown) => rec.errors.push(e),
    onDone: () => {
      rec.done += 1
    },
  }
  return { rec, cb }
}

function seedWorkspace() {
  resetFs()
  seedFile('chapters/001_第一章.md', '第一章正文。\n剑光一闪，李明已下山。')
  seedJson('lore/lore.json', {
    novelId: 'novel-1',
    entries: [
      {
        id: 'e1',
        filename: 'entry-1.md',
        name: '宗门',
        briefDescription: '青云宗',
        keywords: ['青云宗'],
        importance: 'major',
        enabled: true,
      },
    ],
  })
  seedFile('lore/entries/entry-1.md', '青云宗坐落于青云之巅。')
  seedJson('story-state.json', {
    novelId: 'novel-1',
    updatedAt: 1,
    characterStates: [
      {
        characterName: '李明',
        mood: '平静',
        location: '青云宗',
        injuries: '',
        possessions: ['佩剑'],
        relationships: [],
        notes: '已入门',
        lastUpdatedChapterId: 'ch1',
        updatedAt: 1,
      },
    ],
    timeline: [],
    foreshadowings: [],
  })
}

const PLAN_TEXT =
  '好的，我已了解上下文。\n<<<PLAN>>>' +
  JSON.stringify({
    outline: '1. 山道遇袭\n2. 客栈密谈',
    selectedCharacters: [{ id: 'c1', name: '李明', reason: '主角' }],
    referencedLoreEntries: [{ id: 'e1', name: '宗门' }],
    approach: '先抑后扬',
  }) +
  '<<<END>>>'

// ===================== 测试 =====================

test('chat 全链路：概要 → 调研 → PLAN 闸门 → 确认 → 写章 → finalizing', async () => {
  seedWorkspace()
  resetScript()
  const session = makeSession()
  const { rec, cb } = makeRecorder()

  // 规划轮：T1 调研（query_lore）→ T2 输出 PLAN
  pushTurns([
    {
      toolCalls: [
        { id: 'call_1', name: 'query_lore', args: { keywords: ['宗门'] } },
      ],
    },
    { text: PLAN_TEXT },
  ])

  await runChatTurn(
    session,
    { visibleText: '本章写李明下山，路上遇到老掌门。', forcePlan: false },
    CONFIG,
    cb,
  )

  // 闸门：等待确认，不进入生成
  assert.deepEqual(rec.phases, ['planning', 'awaiting_confirmation'])
  assert.equal(rec.plans.length, 1)
  assert.equal(
    (rec.plans[0] as { outline: string }).outline,
    '1. 山道遇袭\n2. 客栈密谈',
  )
  assert.equal((rec.plans[0] as { approach: string }).approach, '先抑后扬')
  assert.equal(rec.toolStarts[0]?.tool, 'query_lore')
  assert.equal(rec.toolEnds[0]?.ok, true)
  assert.equal(rec.done, 1)

  // 生成轮：T3 append_to_chapter → T4 update_story_state → T5 收尾（无工具）→ T6 摘要
  const newContent = '新章正文第一段。\n第二段内容。'
  pushTurns([
    {
      toolCalls: [
        {
          id: 'call_w1',
          name: 'append_to_chapter',
          args: { content: newContent },
        },
      ],
    },
    {
      toolCalls: [
        {
          id: 'call_s1',
          name: 'update_story_state',
          args: { characterStates: [{ characterName: '李明', mood: '紧张' }] },
        },
      ],
    },
    { text: '完成。' },
    { text: '李明下山，与老掌门密谈。' },
  ])

  await runChatGenerateTurn(session, CONFIG, cb)

  // 阶段推进（recorder 跨两轮：规划轮 planning→awaiting_confirmation，生成轮 generating→finalizing→done）
  assert.deepEqual(rec.phases, [
    'planning',
    'awaiting_confirmation',
    'generating',
    'finalizing',
    'done',
  ])
  // 章节落盘（工具内 saveChapterContent → fake fs）
  const chapterContent = await fakeFs.readFile('chapters/002_第二章.md', 'Data')
  assert.equal(chapterContent, newContent)
  const writeEnd = rec.toolEnds.find((t) => t.tool === 'append_to_chapter')
  assert.ok(writeEnd)
  assert.equal(writeEnd.ok, true)
  const write = writeEnd.write as {
    newContent: string
    addedChars: number
    chapterId: string
    snapshot: string
  }
  assert.equal(write.newContent, newContent)
  assert.equal(write.chapterId, 'ch2')
  assert.equal(write.addedChars, newContent.length)
  // 实时预览事件（tool 参数流式）
  assert.ok(rec.previews.length > 0, '应有写章实时预览事件')
  assert.equal(rec.previews[rec.previews.length - 1]?.partial, newContent)
  // 故事状态增量合并（mood 更新，其余字段保留）
  const state = readJson<{
    characterStates: {
      characterName: string
      mood?: string
      location?: string
      possessions?: string[]
      notes?: string
    }[]
  }>('story-state.json')
  assert.ok(state)
  assert.equal(state.characterStates[0]?.mood, '紧张')
  assert.equal(state.characterStates[0]?.location, '青云宗')
  assert.deepEqual(state.characterStates[0]?.possessions, ['佩剑'])
  assert.equal(state.characterStates[0]?.notes, '已入门')
  // 章节摘要
  assert.equal(rec.summaries.length, 1)
  assert.equal(rec.summaries[0], '李明下山，与老掌门密谈。')
  // 多轮上下文：生成请求里带着规划轮的对话
  const { state: modelState } = await import('./stubs/modelScript.mjs')
  const genReq = modelState.requests.find((r) =>
    (r.messages ?? []).some(
      (m) =>
        typeof m.content === 'string' && m.content.includes('【已确认大纲】'),
    ),
  )
  assert.ok(genReq, '应存在携带已确认大纲的生成请求')
  const genText = requestText(modelState.requests.indexOf(genReq))
  assert.ok(
    genText.includes('本章写李明下山'),
    '多轮上下文应保留第一轮用户消息',
  )
})

test('chat 自由对话轮：无 PLAN → 普通回复；第二轮上下文保留', async () => {
  seedWorkspace()
  resetScript()
  const session = makeSession()
  const { rec, cb } = makeRecorder()

  pushTurn({ text: '本章可以写李明下山历练，节奏不用太赶。' })
  await runChatTurn(
    session,
    { visibleText: '你觉得这章怎么写好？' },
    CONFIG,
    cb,
  )

  assert.equal(rec.plans.length, 0, '普通问答不应产出 plan')
  assert.deepEqual(rec.phases, ['planning', 'done'])
  assert.equal(rec.done, 1)

  // 第二轮：强制 plan（模拟快捷动作），模型上一轮回复应在上下文里
  const { state: modelState } = await import('./stubs/modelScript.mjs')
  const before = modelState.requests.length
  pushTurn({ text: PLAN_TEXT })
  await runChatTurn(
    session,
    { visibleText: '续写本章：接已有正文继续往下写', forcePlan: true },
    CONFIG,
    cb,
  )

  const lastReq = modelState.requests[modelState.requests.length - 1]
  const reqIdx = modelState.requests.length - 1
  assert.ok(reqIdx >= before)
  const text = requestText(reqIdx)
  assert.ok(
    text.includes('你觉得这章怎么写好？'),
    '第二轮请求应保留第一轮用户消息',
  )
  assert.ok(
    text.includes('本章可以写李明下山历练'),
    '第二轮请求应保留第一轮助手回复',
  )
  assert.equal(rec.plans.length, 1, '第二轮应产出 plan')
  assert.ok(lastMessageText(reqIdx).includes('续写本章'))
})

test('chat toolFree（reasoner）：CONTENT 块降级落笔 + STATE 协议', async () => {
  seedWorkspace()
  resetScript()
  const session = makeSession()
  const { rec, cb } = makeRecorder()
  const toolFreeConfig = { ...CONFIG, model: 'deepseek-reasoner' as const }

  // 规划轮（无工具）：直接出 PLAN
  pushTurn({ text: PLAN_TEXT })
  await runChatTurn(
    session,
    { visibleText: '写本章概要：李明下山。' },
    toolFreeConfig,
    cb,
  )
  assert.equal(rec.plans.length, 1)

  // 生成轮：CONTENT 块 → STATE 块 → 摘要
  const content = 'reasoner 写出的正文。'
  pushTurns([
    { text: `好的。\n<<<CONTENT>>>\n${content}\n<<<END>>>\n写完。` },
    {
      text:
        '<<<STATE>>>' +
        JSON.stringify({
          characterStates: [{ characterName: '李明', mood: '坚定' }],
        }) +
        '<<<END>>>',
    },
    { text: 'reasoner 生成的摘要。' },
  ])
  await runChatGenerateTurn(session, toolFreeConfig, cb)

  assert.equal(rec.virtualWrites.length, 1, '应触发虚拟写章')
  assert.equal(rec.virtualWrites[0], content)
  const state = readJson<{
    characterStates: { characterName: string; mood?: string }[]
  }>('story-state.json')
  assert.equal(state?.characterStates[0]?.mood, '坚定')
  assert.equal(rec.summaries[0], 'reasoner 生成的摘要。')
  assert.deepEqual(rec.phases.slice(-1), ['done'])
})

test('prepareTranscriptForPersist：快照限量 + 工具细节裁剪', async () => {
  const mkWrite = (id: number) => ({
    id: `t${id}`,
    kind: 'tool' as const,
    tool: 'append_to_chapter',
    status: 'done' as const,
    argsSummary: `写入 ${id}`,
    resultText: 'x'.repeat(3000),
    preview: 'y'.repeat(7000),
    write: {
      chapterId: 'ch2',
      chapterTitle: '第二章',
      newContent: 'z',
      addedChars: 1,
      snapshot: `s${id}`,
    },
    ts: id,
  })
  const transcript = [
    { id: 'u1', kind: 'user' as const, text: 'hi', ts: 0 },
    mkWrite(1),
    mkWrite(2),
    mkWrite(3),
    mkWrite(4),
    mkWrite(5),
  ] as const

  const out = prepareTranscriptForPersist([...transcript])
  const tools = out.filter(
    (m) => m.kind === 'tool',
  ) as (typeof transcript)[number][]
  // 仅最近 3 条保留快照
  assert.equal((tools[0] as any).write.snapshot, undefined)
  assert.equal((tools[1] as any).write.snapshot, undefined)
  assert.equal((tools[2] as any).write.snapshot, 's3')
  assert.equal((tools[3] as any).write.snapshot, 's4')
  assert.equal((tools[4] as any).write.snapshot, 's5')
  // 细节裁剪
  assert.ok((tools[4] as any).resultText.length <= 2001)
  assert.ok((tools[4] as any).preview.length <= 6001)
})

test('会话文件持久化往返（fake fs）', async () => {
  seedWorkspace()
  const transcript = [
    { id: 'u1', kind: 'user' as const, text: '写本章', ts: 1 },
    {
      id: 'a1',
      kind: 'assistant' as const,
      text: '好的',
      streaming: false,
      ts: 2,
    },
  ]
  const llmMessages = [{ role: 'user', content: '写本章' }]
  await saveChatSessionFile(
    'ch2',
    '第二章',
    llmMessages,
    [...transcript],
    'awaiting_confirmation',
  )

  const file = await loadChatSessionFile('ch2')
  assert.ok(file)
  assert.equal(file.version, 1)
  assert.equal(file.chapterId, 'ch2')
  assert.equal(file.phase, 'awaiting_confirmation')
  assert.equal(file.transcript.length, 2)
  assert.deepEqual(file.llmMessages, llmMessages)

  // 不存在的章节 → null
  assert.equal(await loadChatSessionFile('nope'), null)
})

test('持久化恢复：重新加载会话文件后多轮上下文延续', async () => {
  seedWorkspace()
  resetScript()
  const novel = makeNovel()

  // 第一轮对话（问答）
  const session1 = createChatSession({ novel, chapter: CHAPTER_2, chapterContent: '' })
  const { rec: rec1, cb: cb1 } = makeRecorder()
  pushTurn({ text: '建议节奏放缓一些。' })
  await runChatTurn(session1, { visibleText: '这章节奏怎么把握？' }, CONFIG, cb1)
  assert.equal(rec1.plans.length, 0)

  // 保存 → 新会话恢复
  await saveChatSessionFile(
    CHAPTER_2.id,
    CHAPTER_2.title,
    session1.messages,
    [
      { id: 'u1', kind: 'user', text: '这章节奏怎么把握？', ts: 1 },
      { id: 'a1', kind: 'assistant', text: '建议节奏放缓一些。', streaming: false, ts: 2 },
    ],
    'idle',
  )
  const session2 = createChatSession({ novel, chapter: CHAPTER_2, chapterContent: '' })
  const file = await loadChatSessionFile(CHAPTER_2.id)
  assert.ok(file)
  const { restoreSessionMessages } = await import('../src/services/agentChat.ts')
  restoreSessionMessages(session2, file!.llmMessages)

  // 第二轮：请求里应带着第一轮的 system + user + assistant
  const { state: modelState } = await import('./stubs/modelScript.mjs')
  const before = modelState.requests.length
  pushTurn({ text: '好的，那先写第一段。' })
  const { rec: rec2, cb: cb2 } = makeRecorder()
  await runChatTurn(session2, { visibleText: '那开始吧' }, CONFIG, cb2)
  const lastReq = modelState.requests[modelState.requests.length - 1]
  assert.ok(modelState.requests.length > before)
  const text = requestText(modelState.requests.length - 1)
  assert.ok(text.includes('这章节奏怎么把握？'), '恢复后请求应保留第一轮用户消息')
  assert.ok(text.includes('建议节奏放缓一些。'), '恢复后请求应保留第一轮助手回复')
  assert.ok(text.includes('那开始吧'), '恢复后请求应含本轮新消息')
  assert.equal(rec2.plans.length, 0)
  assert.deepEqual(rec2.phases, ['planning', 'done'])
})

test('buildContinuePrevTask：注入上一章结尾；无前章返回 null', async () => {
  seedWorkspace()
  const novel = makeNovel()

  const task = await buildContinuePrevTask(novel, CHAPTER_2, 1500)
  assert.ok(task)
  assert.ok(task!.llm.includes('上一章结尾原文'))
  assert.ok(task!.llm.includes('剑光一闪，李明已下山。'))
  assert.ok(task!.llm.includes('第一章摘要：李明拜入师门。'))
  assert.ok(task!.llm.includes('1500'))
  assert.ok(task!.visible.includes('第一章'))

  // 第一章没有前章
  const none = await buildContinuePrevTask(novel, CHAPTER_1, 1500)
  assert.equal(none, null)
  assert.equal(findPrevChapter(novel, CHAPTER_1), undefined)
})
