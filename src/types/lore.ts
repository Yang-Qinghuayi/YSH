/**
 * lore.ts
 * Lore 资料库相关类型定义
 * 参考 Nova 项目设计，结构化管理小说的角色/世界观/地点等创作资料
 */

/** 条目重要度 */
export type EntryImportance =
  | 'major'      // 主要 → AI 生成时全文注入 system prompt
  | 'important'  // 重要 → 注入索引（名称 + 简介）
  | 'minor'      // 次要 → 注入索引（名称 + 简介）

/** 条目元数据（全部存于 lore.json） */
export interface EntryMeta {
  id: string               // 格式：entry-{timestamp}
  filename: string         // 格式：entry-{timestamp}.md，对应 entries/ 目录下的文件
  name: string             // 条目名称
  importance: EntryImportance
  briefDescription: string // 3-5 句轻量索引简介，供 AI 快速参考
  keywords: string[]       // 别名/触发词，如 ["小川", "林少侠"]
  enabled: boolean         // false = 隐藏但保留（不进入 AI 上下文）
  order: number            // 排列顺序
}

/** 资料库元数据（绑定到小说，一部小说一个 Lore） */
export interface Lore {
  id: string           // = novelId，每个小说对应一个资料库
  novelTitle: string   // 冗余存储所属小说标题，方便显示
  updatedAt: number    // 最后更新时间戳
  entries: EntryMeta[] // 全部条目元数据列表
}

/** 条目重要度的中文标签映射 */
export const ENTRY_IMPORTANCE_LABELS: Record<EntryImportance, string> = {
  major: '主要',
  important: '重要',
  minor: '次要',
}

/** 重要度对应颜色 */
export const ENTRY_IMPORTANCE_COLORS: Record<EntryImportance, string> = {
  major: 'error',
  important: 'warning',
  minor: 'default',
}
