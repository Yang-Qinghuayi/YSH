/**
 * tools/memory.ts
 * 有副作用的记忆工具：短期记忆（POV）改写、长期记忆（Skill）改写。
 * 仅由「本章定稿」流水线注册给模型。
 */

import { saveNovelMeta } from '@/services/novelService';
import {
  applyLongTermChange,
  applyShortTermMemories,
  type ShortTermPatch,
} from '@/services/storyMemory';
import { loadStoryState, saveStoryState } from '@/services/storyStateService';
import type { AgentTool } from '@/types/agent';

/** 模型偶尔会带上 @ 前缀或空白 */
function normalizeName(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/^@/, '')
    .trim();
}

/**
 * update_short_term_memory：以角色视角整段改写短期记忆。
 * 只改提交的角色；未提交的角色（本章未出场、也没得知新信息）保持原样 —— POV 信息差由此保留。
 */
export const updateShortTermMemoryTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'update_short_term_memory',
      description:
        '以角色视角（POV）整段改写本章出场或得知新信息的角色的短期记忆。只提交需要更新的角色；每条 shortTerm 是改写后的完整短期记忆（200-300 字），只写该角色能知道的信息。',
      parameters: {
        type: 'object',
        properties: {
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                characterName: { type: 'string', description: '角色名' },
                shortTerm: {
                  type: 'string',
                  description:
                    '改写后的完整短期记忆：TA 最近经历了什么、知道什么、误以为什么、此刻的处境与心绪',
                },
              },
              required: ['characterName', 'shortTerm'],
            },
          },
        },
        required: ['memories'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const raw = (Array.isArray(args.memories) ? args.memories : []) as Partial<ShortTermPatch>[];
      const patches: ShortTermPatch[] = raw.map((p) => ({
        characterName: normalizeName(p?.characterName),
        shortTerm: String(p?.shortTerm ?? ''),
      }));
      const known = new Set(ctx.novel.characters.map((c) => c.name));
      const unknown = patches.map((p) => p.characterName).filter((n) => n && !known.has(n));
      const valid = patches.filter((p) => known.has(p.characterName));

      const state = await loadStoryState(ctx.novel.id);
      const { state: next, updated } = applyShortTermMemories(state, valid, ctx.chapter.id);
      if (updated.length) await saveStoryState(next);
      const tail = unknown.length ? `；忽略未知角色：${unknown.join('、')}` : '';
      return {
        ok: true,
        data: { updated },
        text: updated.length
          ? `已改写 ${updated.length} 个角色的短期记忆：${updated.join('、')}${tail}。`
          : `没有可更新的短期记忆${tail}。`,
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `更新短期记忆失败：${e}` };
    }
  },
};

/**
 * update_long_term_memory：重大事件改变了角色时，改写其长期记忆（Skill）。
 * 直接写入 novel.json，同时在 story-state.json 记改写日志（可在故事状态面板回滚）。
 * 会同步修改 ctx.novel.characters，便于同一次定稿中后续调用看到最新 Skill。
 */
export const updateLongTermMemoryTool: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'update_long_term_memory',
      description:
        '当本章发生了足以改变某角色性格、信念或身份的重大事件（生死、背叛、顿悟、创伤、身份巨变等）时，改写该角色的长期记忆（Skill）。大多数章节不需要调用。revisedSkill 必须是改写后的完整 Skill 全文：保留原文未受影响的内容，只修改受影响的部分。',
      parameters: {
        type: 'object',
        properties: {
          characterName: { type: 'string', description: '角色名' },
          reason: {
            type: 'string',
            description: '触发改写的重大事件（一句话）',
          },
          revisedSkill: {
            type: 'string',
            description: '改写后的完整长期记忆（Skill）全文',
          },
        },
        required: ['characterName', 'reason', 'revisedSkill'],
      },
    },
  },
  async execute(args, ctx) {
    try {
      const name = normalizeName(args.characterName);
      const state = await loadStoryState(ctx.novel.id);
      const result = applyLongTermChange(
        ctx.novel.characters,
        state,
        {
          characterName: name,
          reason: String(args.reason ?? ''),
          revisedSkill: String(args.revisedSkill ?? ''),
        },
        ctx.chapter.id
      );
      if (!result) {
        return {
          ok: false,
          text: `未改写「${name}」的长期记忆（角色不存在、内容为空或与原文相同）。`,
        };
      }
      ctx.novel.characters = result.characters;
      await saveNovelMeta(ctx.novel);
      await saveStoryState(result.state);
      return {
        ok: true,
        data: { change: result.change, characters: result.characters },
        text: `已改写「${name}」的长期记忆（原因：${result.change.reason}）。`,
      };
    } catch (e) {
      return { ok: false, error: String(e), text: `更新长期记忆失败：${e}` };
    }
  },
};
