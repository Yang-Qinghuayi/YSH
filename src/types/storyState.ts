/**
 * storyState.ts
 * 故事状态（v2）类型定义
 *
 * 人物只由两样东西记录：
 *   - 长期记忆（Skill）：Character.skill，存 novel.json
 *   - 短期记忆（POV）：本文件的 CharacterMemory，存 story-state.json
 * 另外记录主线的「整体进度」，以及长期记忆的改写日志（可回滚）。
 *
 * 存储：<小说文件夹>/story-state.json
 */

/** 单个角色的短期记忆（角色视角 / POV） */
export interface CharacterMemory {
  characterName: string // 关联键，匹配 Character.name
  /**
   * 以该角色视角写的近期记忆：TA 最近经历了什么、知道什么、误以为什么、此刻的处境与心绪。
   * 只包含 TA 能知道的信息（角色之间的信息差由此保留）。每章定稿时整段改写。
   */
  shortTerm: string
  /** 最后一次改写发生在哪一章 */
  lastUpdatedChapterId: string
  updatedAt: number
}

/** 一次长期记忆（Skill）改写记录 */
export interface LongTermChange {
  id: string
  characterName: string
  /** 在哪一章定稿时发生 */
  chapterId: string
  /** 触发改写的重大事件 */
  reason: string
  /** 改写前的 Skill 全文 */
  before: string
  /** 改写后的 Skill 全文 */
  after: string
  at: number
  /** 被回滚的时间（未回滚为 undefined） */
  revertedAt?: number
}

/** 定稿前快照：同一章重新定稿时，从这里恢复「本章之前」的状态，避免重复叠加 */
export interface FinalizeSnapshot {
  chapterId: string
  mainline: string
  mainlineUpdatedChapterId?: string
  characterMemories: CharacterMemory[]
}

/** 故事状态（绑定到小说，一部小说一个） */
export interface StoryState {
  version: 2
  novelId: string
  updatedAt: number
  /** 整体进度：主线梳理（前面各章概要 + 本章概要的滚动总结） */
  mainline: string
  mainlineUpdatedChapterId?: string
  /** 各角色短期记忆 */
  characterMemories: CharacterMemory[]
  /** 长期记忆改写日志 */
  longTermLog: LongTermChange[]
  /** 最近一次定稿前的快照 */
  lastFinalize?: FinalizeSnapshot
}
