/**
 * useAgentChatController.ts
 * Agent 交互面板的编排层：会话生命周期、引擎回调 → chatStore 转录、写章同步、持久化。
 * 不包含布局与 DOM 结构；UI 组件只发事件、只读 chatStore。
 */

import { storeToRefs } from 'pinia';
import { ref } from 'vue';

import {
  abortChatSession,
  type AgentPlan,
  type AgentSession,
  buildContinueCurrentTask,
  buildContinuePrevTask,
  buildVirtualWrite,
  type ChatQuickAction,
  type ChatTurnCallbacks,
  type ChatWriteData,
  createChatSession,
  deleteChatSessionFile,
  loadChatSessionFile,
  parseMentions,
  PLAN_BLOCK_PATTERN,
  restoreSessionMessages,
  runChatGenerateTurn,
  runChatTurn,
  saveChatSessionFile,
} from '@/services/agent';
import { saveChapterContent } from '@/services/novelService';
import { loadStoryState } from '@/services/storyStateService';
import { useAgentChatStore } from '@/store/agentChatStore';
import { useNovelStore } from '@/store/novelStore';
import { useNovelUiStore } from '@/store/novelUiStore';
import { useSettingStore } from '@/store/setting';

import type { AgentChatControllerDeps } from './types';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 每轮 turn 的 UI 关联状态（助手气泡 / 写章预览卡 / 工具卡队列） */
interface TurnUiState {
  assistantId: string | null;
  previewCardId: string | null;
  pendingCards: string[];
  wrote: boolean;
}

function createTurnUi(): TurnUiState {
  return { assistantId: null, previewCardId: null, pendingCards: [], wrote: false };
}

