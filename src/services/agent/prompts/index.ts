/** prompts/index.ts — 按用途汇总 prompt 构建器，避免调用方关心文件位置。 */

export {
  buildChatContinuationInstruction,
  buildChatGenerateInstruction,
  buildChatSystemPrompt,
} from './chat';
export {
  buildChapterSummaryInstruction,
  buildFinalizeSystemPrompt,
  buildLongTermInstruction,
  buildMainlineInstruction,
  buildShortTermInstruction,
} from './finalize';
