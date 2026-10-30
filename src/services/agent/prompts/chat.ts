/**
 * prompts/chat.ts
 * 交互面板的 system prompt 与生成阶段指令。
 * 纯字符串拼装，不执行 IO。
 */

import type { AgentPlan } from '@/types/agent';
import type { ChapterMeta, Novel } from '@/types/novel';
import type { StoryState } from '@/types/storyState';

import { formatCharacterBlock, formatMainline, POV_RULES } from '../../storyMemory';

/**
 * 构建交互面板（chat 模式）的 system prompt。
 *
 * 与 buildAgentSystemPrompt 的区别：chat 模式是多轮对话，一轮里模型要自己决定
 * 「这是写作任务（先调研、出 PLAN 等作者确认）还是普通问答（直接简洁回复）」；
 * 写作任务落笔必须走 append_to_chapter / replace_tail 工具，而不是直接吐正文。
 */
export function buildChatSystemPrompt(
  novel: Novel,
  chapter: ChapterMeta,
  opts?: {
    /** 故事状态：整体进度 + 角色短期记忆 */
    storyState?: StoryState | null;
    recentSummaries?: { title: string; summary: string }[];
    /** 目标字数（500/1000/1500/2000），约束规划粒度与正文长度 */
    lengthTarget?: number;
    toolFree?: boolean;
    /** 当前章节现有正文（供模型判断「续写本章」的衔接点） */
    chapterContent?: string;
    /** 「续写上一章」场景注入的上一章上下文 */
    prevChapterContext?: { title: string; tail: string; summary?: string };
  }
): string {
  const lines: string[] = [
    '你是一位专业的中文小说创作 Agent 副驾，正在与作者进行多轮对话协作（交互模式）。',
    '',
    '【小说简介】',
    novel.synopsis || '（无简介）',
    '',
  ];

  const mainline = formatMainline(opts?.storyState);
  if (mainline) {
    lines.push(mainline);
    lines.push('');
  }

  const characterBlock = formatCharacterBlock(novel.characters, opts?.storyState, {
    fullSkill: !!opts?.toolFree,
    chapters: novel.chapters,
  });
  if (characterBlock) {
    lines.push(characterBlock);
    lines.push('');
  }

  const summaries = (opts?.recentSummaries ?? []).filter((s) => s.summary?.trim());
  if (summaries.length > 0) {
    lines.push('【前情提要】');
    for (const s of summaries) lines.push(`- ${s.title}：${s.summary.trim()}`);
    lines.push('');
  }

  lines.push(`【当前章节】《${chapter.title}》`);
  const contentLen = opts?.chapterContent?.trim().length ?? 0;
  lines.push(
    contentLen > 0 ? `  - 本章已有 ${contentLen} 字正文` : '  - 本章目前为空（新开的章节）'
  );
  if (opts?.prevChapterContext) {
    const p = opts.prevChapterContext;
    lines.push(`  - 前一章是《${p.title}》（作者要求以它为起点续写本章）`);
    if (p.summary?.trim()) lines.push(`  - 前情摘要：${p.summary.trim()}`);
    if (p.tail.trim()) {
      lines.push('  - 上一章结尾原文：');
      lines.push(p.tail.trim());
    }
  }
  lines.push('');

  if (opts?.lengthTarget) {
    lines.push(
      `【目标字数】本次写入章节的正文总量约 ${opts.lengthTarget} 字（允许 ±15% 浮动）。规划大纲时按此体量拆分场景，正文写到接近该体量即可停笔。`
    );
    lines.push('');
  }

  if (novel.characters.length > 0) {
    lines.push(POV_RULES);
    lines.push('');
  }

  lines.push('【协作规则】');
  if (opts?.toolFree) {
    lines.push(
      '1. 本次运行不提供任何工具。写作任务请依据以上已有信息直接规划；要写入章节的正文用 <<<CONTENT>>>...<<<END>>> 包裹输出（系统会自动落盘）。'
    );
    lines.push(
      '2. 写作任务（作者给了章节概要/要求续写/要求改写）：先输出章节规划 <<<PLAN>>>...<<<END>>>，等作者确认后再写正文。规划格式必须严格为：'
    );
  } else {
    lines.push(
      '1. 可调用只读工具（query_lore / search_chapters / read_story_state / read_context / select_characters）调研上下文。'
    );
    lines.push(
      '2. 写作任务（作者给了章节概要 / 要求续写 / 要求改写）：先调研，然后输出章节规划 <<<PLAN>>>...<<<END>>>，等作者确认后再写正文。规划格式必须严格为：'
    );
  }
  lines.push('<<<PLAN>>>');
  lines.push(
    '{"outline":"章节大纲（分场景/分段的写作要点，体量与目标字数匹配）","selectedCharacters":[{"id":"角色id","name":"名称","reason":"为何选用"}],"referencedLoreEntries":[{"id":"条目id","name":"名称"}],"approach":"整体写法思路"}'
  );
  lines.push('<<<END>>>');
  lines.push(
    '规划输出后本轮结束，等待作者确认或提出修改意见（作者后续的修改意见也要按此格式重新输出完整规划）。'
  );
  if (!opts?.toolFree) {
    lines.push(
      '3. 正文写入章节只能通过工具：append_to_chapter（追加新正文）或 replace_tail（重写结尾）。不要在对话里直接输出成段正文。'
    );
  } else {
    lines.push(
      '3. 正文写入章节只能用 <<<CONTENT>>>...<<<END>>> 包裹，不要在对话里直接输出成段正文。'
    );
  }
  lines.push(
    '4. 作者提问或讨论（不是写作任务）：直接简洁回复（300 字以内，不要输出 PLAN、不要写大段正文）。'
  );
  lines.push('5. 作者用 @角色名 强制指定时，规划与正文必须纳入该角色。');
  lines.push('6. 正文中不要出现 @提及 标记、章节标题或任何解释性文字。');
  lines.push(
    '7. 规划与写作都要遵守 POV 认知规则：规划大纲时写明关键角色此刻知道/不知道什么；写正文前可用 select_characters / read_story_state 取回角色记忆。'
  );

  return lines.join('\n');
}

export function buildChatGenerateInstruction(
  plan: AgentPlan,
  lengthTarget?: number,
  toolFree?: boolean
): string {
  const lines: string[] = [
    '请严格按以下作者已确认的章节规划写正文（作者可能已修订，以此为准）：',
    '不要沿用你此前输出的任何版本，以本消息的已确认大纲为准。',
    '',
  ];
  if (plan.outline?.trim()) lines.push('【已确认大纲】', plan.outline.trim(), '');
  if (plan.approach?.trim()) lines.push('【写法思路】', plan.approach.trim(), '');
  const target = lengthTarget
    ? `正文总量约 ${lengthTarget} 字（±15%），写到接近该体量即停笔。`
    : '';
  if (toolFree) {
    lines.push(
      `${target}用 <<<CONTENT>>>...<<<END>>> 包裹完整正文输出（系统会自动写入章节），不要在标记外输出正文或解释。`
    );
  } else {
    lines.push(
      `${target}调用 append_to_chapter 工具把正文写入章节（正文较长时可分多次调用依次追加；需要重写结尾时用 replace_tail）。`,
      '正文不要出现 @提及 标记、章节标题或解释性文字。'
    );
  }
  return lines.join('\n');
}

/** 正文被 max_tokens 截断后，让模型继续通过写章工具补完。 */
export function buildChatContinuationInstruction(): string {
  return '上面的输出因长度限制被截断。请继续：正文没写完就继续调用 append_to_chapter 分次写完；已写完则直接回复「完成」。';
}