export function useAgentChatController(deps: AgentChatControllerDeps) {
  const novelStore = useNovelStore();
  const chatStore = useAgentChatStore();
  const settingStore = useSettingStore();
  const novelUiStore = useNovelUiStore();
  const { currentNovel, currentChapter, currentChapterContent, isGenerating } =
    storeToRefs(novelStore);

  const chatSession = ref<AgentSession | null>(null);

  function liveChapterContent(): string {
    return currentChapterContent.value;
  }

  function ensureChatSession(): AgentSession | null {
    const novel = currentNovel.value;
    const chapter = currentChapter.value;
    if (!novel || !chapter) return null;
    if (chatSession.value && chatSession.value.chapterId === chapter.id) {
      // 定稿等操作可能替换 novel 对象，让会话继续使用最新元数据
      chatSession.value.novel = novel;
      return chatSession.value;
    }
    chatSession.value = createChatSession({
      novel,
      chapter,
      chapterContent: currentChapterContent.value,
      liveContent: liveChapterContent,
    });
    return chatSession.value;
  }

  async function loadChatSessionForChapter() {
    const chapter = currentChapter.value;
    chatStore.resetForChapter(chapter?.id ?? null);
    chatSession.value = null;
    if (!chapter) return;
    const session = ensureChatSession();
    if (!session) return;
    try {
      const file = await loadChatSessionFile(chapter.id);
      if (currentChapter.value?.id !== chapter.id) return;
      if (file) {
        chatStore.transcript = file.transcript;
        restoreSessionMessages(session, file.llmMessages);
        const pending = chatStore.getPendingPlan();
        if (pending && file.phase === 'awaiting_confirmation') {
          session.plan = { ...pending.plan, outline: pending.outlineDraft };
        }
      }
    } catch {
      // 恢复失败就当新对话
    }
  }

  function persistChatSession() {
    const session = chatSession.value;
    const chapter = currentChapter.value;
    if (!session || !chapter) return;
    void saveChatSessionFile(
      chapter.id,
      chapter.title,
      session.messages,
      chatStore.transcript,
      session.phase === 'done' || session.phase === 'canceled' ? 'idle' : session.phase
    );
  }

  async function refreshStoryState() {
    const novelId = currentNovel.value?.id;
    if (!novelId) return;
    try {
      novelUiStore.setStoryState(await loadStoryState(novelId));
    } catch {
      // 缓存刷新失败不影响主流程
    }
  }

  function commitChatWrite(write: ChatWriteData) {
    const chapter = currentChapter.value;
    const session = chatSession.value;
    if (!chapter) return;
    if (chapter.id !== write.chapterId) {
      chatStore.pushSystem(
        `已写入《${write.chapterTitle}》 ${write.addedChars} 字（切换到该章节查看）`
      );
      return;
    }
    novelStore.updateContent(write.newContent);
    deps.getEditor()?.replaceContent(write.newContent);
    if (session) session.chapterContent = write.newContent;
  }

  function makeChatCallbacks(turnUi: TurnUiState): ChatTurnCallbacks {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (turnUi.assistantId) chatStore.endAssistant(turnUi.assistantId);
      chatStore.setBusy(false);
      chatStore.setStatus('');
      chatStore.setPhase('idle');
      novelStore.stopGenerating();
      void refreshStoryState();
      persistChatSession();
    };

    return {
      onPhase: (phase) => {
        chatStore.setPhase(phase);
        if (phase === 'planning' || phase === 'generating') {
          if (!isGenerating.value) novelStore.startGenerating();
        }
        if (phase === 'canceled') {
          chatStore.pushSystem('已停止');
          finish();
        }
      },
      onStatus: (status) => chatStore.setStatus(status),
      onTextDelta: (delta) => {
        if (!turnUi.assistantId) turnUi.assistantId = chatStore.beginAssistant();
        chatStore.appendAssistant(turnUi.assistantId, delta);
      },
      onToolStart: (tool, argsSummary) => {
        if ((tool === 'append_to_chapter' || tool === 'replace_tail') && turnUi.previewCardId) {
          chatStore.updateTool(turnUi.previewCardId, { argsSummary });
          turnUi.pendingCards.push(turnUi.previewCardId);
          turnUi.previewCardId = null;
          return;
        }
        turnUi.pendingCards.push(chatStore.pushTool(tool, argsSummary));
      },
      onWritePreview: (tool, partial) => {
        if (!turnUi.previewCardId) {
          turnUi.previewCardId = chatStore.pushTool(tool, '正在写入正文…');
        }
        chatStore.setToolPreview(turnUi.previewCardId, partial);
        chatStore.setStatus(`正在写入正文… ${partial.length} 字`);
      },
      onToolEnd: (tool, ok, resultText, write) => {
        const id = turnUi.pendingCards.shift() ?? null;
        if (id) {
          chatStore.updateTool(id, {
            status: ok ? 'done' : 'error',
            resultText,
            write,
          });
        }
        if (write) {
          turnUi.wrote = true;
          commitChatWrite(write);
        }
      },
      onVirtualWrite: (content) => {
        const session = chatSession.value;
        if (!session) return;
        const write = buildVirtualWrite(session, content);
        void saveChapterContent(session.chapter.filename, write.newContent).catch((e) =>
          deps.notify.error('写入章节失败：' + errorText(e))
        );
        const id = chatStore.pushTool(
          'append_to_chapter',
          `写入 ${write.addedChars} 字（无工具模式）`
        );
        chatStore.updateTool(id, {
          status: 'done',
          resultText: `已把 ${write.addedChars} 字正文追加到章节末尾。`,
          write,
        });
        turnUi.wrote = true;
        commitChatWrite(write);
      },
      onPlanReady: (plan) => {
        if (turnUi.assistantId) {
          const message = chatStore.transcript.find((x) => x.id === turnUi.assistantId);
          if (message && message.kind === 'assistant') {
            message.text = message.text.replace(PLAN_BLOCK_PATTERN, '').trim();
          }
        }
        chatStore.pushPlan(plan);
        chatStore.setStatus('等待确认规划');
      },
      onContextTrimmed: (info) => {
        chatStore.setContextUsage(info.estimatedTokens, info.trimmed);
        deps.notify.warn(
          `上下文接近上限，已省略 ${info.trimmed} 条早期调研结果（约 ${info.estimatedTokens} tokens）。`
        );
      },
      onWarn: (message) => deps.notify.warn(message),
      onError: (e) => {
        deps.notify.error(errorText(e));
        finish();
      },
      onDone: () => {
        if (turnUi.wrote) {
          chatStore.pushSystem(
            '正文已写入。本章写完后，点顶部「本章定稿」更新章节概要、角色记忆与整体进度。'
          );
        }
        finish();
      },
    };
  }

  function requireApiKey(): boolean {
    if (!deps.apiKey.value) {
      deps.notify.error('请先在「设置」中填写 DeepSeek API Key');
      return false;
    }
    return true;
  }

  async function handleChatSend(text: string) {
    const novel = currentNovel.value;
    const chapter = currentChapter.value;
    if (!novel || !chapter) return;
    if (chatStore.busy || isGenerating.value || !requireApiKey()) return;
    const session = ensureChatSession();
    if (!session) return;
    session.forcedMentions = parseMentions(text, novel);

    chatStore.pushUser(text);
    chatStore.setBusy(true);
    await runChatTurn(
      session,
      { visibleText: text, forcePlan: chatStore.getPendingPlan() !== null },
      deps.buildAgentConfig(),
      makeChatCallbacks(createTurnUi())
    );
  }

  async function handleChatQuickAction(action: ChatQuickAction) {
    const novel = currentNovel.value;
    const chapter = currentChapter.value;
    if (!novel || !chapter) return;
    if (chatStore.busy || isGenerating.value || !requireApiKey()) return;

    let task: { visible: string; llm: string } | null;
    try {
      task =
        action === 'continue-prev'
          ? await buildContinuePrevTask(novel, chapter, settingStore.agentWriteLength)
          : buildContinueCurrentTask(
              novel,
              chapter,
              currentChapterContent.value,
              settingStore.agentWriteLength,
              await loadStoryState(novel.id).catch(() => novelUiStore.storyState)
            );
    } catch (e) {
      deps.notify.error(errorText(e));
      return;
    }
    if (!task) {
      deps.notify.error('没有上一章，无法「续写上一章」');
      return;
    }

    const session = ensureChatSession();
    if (!session) return;
    chatStore.pushUser(task.visible);
    chatStore.setBusy(true);
    await runChatTurn(
      session,
      { visibleText: task.visible, llmText: task.llm, forcePlan: true },
      deps.buildAgentConfig(),
      makeChatCallbacks(createTurnUi())
    );
  }

  function stopChat() {
    if (chatSession.value && chatStore.busy) {
      chatStore.pushSystem('正在停止…');
      abortChatSession(chatSession.value);
    }
  }

  async function handleChatConfirmPlan(plan: AgentPlan) {
    const session = chatSession.value;
    if (!session) return;
    if (chatStore.busy || isGenerating.value || !requireApiKey()) return;
    const pending = chatStore.getPendingPlan();
    if (pending) chatStore.updatePlan(pending.id, { status: 'confirmed' });
    session.plan = plan;
    chatStore.setBusy(true);
    await runChatGenerateTurn(session, deps.buildAgentConfig(), makeChatCallbacks(createTurnUi()));
  }

  function handleChatCancelPlan() {
    const pending = chatStore.getPendingPlan();
    if (pending) {
      chatStore.updatePlan(pending.id, { status: 'cancelled' });
      chatStore.pushSystem('规划已取消，可继续调整或让 Agent 重新规划');
    }
    persistChatSession();
  }

  function handleChatUndoWrite(msgId: string) {
    const message = chatStore.transcript.find((m) => m.id === msgId);
    const session = chatSession.value;
    if (!message || message.kind !== 'tool' || !message.write?.snapshot) return;
    if (chatStore.busy) return;
    const snapshot = message.write.snapshot;
    novelStore.updateContent(snapshot);
    deps.getEditor()?.replaceContent(snapshot);
    if (session) session.chapterContent = snapshot;
    message.write = { ...message.write, snapshot: undefined };
    chatStore.pushSystem('已恢复该次写入前的章节内容');
    persistChatSession();
  }

  async function handleChatClear() {
    const chapter = currentChapter.value;
    chatStore.clear();
    chatSession.value = null;
    if (chapter) await deleteChatSessionFile(chapter.id);
  }

  function resetForNovelSwitch() {
    if (chatStore.busy && chatSession.value) abortChatSession(chatSession.value);
    chatStore.resetForChapter(null);
    chatSession.value = null;
  }

  function abortOnUnmount() {
    if (chatStore.busy && chatSession.value) abortChatSession(chatSession.value);
  }

  return {
    chatStore,
    chatSession,
    loadChatSessionForChapter,
    persistChatSession,
    refreshStoryState,
    handleChatSend,
    handleChatQuickAction,
    handleChatConfirmPlan,
    handleChatCancelPlan,
    handleChatUndoWrite,
    handleChatClear,
    stopChat,
    resetForNovelSwitch,
    abortOnUnmount,
  };
}
