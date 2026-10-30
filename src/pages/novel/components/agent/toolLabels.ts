/**
 * toolLabels.ts
 * Agent 工具卡的名称展示映射。纯 UI 常量，不含业务逻辑。
 */

import { FINALIZE_STEP_LABELS, type FinalizeStep } from '@/services/agent';

const TOOL_LABELS: Record<string, string> = {
  query_lore: '查询设定',
  search_chapters: '检索章节',
  read_story_state: '读取故事状态',
  read_context: '读取前文',
  select_characters: '选择出场角色',
  update_short_term_memory: '改写短期记忆',
  update_long_term_memory: '改写长期记忆',
  append_to_chapter: '写入正文',
  replace_tail: '重写结尾',
};

export function toolLabel(tool: string): string {
  if (tool.startsWith('finalize:')) {
    const step = tool.slice('finalize:'.length) as FinalizeStep;
    return `定稿 · ${FINALIZE_STEP_LABELS[step] ?? step}`;
  }
  return TOOL_LABELS[tool] ?? tool;
}
