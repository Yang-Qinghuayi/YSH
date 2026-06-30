/**
 * storyState.ts
 * 故事状态层类型定义
 *
 * 角色的"动态状态"（随情节变化的"现在怎样"）独立于静态档案，叠在此处。
 * 与 Character 靠 characterName 弱关联，不内嵌进 novel.json。
 * 存储：novels/<novel-id>/story-state.json
 */

/** 人物关系 */
export interface Relationship {
  target: string // 对方角色名
  relation: string // 关系描述，如「决裂」「同盟」「师徒」
  sinceChapterId?: string // 从哪一章开始如此
}

/** 单个角色的动态状态 */
export interface CharacterState {
  characterName: string // 关联键，匹配 Character.name
  mood?: string // 心情/想法（主观项，B 方案也由 Agent 自动更新）
  location?: string // 当前位置
  injuries?: string // 伤势
  possessions?: string[] // 持有物品
  relationships: Relationship[] // 与他人关系
  notes?: string // 其他经历/想法
  lastUpdatedChapterId: string // 溯源：最后一次更新发生在哪一章
  updatedAt: number
}

/** 时间线节点（本期预留结构，arc 追踪推迟到后续迭代） */
export interface TimelineNode {
  id: string
  chapterId: string
  label: string
  detail?: string
  order: number
}

/** 伏笔（本期预留结构，arc 追踪推迟到后续迭代） */
export interface Foreshadowing {
  id: string
  description: string
  plantedChapterId: string
  resolvedChapterId?: string
  status: 'open' | 'resolved' | 'abandoned'
}

/** 故事状态（绑定到小说，一部小说一个） */
export interface StoryState {
  novelId: string
  updatedAt: number
  characterStates: CharacterState[]
  timeline: TimelineNode[] // 本期预留，可为空
  foreshadowings: Foreshadowing[] // 本期预留，可为空
  notes?: string
}
