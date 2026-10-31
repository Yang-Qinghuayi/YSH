# Agent 模块重构说明（2026-10-27）

本次重构针对「Agent 整个页面」以及支撑它的服务层，目标是：

1. 删除确认无生产消费者的旧模块 / 状态。
2. 把 1900+ 行的 `pages/novel/index.vue` 和 1000+ 行的 `AgentChatPanel.vue` 拆成职责单一的模块。
3. 让页面层只依赖一个 Agent 公共入口，服务层按 `chat / runtime / tools / prompts / protocol / finalize` 分目录。
4. 保持现有功能与 UI 行为不变：聊天、规划确认、写章、撤销、定稿、故事状态/角色面板、导入、搜索、保存等。

详细的目录职责见：

- [`src/pages/novel/README.md`](../src/pages/novel/README.md)
- [`src/services/agent/README.md`](../src/services/agent/README.md)

---

## 一、删除了什么，为什么安全

| 删除对象             | 原位置                                                                                                                                                                     | 判断依据                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 旧整章生成流水线     | `src/services/agentService.ts`                                                                                                                                             | `runPlanPhase` / `runGeneratePhase` 只被 `tests/agentService.e2e.test.ts` 直接调用，现行 UI 已全部走交互面板 `chat/engine.ts`。旧测试随流水线一起删除。                                        |
| 旧 Agent 状态 store  | `src/store/agentStore.ts`                                                                                                                                                  | `phase / currentPlan / planDialogVisible / statusText / toolCallLog` 等字段无消费者；仍被使用的 `storyState / characterPanelOpen / selectedCharacterName` 迁移到 `src/store/novelUiStore.ts`。 |
| 旧 DeepSeek 单体服务 | `src/services/deepseekService.ts`                                                                                                                                          | 拆成 `agent/llm.ts`（网络边界）、`agent/text.ts`（文本处理）、`agent/prompts/*`（prompt 构建）。旧 `buildAgentSystemPrompt` 只服务已删除的旧流水线。                                           |
| 旧 Agent 单体服务    | `src/services/agentChat.ts` / `agentTools.ts` / `chapterFinalize.ts` / `agentProtocol.ts` / `contextBudget.ts`                                                             | 文件本身仍需要，但迁到 `src/services/agent/` 下并按职责拆分；根目录同名文件不再保留。                                                                                                          |
| 未使用的导出 / 参数  | `AgentPhase`、`StreamEvent` 外部暴露、`MemoryBlock`、`stableStringify`、`CONTENT_BLOCK_PATTERN`、`CHAT_WRITE_TOOLS`、`buildGenerateInstruction`、`CONTINUE_INSTRUCTION` 等 | 全仓库 import 与模板扫描后确认无消费者；内部需要的保留为私有实现。                                                                                                                             |
| 页面内死变量         | `isTauri`、`chapterListRef`                                                                                                                                                | 模板与脚本均无实际使用。                                                                                                                                                                       |

保留但缩小职责的模块：

- `src/store/chatStore.ts` → `src/store/agentChatStore.ts`：只管理交互面板的 UI 转录状态。
- `src/types/agentChat.ts`：只描述 UI 消息与会话文件；领域类型统一放到 `src/types/agent.ts`。
- `tests/agentService.e2e.test.ts` 删除后，新增 `tests/agentModules.test.ts` 覆盖新模块的 8 个边界。
  合并 `ysh` 新增的阅读器用例后，仓库测试总数为 92。

---

## 二、页面层拆分结果

重构前：

```text
src/pages/novel/index.vue                    1920 行（布局 + 工作区 + 章节 + 聊天 + 定稿 + 弹窗 + 设置）
src/pages/novel/components/AgentChatPanel.vue 1019 行（头部 + 转录 + 工具卡 + plan 卡 + 输入 + 样式）
```

重构后：

```text
src/pages/novel/index.vue                      ~34 行（只做布局）
src/pages/novel/components/
  NovelEditorStage.vue          # 顶部概览栏 + 空状态 + 编辑器
  NovelSidebar.vue              # 侧栏 rail / tabs 切换
  NovelSidebarDirectory.vue     # 目录卡片（小说/章节/角色/设定）
  NovelDialogs.vue              # 所有弹窗挂载点
  EditorSettingsDialog.vue      # 编辑器 / API Key / 模型设置
  AgentChatPanel.vue            # Agent 面板容器（~100 行）
  agent/                        # 头部、上下文计量、转录、工具卡、规划卡、快捷动作、输入区
src/pages/novel/composables/
  useNovelPageController.ts     # 组装根，provide 各模块的 context
  useNovelUiState.ts            # 侧栏 / 弹窗 / snackbar / 设置
  useNovelWorkspace.ts          # 工作区初始化、切换/导入小说、Lore 缓存
  useChapterEditing.ts          # 章节 CRUD、自动保存、字数、搜索跳转
  useCharacterMemory.ts         # 角色管理、短期记忆、长期记忆回滚
  useAgentChatController.ts     # Agent 会话、引擎回调、写章同步、持久化
  useChapterFinalization.ts     # 本章定稿的页面编排
```

