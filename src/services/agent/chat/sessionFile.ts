/**
 * chat/sessionFile.ts
 * 交互面板会话文件 IO：<小说文件夹>/agent-chat/<chapterId>.json。
 * 所有失败都降级为内存会话可用，不阻断写作主流程。
 */

import { useAppService } from '@/hooks/useEnv';
import { getDataBase } from '@/services/workspaceService';
import type { SessionPhase } from '@/types/agent';
import type { ChatMsg, ChatSessionFile } from '@/types/agentChat';

import { prepareTranscriptForPersist } from './transcript';

function chatFileRelPath(chapterId: string): string {
  return `agent-chat/${chapterId}.json`;
}

export async function loadChatSessionFile(chapterId: string): Promise<ChatSessionFile | null> {
  try {
    const appService = await useAppService();
    const { base, pathPrefix: P } = getDataBase();
    const path = P + chatFileRelPath(chapterId);
    const exists = await appService.fs.exists(path, base).catch(() => false);
    if (!exists) return null;
    const raw = await appService.fs.readFile(path, base, 'text').catch(() => null);
    if (!raw || typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw) as ChatSessionFile;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.transcript) ||
      !Array.isArray(parsed.llmMessages)
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveChatSessionFile(
  chapterId: string,
  chapterTitle: string,
  llmMessages: unknown[],
  transcript: ChatMsg[],
  phase: SessionPhase
): Promise<void> {
  try {
    const appService = await useAppService();
    const { base, pathPrefix: P } = getDataBase();
    await appService.fs.createDir(P + 'agent-chat', base, true).catch(() => {});
    const file: ChatSessionFile = {
      version: 1,
      chapterId,
      chapterTitle,
      updatedAt: Date.now(),
      transcript: prepareTranscriptForPersist(transcript),
      llmMessages: llmMessages as ChatSessionFile['llmMessages'],
      phase,
    };
    await appService.fs.writeFile(
      P + chatFileRelPath(chapterId),
      base,
      JSON.stringify(file, null, 2)
    );
  } catch {
    // 持久化失败不阻断交互（内存会话仍可用）
  }
}

export async function deleteChatSessionFile(chapterId: string): Promise<void> {
  try {
    const appService = await useAppService();
    const { base, pathPrefix: P } = getDataBase();
    await appService.fs.removeFile(P + chatFileRelPath(chapterId), base).catch(() => {});
  } catch {
    // ignore
  }
}
