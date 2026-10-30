/**
 * prompts/finalize.ts
 * 「本章定稿」四步流程的 system prompt 与分步指令。
 * 纯字符串拼装；超长正文只在这里裁剪，不改变磁盘内容。
 */

import type { ChapterMeta, Novel } from '@/types/novel';
import type { StoryState } from '@/types/storyState';

import { formatCharacterBlock, formatMainline } from '../../storyMemory';

/** 生成章节摘要的指令（本章定稿第一步，正文已在上下文中） */
export function buildChapterSummaryInstruction(): string {
  return [
    '请为以上本章正文写一段章节概要，用于后续章节的「前情提要」与整体进度梳理。',
    '要求：2-3 句、不超过 120 字；只写剧情事实（谁做了什么、结果如何、留下了什么线索），不要评价文笔。',
    '只输出摘要正文，不要标题、不要引号、不要 Markdown 标记。',
  ].join('\n');
}

// ===================== 本章定稿 prompt =====================

/** 定稿时送给模型的正文上限（字符）：超长时保留开头与结尾 */
const FINALIZE_CONTENT_MAX_CHARS = 16000;

function clipChapterForFinalize(content: string): string {
  const t = content.trim();
  if (t.length <= FINALIZE_CONTENT_MAX_CHARS) return t;
  const head = Math.floor(FINALIZE_CONTENT_MAX_CHARS * 0.4);
  const tail = FINALIZE_CONTENT_MAX_CHARS - head;
  return `${t.slice(0, head)}\n\n……（中间省略 ${t.length - FINALIZE_CONTENT_MAX_CHARS} 字）……\n\n${t.slice(-tail)}`;
}

/**
 * 「本章定稿」会话的 system prompt：
 * 小说简介 + 整体进度 + 人物（完整 Skill + 短期记忆）+ 本章全文。
 * 定稿是独立的轻量会话，不依赖聊天记录（隔很久再点定稿也能用）。
 */
export function buildFinalizeSystemPrompt(
  novel: Novel,
  chapter: ChapterMeta,
  chapterContent: string,
  storyState: StoryState | null
): string {
  const lines: string[] = [
    '你是一位细致的中文小说编辑，负责在作者确认本章定稿后，维护这部小说的「记忆」：章节概要、角色短期记忆、角色长期记忆（Skill）与主线整体进度。',
    '',
    '【小说简介】',
    novel.synopsis || '（无简介）',
    '',
  ];
  const mainline = formatMainline(storyState);
  lines.push(mainline || '【整体进度】\n（尚无）');
  lines.push('');
  const characterBlock = formatCharacterBlock(novel.characters, storyState, {
    fullSkill: true,
    chapters: novel.chapters,
  });
  if (characterBlock) {
    lines.push('以下是本章之前的人物记忆：');
    lines.push(characterBlock);
    lines.push('');
  }
  lines.push(`【本章正文】《${chapter.title}》`);
  lines.push(clipChapterForFinalize(chapterContent) || '（空）');
  lines.push('');
  lines.push('接下来作者会分步骤给出任务，请每次只完成当前这一步。');
  return lines.join('\n');
}

/** 定稿第二步：改写短期记忆（工具模式） */
export function buildShortTermInstruction(): string {
  return [
    '第二步：更新角色短期记忆。',
    '请调用 update_short_term_memory，为本章出场、或在本章得知了新信息的每个角色，以 TA 的视角（POV）整段改写短期记忆（200-300 字）：',
    '- 写 TA 最近经历了什么、知道什么、误以为什么、此刻的处境与心绪，以及 TA 眼下最在意的事；',
    '- 只写 TA 能知道的信息：TA 不在场、也没人告诉 TA 的事，不能写进 TA 的记忆；',
    '- 在旧的短期记忆基础上改写：仍然重要的旧信息保留，过时的删去；',
    '- 本章没出场、也没得知新信息的角色不要提交（保持原样）。',
  ].join('\n');
}

/** 定稿第三步：判断是否改写长期记忆（工具模式） */
export function buildLongTermInstruction(): string {
  return [
    '第三步：判断是否需要更新角色长期记忆（Skill）。',
    '长期记忆是角色的性格、信念、身份与说话方式等根本设定。只有当本章发生了足以改变某角色根本设定的重大事件（生死、背叛、顿悟、创伤、身份巨变、关系根本逆转等）时，才调用 update_long_term_memory；大多数章节都不需要。',
    '调用时 revisedSkill 必须是完整的 Skill 全文：保留原文中未受影响的内容，只修改受影响的部分，并可补一句这次改变的由来。',
    '如果不需要更新，直接回复「无需更新」，不要调用工具。',
  ].join('\n');
}

/** 定稿第四步：梳理整体进度 */
export function buildMainlineInstruction(
  summaries: { title: string; summary: string }[],
  previousMainline: string
): string {
  const lines: string[] = [
    '第四步：梳理主线整体进度。',
    '请综合「已有整体进度」与「各章概要」（含本章），重写一份主线整体进度，供后续写作把握全局：',
    '- 按时间顺序概括故事已经发生的主线事件、当前局势与主要悬念；',
    '- 前期内容可以高度压缩，越接近本章越具体；',
    '- 400-800 字，只写剧情事实，不评价；只输出进度正文，不要标题、不要 Markdown 标记。',
    '',
    '【已有整体进度】',
    previousMainline.trim() || '（尚无）',
    '',
    '【各章概要】',
  ];
  if (summaries.length === 0) lines.push('（无）');
  for (const s of summaries) lines.push(`- ${s.title}：${s.summary}`);
  return lines.join('\n');
}
