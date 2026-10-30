# 小说 / Agent 页面模块地图

`index.vue` 只负责三件事：工作区初始化、布局拼装、全局 snackbar。业务状态与副作用全部在 `composables/` 中按领域拆分。

## 布局组件

| 组件                          | 一句话职责                                         |
| ----------------------------- | -------------------------------------------------- |
| `NovelEditorStage.vue`        | 顶部概览栏、空状态、CodeMirror 编辑器              |
| `NovelSidebar.vue`            | 侧栏折叠/目录/Agent 标签切换                       |
| `NovelSidebarDirectory.vue`   | 当前小说、章节、角色、设定目录卡片                 |
| `NovelDialogs.vue`            | 所有弹窗的挂载与事件转发                           |
| `EditorSettingsDialog.vue`    | 字号、API Key、模型设置                            |
| `AgentChatPanel.vue`          | Agent 面板容器：组合以下展示组件                   |
| `agent/AgentHeader.vue`       | 标题、目标章节、定稿/清空按钮                      |
| `agent/AgentContextMeter.vue` | 上下文预算进度条                                   |
| `agent/AgentEmptyState.vue`   | 空会话引导                                         |
| `agent/ChatTranscript.vue`    | 消息列表与自动吸底滚动                             |
| `agent/ChatToolCard.vue`      | 工具调用卡、写章预览、撤销                         |
| `agent/ChatPlanCard.vue`      | 可编辑规划卡与确认/取消                            |
| `agent/AgentQuickActions.vue` | 目标字数与续写快捷动作                             |
| `agent/ChatComposer.vue`      | 输入框、@提及补全、发送/停止                       |
| `agent/toolLabels.ts`         | 工具名 → 中文展示名                                |
| `agent/useChatAutoScroll.ts`  | 转录区吸底滚动逻辑                                 |
| `agent/agent-chat.css`        | Agent 面板样式，选择器统一限定在 `.agent-panel` 下 |
| `novel-page.css`              | 页面级共享样式（含 Vuetify overlay 弹窗）          |

## 编排 composables

| 模块                        | 一句话职责                                        |
| --------------------------- | ------------------------------------------------- |
| `useNovelPageController.ts` | 组装根：创建控制器、provide context、统一停止动作 |
| `useNovelUiState.ts`        | 侧栏、弹窗、snackbar、API Key、Agent 配置         |
| `useNovelWorkspace.ts`      | 工作区初始化、切换/导入小说、Lore 缓存            |
| `useChapterEditing.ts`      | 章节 CRUD、自动保存、字数统计、搜索跳转           |
| `useCharacterMemory.ts`     | 角色管理、短期记忆编辑、长期记忆回滚              |
| `useAgentChatController.ts` | Agent 会话、引擎回调、写章同步、会话持久化        |
| `useChapterFinalization.ts` | 本章定稿流水线页面编排                            |
| `context.ts`                | 6 个窄 `InjectionKey`，让布局组件按需 inject      |
| `types.ts`                  | 模块间共享的回调与 DOM 句柄窄接口                 |

## 依赖关系

```text
index.vue
  → useNovelPageController
      ├─ useNovelUiState
      ├─ useNovelWorkspace ──────┐
      ├─ useChapterEditing ─────┤ 通过回调交互
      ├─ useCharacterMemory ────┤
      ├─ useAgentChatController ┤
      └─ useChapterFinalization ┘
  → NovelEditorStage / NovelSidebar / NovelDialogs
      └─ 按需 inject 对应 context
```

页面不直接依赖 `src/services/agent` 的内部文件；所有 Agent API 都从 `@/services/agent` barrel 进入。
