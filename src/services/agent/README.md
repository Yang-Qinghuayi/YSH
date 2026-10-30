# Agent 服务层模块地图

页面只从 `index.ts` 导入公共 API；内部文件可以独立理解和测试。

| 模块                   | 一句话职责                                                 | 主要依赖                                     |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `index.ts`             | 页面唯一公共入口，汇总类型与函数                           | 各内部模块                                   |
| `llm.ts`               | 创建 DeepSeek client，执行一次流式 tool-use 请求并聚合事件 | `openai`                                     |
| `text.ts`              | 解析 `@角色名`、截取光标前上下文（纯函数）                 | `types/novel`                                |
| `session.ts`           | 创建/取消会话、生成前情提要                                | `types/agent`                                |
| `runtime.ts`           | 单次模型调用、工具结果回填、上下文预算调用                 | `llm`, `contextBudget`, `tools/registry`     |
| `contextBudget.ts`     | 纯函数：按工具调用配对裁剪超预算上下文                     | OpenAI 消息类型                              |
| `protocol.ts`          | PLAN/MEMORY/CONTENT 协议解析、写章文本变换、循环守卫       | 纯函数                                       |
| `prompts/chat.ts`      | 交互面板 system prompt 与生成/续写指令                     | `storyMemory`                                |
| `prompts/finalize.ts`  | 定稿四步 prompt                                            | `storyMemory`                                |
| `chat/session.ts`      | 交互面板会话创建、中断、消息历史恢复                       | `session`                                    |
| `chat/engine.ts`       | 多轮对话、工具循环、PLAN 闸门、确认后写章                  | `runtime`, `prompts`, `protocol`, `tools`    |
| `chat/quickActions.ts` | 构造「续写上一章 / 续写本章」隐藏上下文                    | `novelService`, `storyMemory`, `text`        |
| `chat/sessionFile.ts`  | 读写 `agent-chat/<chapterId>.json`                         | `useEnv`, `workspaceService`                 |
| `chat/transcript.ts`   | 持久化前裁剪工具详情与撤销快照                             | `types/agentChat`                            |
| `chat/write.ts`        | `CONTENT` 块 → 虚拟写章数据                                | `protocol`                                   |
| `tools/readonly.ts`    | 只读调研工具（设定/章节/故事状态/前文/角色）               | 数据服务                                     |
| `tools/memory.ts`      | 有副作用的短期/长期记忆改写工具                            | `storyMemory`                                |
| `tools/writing.ts`     | 追加正文、重写结尾工具                                     | `novelService`, `protocol`                   |
| `tools/registry.ts`    | 按场景组合工具并转换成 OpenAI schema                       | 上述三类工具                                 |
| `finalize.ts`          | 本章定稿四步流水线                                         | `runtime`, `prompts`, `tools`, `storyMemory` |

## 数据流

```text
页面 controller
  → index.ts（公共 API）
  → chat/engine.ts / finalize.ts
  → runtime.ts（一次模型调用 + 工具回填）
  → llm.ts（DeepSeek 流式请求）
  → tools/registry.ts（按场景选工具）
  → tools/readonly | memory | writing（具体副作用）
  → novelService / loreService / storyStateService（落盘）
```

类型层：`types/agent.ts` 放领域数据结构，`types/agentChat.ts` 放 UI 转录消息。两者都不依赖 service。
