// 小说中的角色
// 一个人物只由两样东西记录：
//   1. 长期记忆（本接口的 skill）——性格/出身/外貌/信念/说话方式/别名/参考形象……
//      由作者填写；发生重大事件后，章节定稿时 Agent 可改写（改写记录可回滚，见 StoryState.longTermLog）
//   2. 短期记忆——角色视角（POV）下最近经历了什么、知道什么、误以为什么，
//      每章定稿后改写一次，存 story-state.json（见 types/storyState.ts）
export interface Character {
  id: string;
  name: string; // @提及键，如 @李明
  skill?: string; // 长期记忆（Skill）：自然语言叙事
}

// 章节元数据（存于 novel.json 中）
export interface ChapterMeta {
  id: string;
  filename: string; // 如 "001_第一章.md"，对应 chapters/ 目录下的文件
  title: string;
  summary?: string; // 章节概要（定稿时生成，可手动编辑），给后续章节提供上下文
  finalizedAt?: number; // 最近一次「本章定稿」的时间
  order: number; // 排列顺序
  wordCount?: number; // 字数（不含 Markdown 格式符和空白）
}

// 全局搜索结果
export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  chapterFilename: string;
  lineIndex: number; // 0-indexed
  lineContent: string; // 该行原始文本
  matchStart: number; // 匹配位置（在 lineContent 中的偏移）
  matchEnd: number;
}

// 小说元数据（存于 novel.json）
export interface Novel {
  id: string;
  title: string;
  synopsis: string; // 故事简介，作为 AI 全局上下文
  createdAt: number;
  updatedAt: number;
  characters: Character[];
  chapters: ChapterMeta[];
}

// @ 提及解析结果
// 仅支持 @角色名（强制该角色进入本次写作）。
export interface Mention {
  type: 'character';
  raw: string; // 原始文本，如 "@李明"
  characterName?: string;
  character?: Character;
}
