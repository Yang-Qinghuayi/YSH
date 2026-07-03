/**
 * @deprecated 旧版角色的"技能"结构，仅用于数据迁移。新代码请使用 Character.profile。
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
//   1. 静态档案（本接口）——角色描述/别名/文学形象参考，不变的"是谁"，走 skill 激活机制
//   2. 动态状态——经历/心情/想法/位置/伤势/关系，随情节变，叠在 StoryState 上（见 types/storyState.ts）
// 状态不进档案、档案不进状态。
export interface Character {
  id: string
  name: string // @提及键，如 @李明
  // —— 静态档案：不变的"是谁" ——
  profile?: string // 角色描述（自然语言叙事，综合性格/出身/外貌/爱好）
  aliases?: string[] // 别名/触发词
  literaryReference?: string // 文学形象参考（如 杨过、李寻欢），仅参考气质风骨，不涉及历史背景
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
  chapters: ChapterMeta[]
}

// @ 提及解析结果
// 角色档案合并后，仅支持 @角色名（激活该角色档案含文风）。
export interface Mention {
  type: 'character'
  raw: string // 原始文本，如 "@李明"
  characterName?: string
  character?: Character
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
