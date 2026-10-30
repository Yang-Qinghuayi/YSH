/**
 * agentModules.test.ts
 * 重构后 Agent 模块边界的回归测试：纯文本、prompt、会话、转录裁剪、工具注册表。
 * 只验证各模块的单一职责，模型端到端行为由 agentChat / finalize 的 e2e 用例覆盖。
 */

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';

import { createHooks } from './stubs/loader.mjs';

const here = import.meta.dirname;
const root = path.resolve(here, '..');
registerHooks(createHooks({ root, stubsDir: path.join(here, 'stubs') }));

const { parseMentions, sliceContextBeforeCursor } = await import('../src/services/agent/text.ts');
const { buildChatSystemPrompt, buildChatGenerateInstruction, buildChatContinuationInstruction } =
  await import('../src/services/agent/prompts/chat.ts');
const { buildFinalizeSystemPrompt, buildMainlineInstruction } =
  await import('../src/services/agent/prompts/finalize.ts');
const { createSession, recentChapterSummaries } = await import('../src/services/agent/session.ts');
const { prepareTranscriptForPersist } = await import('../src/services/agent/chat/transcript.ts');
const { CHAT_TOOLS, findTool, toToolSchemas } =
  await import('../src/services/agent/tools/registry.ts');

const novel = () => ({
  id: 'n1',
  title: '测试小说',
  synopsis: '一个关于归乡的故事。',
  createdAt: 1,
  updatedAt: 1,
  characters: [
    { id: 'c1', name: '李明', skill: '剑客。' },
    { id: 'c2', name: '苏婉', skill: '医师。' },
  ],
  chapters: [
    { id: 'ch1', filename: '001.md', title: '第一章', order: 1, summary: '李明出发。' },
    { id: 'ch2', filename: '002.md', title: '第二章', order: 2, summary: '途中相遇。' },
    { id: 'ch3', filename: '003.md', title: '第三章', order: 3 },
  ],
});

test('text.parseMentions：只保留已存在且去重的角色提及', () => {
  const mentions = parseMentions(
    '让 @李明 与 @苏婉 同行，@李明 不要回头，@未知人 不出场。',
    novel() as never
  );
  assert.deepEqual(
    mentions.map((m) => m.characterName),
    ['李明', '苏婉']
  );
});

test('text.sliceContextBeforeCursor：剔除 @ 行并只保留光标前末尾 N 字', () => {
  const text = '第一段\n@李明 强制出场\n第二段结尾';
  assert.ok(sliceContextBeforeCursor(text, text.length, 6).endsWith('第二段结尾'));
  assert.equal(sliceContextBeforeCursor(text, 3), '第一段');
  assert.ok(!sliceContextBeforeCursor(text, text.length).includes('@李明'));
});

test('prompts/chat：system prompt 与生成指令携带最新故事上下文和已改大纲', () => {
  const n = novel() as never;
  const chapter = (n as ReturnType<typeof novel>).chapters[2] as never;
  const system = buildChatSystemPrompt(n, chapter, {
    storyState: null,
    chapterContent: '已有正文',
    lengthTarget: 1500,
    recentSummaries: [{ title: '第二章', summary: '途中相遇。' }],
  });
  assert.ok(system.includes('一个关于归乡的故事。'));
  assert.ok(system.includes('【目标字数】'));
  assert.ok(system.includes('1500 字'));
  assert.ok(system.includes('本章已有 4 字正文'));

  const instruction = buildChatGenerateInstruction(
    {
      outline: '【作者改过】雨夜归乡',
      approach: '短句白描',
      selectedCharacters: [],
      referencedLoreEntries: [],
    },
    1000,
    false
  );
  assert.ok(instruction.includes('【作者改过】雨夜归乡'));
  assert.ok(instruction.includes('短句白描'));
  assert.ok(instruction.includes('append_to_chapter'));
  assert.ok(buildChatContinuationInstruction().includes('append_to_chapter'));
});

test('prompts/finalize：超长章节正文被裁剪，主线指令包含旧进度与各章概要', () => {
  const n = novel() as never;
  const chapter = (n as ReturnType<typeof novel>).chapters[2] as never;
  const prompt = buildFinalizeSystemPrompt(n, chapter, '长'.repeat(17000), null);
  assert.ok(prompt.includes('中间省略'));
  assert.ok(prompt.includes('【本章正文】《第三章》'));

  const instruction = buildMainlineInstruction(
    [{ title: '第一章', summary: '李明出发。' }],
    '此前主线'
  );
  assert.ok(instruction.includes('此前主线'));
  assert.ok(instruction.includes('第一章：李明出发。'));
});

test('session.createSession：默认值正确且会话之间互不共享 AbortController', () => {
  const n = novel() as never;
  const chapter = (n as ReturnType<typeof novel>).chapters[2] as never;
  const a = createSession({ novel: n, chapter, chapterContent: 'abc' });
  const b = createSession({ novel: n, chapter, chapterContent: 'abcdef' });
  assert.equal(a.phase, 'idle');
  assert.equal(a.cursorPosition, 3);
  assert.equal(a.messages.length, 0);
  assert.notEqual(a.abortController, b.abortController);
});

test('session.recentChapterSummaries：按章节顺序取当前章之前最近的 N 条', () => {
  const n = novel() as never;
  const chapter = (n as ReturnType<typeof novel>).chapters[2] as never;
  assert.deepEqual(recentChapterSummaries(n, chapter, 1), [
    { title: '第二章', summary: '途中相遇。' },
  ]);
  assert.deepEqual(
    recentChapterSummaries(n, chapter).map((s) => s.title),
    ['第一章', '第二章']
  );
});

test('chat/transcript：只保留最近 3 个撤销快照并裁剪工具详情', () => {
  const tool = (id: string, snapshot: string) => ({
    id,
    kind: 'tool' as const,
    tool: 'append_to_chapter',
    status: 'done' as const,
    argsSummary: '写入',
    resultText: '详'.repeat(2100),
    write: {
      chapterId: 'ch3',
      chapterTitle: '第三章',
      newContent: '新正文',
      addedChars: 3,
      snapshot,
    },
    ts: 1,
  });
  const transcript = ['1', '2', '3', '4'].map((id) => tool(id, `快照${id}`)) as never;
  const persisted = prepareTranscriptForPersist(transcript) as Array<ReturnType<typeof tool>>;
  assert.equal(persisted[0].write?.snapshot, undefined);
  assert.equal(persisted[1].write?.snapshot, '快照2');
  assert.equal(persisted[3].write?.snapshot, '快照4');
  assert.ok(persisted[0].resultText?.endsWith('…'));
});

test('tools/registry：交互面板工具集包含只读调研与写章工具', () => {
  const names = toToolSchemas(CHAT_TOOLS).map((tool) => tool.function.name);
  assert.ok(names.includes('query_lore'));
  assert.ok(names.includes('read_story_state'));
  assert.ok(names.includes('append_to_chapter'));
  assert.ok(names.includes('replace_tail'));
  assert.equal(findTool('append_to_chapter', CHAT_TOOLS)?.def.function.name, 'append_to_chapter');
  assert.equal(findTool('update_long_term_memory', CHAT_TOOLS), undefined);
});
