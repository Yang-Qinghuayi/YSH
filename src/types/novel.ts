// 角色的单个技能
export interface CharacterSkill {
  id: string
  name: string   // 用于 @角色名.技能名 中的技能名
  prompt: string // 告诉 AI 如何运用这个技能写作（如：李明的剑法描写风格：凌厉、短句、动词密集）
}

// 小说中的角色
export interface Character {
  id: string
  name: string    // 用于 @提及，如 @李明
  profile: string // 人物基本描述，作为 AI 背景信息
  skills: CharacterSkill[]
}

// 剧情技能（写作模板）
export interface PlotSkill {
  id: string
  name: string   // 用于 @提及，如 @矛盾激化
  prompt: string // 告诉 AI 这个剧情模板的写作指导
}

// 章节元数据（存于 novel.json 中）
export interface ChapterMeta {
  id: string
  filename: string  // 如 "001_第一章.md"，对应 chapters/ 目录下的文件
  title: string
  summary?: string  // 可选章节摘要，给后续章节提供上下文
  order: number     // 排列顺序
}

// 小说元数据（存于 novel.json）
export interface Novel {
  id: string
  title: string
  synopsis: string   // 故事简介，作为 AI 全局上下文
  createdAt: number
  updatedAt: number
  characters: Character[]
  plotSkills: PlotSkill[]
  chapters: ChapterMeta[]
}

// @ 提及解析结果
export interface Mention {
  type: 'character-skill' | 'plot-skill'
  raw: string           // 原始文本，如 "@李明.剑法"
  characterName?: string
  skillName?: string
  skill?: CharacterSkill | PlotSkill
  character?: Character
}

// AI 生成请求参数
export interface AIGenerateParams {
  novel: Novel
  chapter: ChapterMeta
  chapterContent: string   // 当前章节完整内容
  cursorPosition: number   // 光标位置（字符偏移量）
  mentions: Mention[]      // 当前块中的 @提及
}

// DeepSeek 配置（存于 setting store）
export interface DeepSeekConfig {
  apiKey: string
  model: 'deepseek-chat' | 'deepseek-reasoner'
  maxTokens: number
}