模块之间通过 `composables/context.ts` 中的窄 `InjectionKey` 注入，避免把整个页面对象透传给子组件；组合根 `useNovelPageController.ts` 负责延迟绑定互相依赖的回调。

---

## 三、服务层拆分结果

页面统一从 `src/services/agent/index.ts` 取 API，内部模块如下：

```text
src/services/agent/
  index.ts                     # 页面唯一公共入口
  llm.ts                       # DeepSeek / OpenAI 兼容流式调用
  text.ts                      # @提及解析、光标前上下文切片
  session.ts                   # 会话创建、取消、前情提要
  runtime.ts                   # 单次模型调用、工具回填、上下文预算
  contextBudget.ts             # 纯函数：上下文裁剪
  protocol.ts                  # PLAN / MEMORY / CONTENT 协议、写章文本变换、循环守卫
  prompts/chat.ts              # 交互面板 system prompt 与生成指令
  prompts/finalize.ts          # 定稿四步 prompt
  chat/session.ts              # 交互面板会话创建 / 消息恢复
  chat/engine.ts               # 多轮对话、工具循环、PLAN 闸门、确认后写章
  chat/quickActions.ts         # 续写上一章 / 续写本章任务文案
  chat/sessionFile.ts          # <小说>/agent-chat/<chapterId>.json 读写
  chat/transcript.ts           # 转录持久化前裁剪
  chat/write.ts                # CONTENT 块 → 虚拟写章数据
  tools/readonly.ts            # 只读调研工具
  tools/memory.ts              # 短期 / 长期记忆改写工具
  tools/writing.ts             # 追加正文 / 重写结尾工具
  tools/registry.ts            # 按场景组合工具并输出 OpenAI schema
  finalize.ts                  # 本章定稿四步流水线
```

另有 `src/types/agent.ts` 作为领域共享类型层，不依赖任何 service / store / Vue；`src/types/agentChat.ts` 只描述 UI 转录消息。

---

## 四、行为等价性要点

- 交互面板仍然是「用户消息 → 工具循环 → PLAN 等待确认 → 写章工具落盘 → 正文同步编辑器」。
- `deepseek-reasoner` 仍走无工具降级：`CONTENT` 虚拟写章、`MEMORY` 定稿协议。
- 定稿仍为独立轻量会话，不依赖聊天记录；重新定稿仍先恢复本章之前的记忆快照。
- 会话文件仍保存在 `agent-chat/<chapterId>.json`；`prepareTranscriptForPersist` 的裁剪规则未变。
- 工具写章仍调用 `saveChapterContent`；本次把工具返回的 `previousContent` 统一成 `ChatWriteData.snapshot` 契约，使撤销按钮按设计可用。
- 自动保存、章节搜索跳转、角色面板、故事状态回滚、导入、设置等入口未改变。

---

## 五、与 `ysh` 主干的合并

本重构最初基于 `ae51962`。合并 `ysh`（13 个新提交）时按「保留拆分结构 + 移植主干语义改动」处理，
主干那批提交里夹了一次全仓格式化，因此以下列真实语义改动为准：

| 主干改动                                                                                     | 在重构后的落点                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 移除 `openai` SDK，改 `fetch` + SSE（新增 `src/types/llm.ts`）                               | `agent/llm.ts` 重写为 `createLlmClient` + `readSseData` + `withTimeout`；其余模块的类型改从 `@/types/llm` 导入                                                                                               |
| 测试网络边界从 `openai` 桩改为 `fetch` 桩（`tests/stubs/fetch.mjs`）                         | `agentChat` / `chapterFinalize` e2e 改用 `installFetchStub()`；`tests/stubs/openai.mjs` 删除                                                                                                                 |
| Vuetify 4 工具类迁移（`flex-1`→`flex-1-1`、`gap-N`→`ga-N`、`text-h6`→`text-title-large` 等） | 拆分出的组件同步改名；工具类后续已整体切回 Tailwind v4（`d-flex`→`flex`、`ga-2`→`gap-2`、`text-title-large`→`text-2xl`），`scripts/gen-vuetify-utilities.mjs` 与 `src/styles/vuetify-utilities.css` 随之删除 |
| `chapterFinalize` 未使用赋值清理                                                             | `agent/finalize.ts` 同步                                                                                                                                                                                     |
| 加载器新增「裸包无扩展名相对路径」解析                                                       | `tests/stubs/loader.mjs` 与本次的「源码省略扩展名」解析合并成一个函数                                                                                                                                        |

---

## 六、验证结果

- `corepack pnpm build`：通过（仅有原有的 chunk size 警告）。
- `npm test`：**92 / 92 通过**（含主干新增的阅读器用例）。
- `npx vue-tsc --noEmit`（主干的 CI 门禁，不再 `--skipLibCheck`）：**0 错误**。
  主干已修掉重构前那 13 个既有类型错误，本次合并后未回退。
- `npx eslint`：通过（0 error / 0 warning）。
- `npx prettier --check`：通过，与主干 CI 的检查范围一致。
