/**
 * chat/engine.ts
 * 交互面板的多轮 Agent 引擎：刷新 system prompt、工具循环、PLAN 闸门、确认后写章。
 * 只通过 ChatTurnCallbacks 把事件交给页面编排层，不直接接触 Pinia / DOM。
 */

import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions';

import { supportsToolCalling } from '@/services/agent/llm';
import {
  buildChatContinuationInstruction,
  buildChatGenerateInstruction,
  buildChatSystemPrompt,
} from '@/services/agent/prompts';
import {
  buildRoundKey,
  detectRepeatedRounds,
  extractPartialContent,
  NUDGE_OUTPUT_PLAN,
  parseContentBlock,
  parsePlan,
  PLAN_BLOCK_PATTERN,
} from '@/services/agent/protocol';
import { runOneTurn } from '@/services/agent/runtime';
import { recentChapterSummaries, setSessionPhase } from '@/services/agent/session';
import { CHAT_TOOLS, findTool } from '@/services/agent/tools/registry';
import { loadStoryState } from '@/services/storyStateService';
import type {
  AgentConfig,
  AgentPlan,
  AgentSession,
  AgentTool,
  ChatTurnCallbacks,
  ChatTurnInput,
  ChatWriteData,
  SessionPhase,
  ToolContext,
  ToolResult,
} from '@/types/agent';

/** 单轮对话的最大工具轮数 */
const CHAT_TURN_MAX_TOOL_ROUNDS = 8;
/** plan 确认后的生成轮：写正文 + 少量补查 */
const CHAT_GENERATE_MAX_TOOL_ROUNDS = 5;

const WRITE_TOOL_NAMES = ['append_to_chapter', 'replace_tail'];

function isWriteTool(name: string): boolean {
  return WRITE_TOOL_NAMES.includes(name);
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message));
}

// ===================== 工具执行（chat 版：富事件 + 写入数据回传） =====================

function toolContext(session: AgentSession): ToolContext {
  return {
    novel: session.novel,
    chapter: session.chapter,
    chapterContent: session.chapterContent,
    cursorPosition: session.cursorPosition,
    liveContent: session.liveContent,
  };
}

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const clip = (s: string, n: number) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };
  if (isWriteTool(name)) {
    const content = String(args.content ?? '');
    if (name === 'replace_tail') {
      return `重写结尾 ${args.chars ?? 0} 字 → ${clip(content, 40) || '（空）'}`;
    }
    return `写入 ${content.length} 字：${clip(content, 40) || '（空）'}`;
  }
  try {
    const s = JSON.stringify(args);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  } catch {
    return '';
  }
}

function isWriteData(data: unknown): data is ChatWriteData {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as ChatWriteData).chapterId === 'string' &&
    typeof (data as ChatWriteData).newContent === 'string'
  );
}

/**
 * 执行一批 tool_calls（chat 版）：逐工具发 start/end 事件，写章工具回传写入数据。
 * 返回本轮所有写章工具的写入结果（供引擎判断「本轮是否已落笔」）。
 */
async function executeChatToolCalls(
  session: AgentSession,
  toolCalls: ChatCompletionMessageFunctionToolCall[],
  registry: AgentTool[],
  cb: ChatTurnCallbacks
): Promise<ChatWriteData[]> {
  const ctx = toolContext(session);
  const writes: ChatWriteData[] = [];

  for (const tc of toolCalls) {
    const tool = findTool(tc.function.name, registry);
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || '{}');
    } catch {
      args = {};
    }

    cb.onToolStart?.(tc.function.name, summarizeArgs(tc.function.name, args));

    let result: ToolResult;
    if (!tool) {
      result = { ok: false, text: `未知工具：${tc.function.name}` };
    } else {
      try {
        result = await tool.execute(args, ctx);
      } catch (e) {
        result = {
          ok: false,
          error: String(e),
          text: `工具 ${tc.function.name} 执行失败：${e}`,
        };
      }
    }

    const write = isWriteData(result.data) ? result.data : undefined;
    if (write && result.ok) writes.push(write);
    cb.onToolEnd?.(tc.function.name, result.ok, result.text, write);
    session.messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: result.text,
    });
  }

  return writes;
}

// ===================== plan 提取 =====================

function extractPlanFromText(text: string): AgentPlan | null {
  if (!PLAN_BLOCK_PATTERN.test(text)) return null;
  return parsePlan(text);
}

