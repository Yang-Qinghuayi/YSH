/**
 * chat/transcript.ts
 * UI 转录的持久化前裁剪：限制工具详情长度，只保留最近 3 条写章快照。
 */

import type { ChatMsg } from '@/types/agentChat';

/** 转录持久化前裁剪：工具细节限量 + 仅最近 3 条写章卡保留撤销快照 */
export function prepareTranscriptForPersist(transcript: ChatMsg[]): ChatMsg[] {
  type ToolMsg = Extract<ChatMsg, { kind: 'tool' }>;
  const writeMsgs = transcript.filter((m): m is ToolMsg => m.kind === 'tool' && !!m.write);
  const keepSnapshot = new Set(writeMsgs.slice(-3).map((m) => m.id));

  return transcript.map((m) => {
    if (m.kind !== 'tool') return m;
    const copy: ToolMsg = { ...m };
    if (copy.resultText && copy.resultText.length > 2000)
      copy.resultText = `${copy.resultText.slice(0, 2000)}…`;
    if (copy.preview && copy.preview.length > 6000)
      copy.preview = `${copy.preview.slice(0, 6000)}…`;
    if (copy.write && !keepSnapshot.has(m.id)) copy.write = { ...copy.write, snapshot: undefined };
    if (copy.write?.snapshot && copy.write.snapshot.length > 20000) {
      copy.write = {
        ...copy.write,
        snapshot: copy.write.snapshot.slice(-20000),
      };
    }
    return copy;
  });
}
