/**
 * 角色文风（写作指导）
 * 角色档案内的一节：这个角色出场时怎么写。
 * 由旧 CharacterSkill 演化而来，但不再独立成"技能"列表——文风随角色整体激活。
 */
export interface CharacterVoice {
  description?: string // 触发说明，如"用于李明战斗场面"，供 Agent 按需激活
  prompt: string // 文风指导，如"剑法凌厉、短句、动词密集"
}

/**
 * @deprecated 旧版角色的"技能"结构，仅用于数据迁移。新代码请使用 CharacterVoice。
 */
export interface CharacterSkill {
  id: string
  name: string
  prompt: string
}

/**
 * 旧版角色结构（含 profile / skills），仅用于迁移读取，不直接使用。
 */
export interface LegacyCharacter {
  id: string
  name: string
  profile?: string
  skills?: CharacterSkill[]
  [key: string]: unknown
}

// 小说中的角色（静态档案）
// 角色分为两层：
//   1. 静态档案（本接口）——性格/出身/爱好/外貌/别名/文风，不变的"是谁"，走 skill 激活机制
//   2. 动态状态——经历/心情/想法/位置/伤势/关系，随情节变，叠在 StoryState 上（见 types/storyState.ts）
// 状态不进档案、档案不进状态。
export interface Character {
  id: string
  name: string // @提及键，如 @李明
  // —— 静态档案：不变的"是谁" ——
  personality?: string // 性格
  background?: string // 出身背景
  hobbies?: string // 爱好
  appearance?: string // 外貌
  aliases?: string[] // 别名/触发词
  voice?: CharacterVoice // 文风（出场时怎么写）
  description?: string // 整体触发说明，供 Agent 按需激活
}

// 剧情技能（可复用写作模板）
export interface PlotSkill {
  id: string
  name: string // 用于 @提及，如 @矛盾激化
  prompt: string // 这个剧情模板的写作指导
  description?: string // 触发说明，供 Agent 按需激活
}

// 章节元数据（存于 novel.json 中）
export interface ChapterMeta {
  id: string
  filename: string // 如 "001_第一章.md"，对应 chapters/ 目录下的文件
  title: string
  summary?: string // 可选章节摘要，给后续章节提供上下文
  order: number // 排列顺序
  wordCount?: number // 字数（不含 Markdown 格式符和空白）
}

// 全局搜索结果
export interface SearchResult {
  chapterId: string
  chapterTitle: string
  chapterFilename: string
  lineIndex: number // 0-indexed
  lineContent: string // 该行原始文本
  matchStart: number // 匹配位置（在 lineContent 中的偏移）
  matchEnd: number
}

// 小说元数据（存于 novel.json）
export interface Novel {
  id: string
  title: string
  synopsis: string // 故事简介，作为 AI 全局上下文
  createdAt: number
  updatedAt: number
  characters: Character[]
  plotSkills: PlotSkill[]
  chapters: ChapterMeta[]
}

// @ 提及解析结果
// 角色档案合并后，仅支持 @角色名（激活该角色档案含文风）与 @剧情技能名。
export interface Mention {
  type: 'character' | 'plot-skill'
  raw: string // 原始文本，如 "@李明"
  characterName?: string
  character?: Character
  plotSkill?: PlotSkill
}

// AI 生成请求参数
export interface AIGenerateParams {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string // 当前章节完整内容
  cursorPosition: number // 光标位置（字符偏移量）
  mentions: Mention[] // 当前块中的 @提及
  loreContextText?: string // 可选：当前小说的 Lore 资料库上下文文本
}

// DeepSeek 配置（存于 setting store）
export interface DeepSeekConfig {
  apiKey: string
  model: 'deepseek-chat' | 'deepseek-reasoner'
  maxTokens: number
}