/** 从本轮新产生的 assistant 消息中回溯查找 PLAN（仅扫描 fromIdx 之后，避免捞到旧 plan） */
function backtrackPlan(session: AgentSession, fromIdx: number): AgentPlan | null {
  for (let j = session.messages.length - 1; j >= fromIdx; j--) {
    const m = session.messages[j];
    if (
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      PLAN_BLOCK_PATTERN.test(m.content)
    ) {
      return parsePlan(m.content);
    }
  }
  return null;
}

function setPhase(session: AgentSession, phase: SessionPhase, cb: ChatTurnCallbacks): void {
  setSessionPhase(session, phase);
  cb.onPhase?.(phase);
}

// ===================== 单轮对话 =====================

/**
 * 执行一轮对话：user 消息 → 工具循环（调研/写章）→ 文本。
 * 输出含 PLAN 块 → awaiting_confirmation（闸门）；否则当作对话回复收尾。
 */
export async function runChatTurn(
  session: AgentSession,
  input: ChatTurnInput,
  config: AgentConfig,
  cb: ChatTurnCallbacks
): Promise<void> {
  try {
    // 每轮刷新 system prompt（小说简介/整体进度/人物记忆/前情/当前章/目标字数/POV 规则/协作规则）：
    // 定稿后人物记忆、整体进度会变，恢复的旧会话也要用最新的
    const storyState = await loadStoryState(session.novelId);
    const sys = buildChatSystemPrompt(session.novel, session.chapter, {
      storyState,
      recentSummaries: recentChapterSummaries(session.novel, session.chapter),
      lengthTarget: config.lengthTarget,
      toolFree: !supportsToolCalling(config.model),
      chapterContent: session.liveContent?.() ?? session.chapterContent,
    });
    if (session.messages[0]?.role === 'system') {
      session.messages[0] = { role: 'system', content: sys };
    } else {
      session.messages.unshift({ role: 'system', content: sys });
    }

    const forcedNote = session.forcedMentions.length
      ? `\n\n作者已强制指定：${session.forcedMentions.map((m) => m.raw).join(' ')}，规划与正文必须纳入。`
      : '';

    const turnStartIdx = session.messages.length;
    session.messages.push({
      role: 'user',
      content: (input.llmText ?? input.visibleText) + forcedNote,
    });

    setPhase(session, 'planning', cb);
    cb.onStatus?.('正在思考…');

    const toolFree = !supportsToolCalling(config.model);
    const maxRounds = CHAT_TURN_MAX_TOOL_ROUNDS;
    const halfRound = Math.max(1, Math.floor(maxRounds * 0.5));
    const recentRoundKeys: string[] = [];

    // 每轮重置 tool 参数累积（index 每轮从 0 重新编号）
    const argsAcc = new Map<number, { name: string; args: string }>();
    const handleArgsDelta = (index: number, _id: string, name: string, delta: string) => {
      const acc = argsAcc.get(index) ?? { name: '', args: '' };
      if (name) acc.name = name;
      acc.args += delta;
      argsAcc.set(index, acc);
      if (isWriteTool(acc.name)) {
        const partial = extractPartialContent(acc.args);
        if (partial) cb.onWritePreview?.(acc.name, partial);
      }
    };

    for (let i = 0; i < maxRounds; i++) {
      const roundIndex = i + 1;
      argsAcc.clear();

      if (input.forcePlan && roundIndex === halfRound) {
        session.messages.push({ role: 'user', content: NUDGE_OUTPUT_PLAN });
      }

      // 强制 plan 的最后一轮：关工具、逼出 PLAN；普通轮最后一轮也关工具（文本收尾）
      const finalRound = roundIndex === maxRounds;
      const tools = toolFree || finalRound ? [] : CHAT_TOOLS;

      const { text, toolCalls } = await runOneTurn(session, config, {
        tools,
        maxTokens: 1500,
        onTextDelta: (delta) => cb.onTextDelta?.(delta),
        onToolArgsDelta: handleArgsDelta,
        callbacks: {
          onContextTrimmed: cb.onContextTrimmed,
          onStatus: cb.onStatus,
        },
      });

      if (toolCalls && toolCalls.length > 0) {
        await executeChatToolCalls(session, toolCalls, tools, cb);
        cb.onStatus?.('继续…');
        try {
          if (detectRepeatedRounds(recentRoundKeys, buildRoundKey(toolCalls))) {
            session.messages.push({ role: 'user', content: NUDGE_OUTPUT_PLAN });
          }
        } catch {
          // 忽略签名异常
        }
        continue;
      }

      // 无工具调用 → 检查是否产出 plan
      const plan = extractPlanFromText(text) ?? backtrackPlan(session, turnStartIdx);
      if (plan) {
        session.plan = plan;
        setPhase(session, 'awaiting_confirmation', cb);
        cb.onPlanReady?.(plan);
        cb.onDone?.();
        return;
      }

      if (input.forcePlan) {
        cb.onError?.(new Error('Agent 未能产出规划，请补充概要细节后重试。'));
        cb.onDone?.();
        return;
      }

      // 普通对话回复（文本已流式输出）
      setPhase(session, 'done', cb);
      cb.onDone?.();
      return;
    }

    // 轮数用尽：回溯找 plan，找不到才报错
    const plan = backtrackPlan(session, turnStartIdx);
    if (plan) {
      session.plan = plan;
      setPhase(session, 'awaiting_confirmation', cb);
      cb.onPlanReady?.(plan);
    } else {
      cb.onError?.(new Error('本轮超出最大工具调用轮数'));
    }
    cb.onDone?.();
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb);
      return;
    }
    cb.onError?.(e);
  }
}

// ===================== plan 确认后的生成轮 =====================

/**
 * plan 确认后的生成轮：模型按已确认大纲调用写章工具落笔（或 toolFree 回吐 CONTENT 块）。
 * 写完即结束；人物记忆与整体进度由作者点「本章定稿」时统一更新。
 */
export async function runChatGenerateTurn(
  session: AgentSession,
  config: AgentConfig,
  cb: ChatTurnCallbacks
): Promise<void> {
  try {
    const plan = session.plan;
    if (!plan) {
      cb.onError?.(new Error('没有已确认的规划'));
      return;
    }

    setPhase(session, 'generating', cb);
    cb.onStatus?.('正在写入正文…');
    session.messages.push({
      role: 'user',
      content: buildChatGenerateInstruction(
        plan,
        config.lengthTarget,
        !supportsToolCalling(config.model)
      ),
    });

    const toolFree = !supportsToolCalling(config.model);
    const maxTokens = (config.lengthTarget ?? 1500) * 1.4 + 300;
    let wrote = false;

    const argsAcc = new Map<number, { name: string; args: string }>();
    const handleArgsDelta = (index: number, _id: string, name: string, delta: string) => {
      const acc = argsAcc.get(index) ?? { name: '', args: '' };
      if (name) acc.name = name;
      acc.args += delta;
      argsAcc.set(index, acc);
      if (isWriteTool(acc.name)) {
        const partial = extractPartialContent(acc.args);
        if (partial) cb.onWritePreview?.(acc.name, partial);
      }
    };

    for (let i = 0; i < CHAT_GENERATE_MAX_TOOL_ROUNDS && !wrote; i++) {
      argsAcc.clear();
      const tools = toolFree ? [] : CHAT_TOOLS;
      const { text, toolCalls, finishReason } = await runOneTurn(session, config, {
        tools,
        maxTokens,
        onTextDelta: (delta) => cb.onTextDelta?.(delta),
        onToolArgsDelta: handleArgsDelta,
        callbacks: {
          onContextTrimmed: cb.onContextTrimmed,
          onStatus: cb.onStatus,
        },
      });

      if (toolCalls && toolCalls.length > 0) {
        const writes = await executeChatToolCalls(session, toolCalls, tools, cb);
        if (writes.length > 0) {
          wrote = true;
          break;
        }
        if (finishReason === 'length') {
          session.messages.push({
            role: 'user',
            content: buildChatContinuationInstruction(),
          });
          cb.onStatus?.('正文被截断，继续写入…');
          continue;
        }
        continue;
      }

      if (toolFree) {
        const content = parseContentBlock(text);
        if (content) {
          cb.onVirtualWrite?.(content);
          wrote = true;
          break;
        }
        cb.onWarn?.('Agent 未输出正文块，请重试。');
        break;
      }

      cb.onWarn?.('Agent 本轮未调用写入工具，可提示它继续写入。');
      break;
    }

    setPhase(session, 'done', cb);
    cb.onDone?.();
  } catch (e) {
    if (isAbort(e)) {
      setPhase(session, 'canceled', cb);
      return;
    }
    cb.onError?.(e);
  }
}
