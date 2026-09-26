# YSH 小说 Agent 代码分析报告

> 分析对象：`Yang-Qinghuayi/YSH` @ `b53bcce`（分支 `arena/01a0dd7e-ysh`）
> 分析日期：2026-09-26
> 方法：通读 `src/pages/novel`、`src/pages/lore`、`src/services/*`（agent / deepseek / novel / lore / storyState / import）、`src/store/*`、`src/types/*`、`src-tauri`，并对 README 描述逐条比对实现。

---

## 0. 结论速览（TL;DR）

1. 项目是一个 **本地优先的 Tauri + Vue 3 桌面应用**，三条主线：电子书阅读（内嵌 foliate-js）、AI 辅助小说创作、Lore 世界观资料库。
2. 小说 Agent 是 **自研状态机 + OpenAI 兼容 tool-use 循环**，不是 LangChain 之类的框架，核心只有三个文件、约 1100 行：`agentService.ts`（449 行，状态机与循环）、`agentTools.ts`（428 行，6 个工具）、`deepseekService.ts`（227 行，流式 API 与 prompt）。
3. 状态机共 **7 个 phase**：`idle → planning → awaiting_confirmation → generating → finalizing → done`，任意点可进 `canceled`；有一条 `skipConfirmation` 快速通道给编辑器内联续写用。
4. Agent 覆盖的功能面已经比较完整：**工具调研 → 生成可编辑大纲 → 用户确认闸门 → 流式正文 → 自动增量更新故事状态**，配套的角色档案/动态状态双层模型、三级重要度 Lore、@提及强制指定、跨章检索、整本导入（AI 结构化抽取）都已落地。
5. 但存在几处**实现与设计/文档脱节**的地方，其中 3 个是功能性缺陷（详见第 7 节）：
   - 用户在「章节规划确认」面板里改的大纲**不会进入模型上下文**；
   - `update_story_state` 是**字段级全量覆盖**语义，模型漏填字段会静默清空已有状态；
   - `deepseek-reasoner` 在设置里可选，但 Agent 全流程依赖 Function Calling，官方文档标注该模型不支持 Function Call。
6. `README.md` 的 Agent 章节（工具表、上下文注入优先级、数据目录）与代码**已经不一致**，属于旧版设计描述。

---

## 1. 项目总览

| 维度 | 事实 |
|------|------|
| 形态 | Tauri 2 桌面应用（macOS / Windows / Linux，另有 Android/iOS 插件骨架），同时可跑 Web 模式（`pnpm dev`，IndexedDB 兜底文件系统） |
| 前端 | Vue 3.5 + TypeScript 6 + Vite 8 + Vuetify 4 + Tailwind 4 + Pinia 3 |
| 规模 | 业务代码（不含内嵌 foliate-js）约 **21.6k 行**；`src/pages/novel` 4.6k 行，`src/services` 5.7k 行（其中 TTS 1.7k 行） |
| 数据 | 全本地，无云同步。一个文件夹 = 一部小说 |
| AI | 仅 DeepSeek（OpenAI 兼容 SDK 直连 `https://api.deepseek.com`，`deepseekService.ts:22`） |
| 测试 | 仓库内**没有任何 Agent/业务单元测试**（`src/foliate-js/tests` 是上游阅读引擎自带的） |

### 功能分区

| 区域 | 位置 | 主要内容 |
|------|------|----------|
| 电子书阅读 | `src/pages/book`、`src/pages/library`、`src/foliate-js`（内嵌引擎） | EPUB/PDF/MOBI/AZW3/CBZ/FB2，分页/双页/滚动，CFI 进度，高亮/笔记/书签 |
| TTS | `src/services/tts/*`（1.7k 行）、`src/libs/edgeTTS.ts` | Edge TTS（WebSocket，`utils/ssml.ts`、`utils/ttsTime.ts` 配套）、Web Speech API、HLS 流 |
| **小说创作** | `src/pages/novel/*` | 编辑器、章节、角色、Agent 生成、导入 |
| **Lore 资料库** | `src/pages/lore/*`、`src/services/loreService.ts` | 三级重要度条目 + Markdown 正文 |
| 设置/主题 | `src/pages/setting`、`src/store/setting.ts`、`src/styles/themes.ts`、`src/utils/materialYou.ts` | Material You 调色板、字体、编辑器字号、DeepSeek Key/模型、工作区目录 |
| 工作区 | `src/services/workspaceService.ts`、`src/components/WorkspaceInit.vue` | 目录选择、文件夹名净化（跨平台 `sanitizeDirName`）、同名冲突处理 |

### 实际存储结构（扁平：一个文件夹 = 一部小说）

```
<小说文件夹>/
├── novel.json              # Novel：标题/简介/角色列表/章节元数据
├── chapters/001_第一章.md
├── lore/lore.json          # Lore：全部 EntryMeta
├── lore/entries/001_世界观.md
└── story-state.json        # StoryState：角色动态状态/时间线/伏笔
```

> `workspaceService.getDataBase()` 决定 base：设了 `workspaceDir` 用绝对路径（`base: 'None'`），否则回退 AppData（`base: 'Data'`）。

---

## 2. 小说 Agent 的分层结构

```
UI（src/pages/novel/index.vue，1222 行）
 ├─ MentionTextarea        章节概要输入 + @角色自动补全
 ├─ NovelEditor            CodeMirror 6；Tab 触发内联续写、Esc 中断、Mod-Shift-F 全书搜索
 ├─ AgentStatusBar         悬浮状态胶囊（阶段文案/工具计数/停止按钮）
 ├─ AgentPlanPanel         规划确认闸门（大纲可编辑、所选角色、引用资料、调研日志）
 ├─ CharacterPanel         角色档案（可编辑）+ 动态状态（可编辑）+ 关系（只读）
 └─ StoryStateDialog       故事状态全量查看/编辑（角色/时间线/伏笔/备注）

状态（src/store/agentStore.ts，84 行）
 phase / currentPlan / planDialogVisible / statusText / toolCallLog
 autoUpdateStoryState / storyState 缓存 / 角色面板开关

引擎（src/services/agentService.ts，449 行）
 createSession → runPlanPhase → runGeneratePhase →（finalizing）→ done
 只读工具循环 ≤12 轮，副作用工具循环 ≤3 轮，AbortController 全局可中断

工具（src/services/agentTools.ts，428 行）
 只读 5 个：query_lore / search_chapters / read_story_state / read_context / select_skill
 副作用 1 个：update_story_state

模型接入（src/services/deepseekService.ts，227 行）
 parseMentions / sliceContextBeforeCursor / buildAgentSystemPrompt / summarizeStoryState
 createOpenAIClient / streamChatWithTools（流式事件：text / tool_calls / done）

持久化（novelService / loreService / storyStateService / importService）
```

---

## 3. Agent 状态机逐段解剖

### 3.1 会话与阶段

`SessionPhase`（`agentService.ts:33`）：

```
idle ──► planning ──► awaiting_confirmation ──► generating ──► finalizing ──► done
              │                │                     │              │
              └────────────────┴─────────────────────┴──────────────┴──► canceled
```

- `AgentSession`（`agentService.ts:65`）持有：`novel / chapter / chapterContent / cursorPosition / messages / plan / forcedMentions / abortController / skipConfirmation`。**会话是函数内局部对象**，由 `index.vue` 用 `ref` 持有，不进 Pinia（只有 UI 可观测状态进 store）。
- `createSession` / `abort`（`:84` / `:108`）：中断走 `AbortController`，`isAbort()` 兼容 `AbortError` 与消息含 "aborted" 两类判定。

### 3.2 单轮流式调用

`runOneTurn`（`agentService.ts:155`）→ `streamChatWithTools`（`deepseekService.ts:168`）：

- 打开 `stream: true` + `stream_options.include_usage`；
- **文本增量即时下发**（`onTextDelta`），**tool_calls 分片累积后一次性聚合**（按 `index` 归并 id/name/arguments，`deepseekService.ts:191-224`）；
- 结束后把 assistant 消息（`content` + `tool_calls`）压回 `session.messages`，形成标准 tool-use 多轮。

`executeToolCalls`（`agentService.ts:126`）逐个执行工具，参数 `JSON.parse` 失败即降级为空对象，结果以 `role:'tool'` + `tool_call_id` 回填，未知工具返回「未知工具：xxx」。

### 3.3 planning 阶段（`runPlanPhase`，`agentService.ts:193`）

准备：`loadStoryState` → `summarizeStoryState` → `buildAgentSystemPrompt('planning', novel, state)`；初始 messages 只有 system + user（用户概要），若概要里有被识别的 `@角色` 则追加一句「作者已强制指定：…」。

循环工程细节（这是本模块最"厚"的部分）：

| 机制 | 位置 | 说明 |
|------|------|------|
| 轮数上限 | `:80` | `PLAN_MAX_TOOL_ROUNDS = 12` |
| 渐进催促 | `:276-292` | 第 6 轮（50%）「请输出规划」、第 9 轮（75%）「不要再调工具」、第 12 轮（最后一轮）「必须现在输出」 |
| 最后一轮关工具 | `:296` | `toolsForThisTurn = []`，强制文本产出，避免无限调研 |
| 死循环检测 | `:308-325` | 对每轮工具调用做**稳定签名**（键名排序 + 递归归一 + 排序去重，`stableStringify`/`buildRoundKey`），连续 3 轮签名完全相同 → 注入催促并清空窗口 |
| 结果解析 | `:437-449` | 解析 `<<<PLAN>>>{json}<<<END>>>`；JSON 解析失败则把原文当 `outline`，字段缺失各自兜底 |
| 优雅降级 | `:346-371` | 跑满 12 轮仍无产物时，**回溯最近的 assistant 消息**找 PLAN 标记；再失败才 `onError('规划阶段超出最大工具调用轮数')` |
| 快速模式 | `:340` | `skipConfirmation=true` 时，plan ready 后直接串接 `runGeneratePhase`，不弹面板（内联续写走这条） |

单轮 `max_tokens`：plan 阶段 1500，生成 2500，finalizing 1200。

### 3.4 工具集（`agentTools.ts`）

统一契约：`AgentTool.def`（OpenAI function schema）+ `execute(args, ctx) → { ok, data?, error?, text }`；**`text` 是回传 LLM 的摘要文本**，用于控 token，绝不回传全文。

| 工具 | 行 | 参数 | 行为要点 |
|------|----|------|----------|
| `query_lore` | 52 | `keywords[]`、`importance` | 过滤 `enabled` 条目，按 name/briefDescription/keywords 子串匹配（大小写不敏感）；**major 条目加载正文并截断 800 字，其余只回「名称：简介」索引**；最多 20 条 |
| `search_chapters` | 113 | `query`、`limit=15` | 复用 `novelService.searchInChapters`（逐章逐行子串扫描），返回「《章名》第 N 行：前 120 字」 |
| `read_story_state` | 150 | `section: characterStates\|timeline\|foreshadowings\|all` | 把 `CharacterState` 压成 `心情=/位置=/伤势=/持有=/关系=/notes=` 单行摘要 |
| `read_context` | 209 | `chars=2000` | 复用 `sliceContextBeforeCursor`（剥掉以 `@` 开头的行、取尾部 N 字） |
| `select_skill` | 238 | `skillIds[]` | **在后端只是一个"角色档案读取器"**：按 id 找到 `Character`，回传 `profile/aliases/literaryReference`。这里的 "skill" 是历史命名，实现已改为角色档案 |
| `update_story_state` | 282 | `characterStates[]` / `timeline[]` / `foreshadowings[]` | 唯一有副作用的工具；读 → 按 `characterName` 匹配替换/新增 → 时间线/伏笔 append（生成 `tl-/fs-` 前缀 id）→ `saveStoryState` 落盘 |

导出：`READONLY_TOOLS`（5 个，`:409`）、`SIDE_EFFECT_TOOLS`（1 个，`:418`）、`findTool`、`toToolSchemas`。

### 3.5 generating 阶段（`runGeneratePhase`，`agentService.ts:383`）

- `tools = []` 调用模型 → 纯流式文本，`runOneTurn` 的 `onText` 直通 `cb.onTextDelta`，UI 侧 `editorRef.appendContent(delta)` 逐字写入 CodeMirror 光标处；
- 追加的用户指令是「请按已确认大纲续写小说正文。只输出正文，不要输出 @提及 标记、说明文字或标题。」
- 生成结束 → `finalizing` → `done`，`onDone` 里刷新 `agentStore.storyState` 缓存并 `resetAgent()`。

### 3.6 finalizing 阶段（`:402-419`）

- 受 `AgentConfig.autoUpdateStoryState` 控制（UI 开关在编辑器设置弹窗，默认开）；
- 追加用户指令「请调用 update_story_state 工具……以增量方式更新」；
- 最多 3 轮副作用工具循环，任何一轮没有 tool_calls 就结束。

### 3.7 两条使用链路

| | 整章生成 | 内联续写 |
|---|---|---|
| 触发 | 顶部概要条「生成整章」（`index.vue:72`） | 编辑器内按 Tab（`NovelEditor.vue:41`，仅当本行有文字时）|
| 入口 | `startChapterAgent()`（`index.vue:761`） | `handleGenerate()`（`index.vue:684`） |
| brief | 用户填的章节概要（可含 @角色） | 自动拼「续写一小段，自然衔接前文。本行提示：<当前行>」 |
| forcedMentions | `parseMentions(brief, novel)` | 空数组 |
| skipConfirmation | false → 弹 `AgentPlanPanel` | true → 直接生成 |
| cursorPosition | 章节末尾 | 光标位置，并先 `moveCursorToNextLine()` |
| 确认 | `handleConfirmPlan()`（`:808`）把 plan 存回 session 后走 generating | — |
| 取消 | `handleCancelPlan()`（`:844`）abort + 重置 | `handleStopGenerate()`（`index.vue:737`）/ Esc / 状态胶囊「停止」 |

### 3.8 UI 反馈层

- `AgentStatusBar`：按 phase 显示图标/文案（`正在调研上下文…` / `已调 N 个工具` / `正在更新故事状态…`），busy 时给「停止」；`canceled` 显示红叉。
- `AgentPlanPanel`：大纲 `v-textarea` 可编辑，展示 `approach`、`selectedSkills`（角色 + 理由）、`referencedLoreEntries`、工具调用日志（逐个 ✓）；确认按钮把 **编辑后的大纲** emit 出去。
- 生成互斥：`novelStore.isGenerating` 由 `syncGenerating(phase)` 统一维护，生成期间「生成整章」禁用。
- 错误：`v-snackbar` 提示（规划失败/生成失败/未配置 Key/未填概要）。

---

## 4. 数据层：角色 / 故事状态 / Lore / 提及 / 导入

### 4.1 角色的"两层模型"（设计亮点）

| 层 | 类型 | 内容 | 存储 | 谁写 |
|----|------|------|------|------|
| 静态档案（"是谁"） | `Character`（`types/novel.ts:26`） | `name`（@提及键）、`profile`（自然语言综合描述）、`aliases`、`literaryReference`（文学形象参考，如"杨过/李寻欢"） | `novel.json` | 角色管理弹窗、角色面板、导入 |
| 动态状态（"现在怎样"） | `CharacterState`（`types/storyState.ts:18`） | `mood / location / injuries / possessions / relationships / notes / lastUpdatedChapterId / updatedAt` | `story-state.json` | Agent 的 `update_story_state`、角色面板、StoryStateDialog |

关联键是 `characterName`（弱关联，不内嵌进 novel.json），文件注释明确写了「状态不进档案、档案不进状态」。

### 4.2 故事状态层

- `storyStateService.ts`：`loadStoryState`（不存在返回空骨架，**不写盘**）、`saveStoryState`（写盘并回填 `updatedAt`）、`getCharacterState`（**定义但全仓库无人调用**）。
- `StoryState` 还含 `timeline: TimelineNode[]` 与 `foreshadowings: Foreshadowing[]`，类型注释直言「**本期预留结构，arc 追踪推迟到后续迭代**」；Agent 能 append 这两类，但没有任何读取-推进-解伏笔的自动化逻辑。
- 三条写入路径：Agent 自动（finalizing）、角色面板逐字段手改（`handleUpdateCharacterState`，`index.vue:862`）、StoryStateDialog 全量编辑。

### 4.3 Lore 资料库

- `types/lore.ts`：`EntryMeta` = 名称 / 重要度（major·important·minor）/ 索引简介 / 关键词 / `enabled` / 顺序；正文单独存 `lore/entries/<id>.md`。
- `EntryEditor` 区分「AI 读取中 / AI 不读取」开关（`enabled`），并用文案说明简介"供 AI 快速参考"。
- **Agent 实际注入方式**：不是"优先级拼装"，而是**工具按需检索**（`query_lore`：major 给正文、其余给索引）+ planning system prompt 里只带故事状态摘要。
- `loreService.buildLoreContext()`（`:199`，实现"major 全文 + 其他索引"的优先级拼装）**已写完但无任何调用点**——是被 Agent 工具方案取代的旧路径。

### 4.4 @提及机制

- 解析：`parseMentions`（`deepseekService.ts:39`）正则 `/@([一-龥\w]+)/g`，**只匹配 `Character.name` 精确相等**（`aliases` 不参与）。
- 输入侧：`MentionTextarea` 在光标前检测未完成 `@xx` → 下拉过滤角色 → ↑↓/Enter/Tab 选择、Esc 关闭（只在概要条启用；CodeMirror 编辑器内**没有** @补全，尽管依赖里装了 `@codemirror/autocomplete`）。
- 生效范围：仅"整章生成"把提及作为 `forcedMentions` 写进 user 消息；内联续写传 `[]`。两种模式下 `sliceContextBeforeCursor` 都会剥掉 `@` 开头行。模型侧另有一份「可用角色档案」清单（name + 参考形象或 profile 前 60 字）常驻 system prompt。

### 4.5 导入（AI 结构化抽取，`importService.ts` 415 行）

三步流水线，与 Agent 状态机无关但是同一个 AI 底座：

1. `splitChapters`：纯正则预切分（`第X章/回/节/卷/篇`、`Chapter N`、`1、`），标题行 ≤40 字防误判；**零标题兜底按 ~3000 字机械切分**，尽量在 `\n。！？` 处断句。
2. `extractImportMeta`：把「章节清单 + 每章前 600 字采样（末章再补尾部 400 字）」送给模型，用 `<<<IMPORT>>>{json}<<<END>>>` 协议返回 `novelTitle / synopsisBrief / plotProgress / characters[] / loreEntries[]`；解析容错到"截取第一个 `{` 到最后一个 `}`"。
3. `persistImport`：直接调底层写函数批量落盘（自造带序号的 id 避免同毫秒冲突），并把 `plotProgress` 自动生成为第一条 **major** Lore 条目「情节梗概」。

UI（`ImportNovelDialog.vue`，771 行）：粘贴/上传 `.txt/.md` → 章节切分预览 → AI 解析（可取消，AbortController）→ 预览确认（章节勾选、角色/条目可增删改）→ 落盘（Tauri 下先选父目录并创建独立小说文件夹，Web 下落 AppData）。

### 4.6 小说/章节/Lore 的 CRUD 与检索

- `novelService.ts`：`loadCurrentNovel / saveNovelMeta / createNovel / loadChapterContent / saveChapterContent / createChapter / deleteChapter / countWords（去 Markdown 符与空白）/ formatWordCount / loadAllChapterWordCounts / searchInChapters`。
- 章节自动保存：编辑 2 秒防抖（`index.vue:612-616`），保存时顺带重算字数并写回 `novel.json`；打开小说时后台补齐缺失字数。
- 全书搜索：`GlobalSearch.vue` + `Mod-Shift-F`，逐章逐行匹配并支持跳转到行（`editorRef.jumpToLine`）。同一能力被 Agent 的 `search_chapters` 工具复用。
- 角色排序/章节排序：章节按 `order` 排序（`ChapterList`）；**没有拖拽重排实现**（`novelStore.updateChapterList` 预留但未被 UI 调用）。
- 数据迁移：角色 V1（`profile/skills`）→ 中间态 → V2（`profile` + `literaryReference`）两级幂等迁移（`novelService.ts:18-111`），Lore 剥离旧的 `type/tags`（`loreService.normalizeLore`），迁移后自动写回。

---

## 5. 功能覆盖矩阵

### ✅ 已实现且可用

- Agent 状态机与 7 个 phase、可中断（AbortController 全链路）
- planning 只读工具循环：轮数上限 + 渐进催促 + 三连重复检测 + 回溯降级
- 5 个只读工具 + 1 个副作用工具，统一 `{ok,data,error,text}` 契约、token 受控回传
- 规划确认闸门（大纲可编辑、角色/资料/日志可视化）
- 流式正文逐字写入编辑器；Tab 内联续写快速通道（跳过确认）
- 生成后自动增量更新角色动态状态（可开关）
- 双层角色模型：静态档案 + 动态状态，串联角色面板 / StoryStateDialog / Agent
- 三级重要度 Lore 资料库（条目 CRUD、启用开关、Markdown 正文、关键词）
- @提及（概要条自动补全 + 强制指定 + system prompt 角色清单）
- 跨章全文检索（UI + Agent 工具复用）
- AI 整本导入（章节切分 + 结构化抽取 + 预览确认 + 批量落盘）
- 故事状态时间线/伏笔的数据结构与手动编辑（Agent 可 append）
- 多小说切换（一个文件夹 = 一部小说）、工作区向导、Web 兜底（IndexedDB）
- 章节自动保存、字数统计、编辑器字号、DeepSeek Key/模型设置

### ⚠️ 部分实现 / 名不副实

| 点 | 现状 |
|----|------|
| 大纲可编辑 | UI 支持编辑，但编辑结果**不回传模型**（见 7.1） |
| `select_skill` "技能" | 实为角色档案读取器；`skill` 命名是历史遗留 |
| `aliases`（角色别名） | 只在 UI 展示 / 导入 / `select_skill` 回传里出现，**不参与 @提及解析**，"触发词"语义未落地 |
| 时间线 / 伏笔 | 只有数据结构和 append，没有 arc 追踪、伏笔提醒、状态流转自动化（类型注释自认"预留"） |
| `ChapterMeta.summary` | 类型里定义了"给后续章节提供上下文"，**全仓库无写入无读取** |
| `buildLoreContext` | 优先级拼装实现完整但无人调用，已被工具检索取代 |
| 上下文注入优先级 | README 描述的五级优先级**未在代码中实现**，真实机制是"system prompt 摘要 + 工具按需检索" |
| `deepseek-reasoner` | UI 可选，但工具调用场景存在兼容性风险（见 7.3） |
| 中断语义 | 取消即停，已写入的文本不回收、无撤销/快照 |

### ❌ 未实现（代码中无痕迹）

- 多轮对话式写作助手 UI（没有 chat 界面，只有一次性任务流）
- token/上下文预算管理与历史裁剪（`session.messages` 只增不减）
- 失败自动重试、断点续生成、生成历史版本对比、回滚
- 章节摘要自动生成与"前情提要"注入
- 角色关系图谱、arc/伏笔追踪看板
- Agent 结果的结构化评测、任何单元/集成测试
- 云同步、多端协同（与"本地优先"定位一致）

---

## 6. README 与实现的差异对照（本轮已按实况改写 README）

| README 说法 | 代码实况 |
|-------------|----------|
| planning 工具：`read_context` / `search_lore` / `list_characters` | 实为 `query_lore` / `search_chapters` / `read_story_state` / `read_context` / `select_skill`（5 个） |
| 状态机：`idle → planning → awaiting_confirmation → generating → done` | 多出 `finalizing`（`update_story_state` 独立成阶段）；另有 `canceled` |
| 「Generating 阶段：`update_story_state`」 | 副作用工具在 `finalizing` 阶段调用，generating 阶段 `tools=[]` |
| 「上下文注入优先级：光标前文本 > @提及 > Major Lore > …」 | 无优先级拼装实现；`buildLoreContext` 是死代码 |
| 「在编辑器中使用 `@角色名` 可注入档案」 | 编辑器内无 @补全；`parseMentions` 只作用于概要条（整章模式） |
| 数据目录 `{App Data}/Data/novels/{id}/…` | 实为"一个文件夹 = 一部小说"的扁平结构，路径由 `workspaceDir` 决定 |
| 「章节简介出发由 Agent 规划」 | 实际是顶部「章节概要」输入条，`ChapterMeta.summary` 未被使用 |

---

## 7. 问题与风险清单（按优先级，附定位）

### P0/P1 — 功能正确性（本轮已全部修复，见第 9 节）

**7.1 ✅ 已修复 · 用户在规划面板里编辑的大纲不会进入模型上下文**（`index.vue:808`、`agentService.ts:383`、`:437`）
`handleConfirmPlan` 只做 `session.plan = plan`，而 `session.plan` 在整个仓库里**只写不读**；`runGeneratePhase` 追加的指令是「请按已确认大纲续写」，模型实际依据的是自己上一轮输出的 `<<<PLAN>>>` 原文（仍在 `messages` 里）。→ 面板的"可编辑大纲"曾是**无效控件**。
**修复**：新增纯函数 `buildGenerateInstruction(plan)`（`services/agentProtocol.ts`），生成阶段以此拼装 user 消息，显式携带作者确认过的大纲 + 写法思路，并声明"不要沿用此前版本"；`agentService.runGeneratePhase` 改为 `content: buildGenerateInstruction(session.plan)`。

**7.2 ✅ 已修复 · `update_story_state` 会静默清空未提交的字段**（`agentTools.ts:353-368`）
合并逻辑是 `mood/location/injuries/possessions/notes = c.*`（缺省即 `undefined`）、`relationships: c.relationships ?? []`。工具描述要求"提交完整新状态"，但只要模型少填一个字段（尤其 `relationships`），已有数据就被覆盖为空。**修复**：抽出新模块 `services/storyStateMerge.ts`（纯函数），只覆盖"明确提交"的字段，未提交字段保留原值；`relationships` 按 `target` 合并（同名覆盖、未提及保留）；timeline/foreshadowings 仍为追加。工具描述同步改为增量语义（"不要为了占位而填空字符串"），`agentTools` 改为调用该模块。

**7.3 ✅ 已修复 · `deepseek-reasoner` 与 Function Calling 冲突**（`store/setting.ts:28`、`index.vue:436-439`）
模型下拉框允许选 `deepseek-reasoner`，而 Agent 全流程（planning/finalizing）依赖 `tools`、并要求模型按 `<<<PLAN>>>` 协议输出 JSON。DeepSeek 官方文档的历史版本（社区镜像与多篇实测文章一致）标注 `deepseek-reasoner` **不支持 Function Call / JSON Output**，且带 `reasoning_content` 的多轮 messages 拼接有额外约束。**修复**：新增 `supportsToolCalling(model)` 判定；`runPlanPhase` / `runGeneratePhase` 在该模型下自动降级为**无工具模式**——规划阶段把故事状态 + Lore（major 全文，复用原本闲置的 `buildLoreContext`）直读进 system prompt，单轮产出 PLAN；状态更新改走 `<<<STATE>>>` JSON 协议再复用 `update_story_state` 执行器；`streamChatWithTools` 不再向 API 发送空 `tools` 数组；设置弹窗选该模型时显示降级提示。

### P2 — 稳定性与体验（本轮已全部修复，见第 10 节）

**7.4 ✅ 已修复 · 取消 / 报错后状态胶囊可能卡住**（`index.vue:684-743`、`AgentStatusBar.vue:26`）
`canceled` 不在 `visible` 的排除集合里（只排除 `idle`/`done`），且内联续写链路的 `onError` 分支不调用 `resetAgent()`。→ 中断后 pill 会长期显示上一次的陈旧文案。建议：`onError`/`canceled` 路径统一 `resetAgent()`，或让 `visible` 排除 `canceled` 并加超时自动隐藏。

**7.5 ✅ 已修复 · 无上下文预算，长线会话可能超限**（`agentService.ts:126-190`）
`session.messages` 只累加：最多 12 轮 × 每轮多次工具调用，`query_lore` 单次最多 20 条（major 各 800 字）。没有总量校验、没有截断/摘要策略；DeepSeek 上下文（64K）打满时只会得到一个 API 报错。

**7.6 ✅ 已修复 · 生成结果不强校验 `finish_reason`**（`deepseekService.ts:168-224`）
`finish_reason='length'` 截断不会被识别，用户只看到"正文戛然而止"；也没有重试/续写补偿。

**7.7 ✅ 已修复 · 编辑区 Tab 续写与 plan 阶段的重量级循环不匹配**（`agentService.ts:193`）
内联续写语义是"写一小段"，却仍走完整 12 轮 planning 循环（含可能的多轮检索），首字延迟偏高；`skipConfirmation` 只跳过了确认面板，没有降低调研预算。

**7.8 ✅ 已修复 · `executeToolCalls` 与 schema 列表的耦合**（`agentService.ts:126-131`、`:321`）
plan 阶段显式传 `READONLY_TOOLS`（正确），但函数签名接受任意 tools，最终生成阶段传 `[]`，靠 `findTool` 兜底返回"未知工具"。属于易踩的耦合点，建议改为按 `tools` 参数查表并断言。

**7.9 ⚠️ 已缓解 · API Key 明文存 localStorage 且浏览器直连**（`store/setting.ts:35`、`deepseekService.ts:163`）
`useLocalStorage('setting', …)` 存 `deepseekApiKey`，客户端 `dangerouslyAllowBrowser: true` 直连 api.deepseek.com。桌面端可接受，Web 部署形态下等于密钥暴露给浏览器环境；且导入/生成全在前端发起，没有走 Tauri 侧代理。

### P3 — 工程卫生（本轮已全部处理，见第 10 节）

- **死代码 / 未接线**：`buildLoreContext`（`loreService.ts:199`）、`AIGenerateParams`（`types/novel.ts:77`）、`getCharacterState`（`storyStateService.ts:68`）、`ChapterMeta.summary`、`novelStore.updateChapterList`、依赖里的 `@codemirror/autocomplete`。
- **命名遗留**：`select_skill` / `selectedSkills` / `skillIds` 实际指"角色档案"（`agentTools.ts:238`、`agentService.ts:40`）。
- **零测试**：Agent 的循环分支（催促、重复检测、降级解析）全是纯函数或可注入 mock 的形态，很适合补 Vitest + mock 流式响应，目前完全没有。
- **文档漂移**：README 的 Agent 章节需按第 6 节改写。

---

## 8. 如果要继续演进，优先级建议

1. **修 7.1、7.2、7.3**（三处都在"确认后生成"的主路径上，改动都很小）。
2. 补一层**上下文预算管理器**：估算 token、按优先级裁剪工具结果与历史，超限时先丢 minor 工具输出。
3. 打通 `ChapterMeta.summary`：在 `finalizing` 阶段顺带生成章节摘要，planning 时注入"前情提要"，让长篇小说的一致性维护从"检索"升级为"摘要 + 检索"。
4. 把 `timeline/foreshadowings` 从"可 append 的数据"做成"arc 追踪"：给 Agent 增加 `plan_arc` / `check_foreshadowing` 只读工具，UI 增加伏笔看板。
5. 增加**版本快照**（每次 Agent 生成前后对章节文件做快照），让"取消/重生成"可回滚。
6. 补 Vitest：以 mock 的流式 chunk 驱动 `agentService`，覆盖催促阈值、三连重复、PLAN 解析兜底、abort 四条分支。
7. 同步 README（第 6 节差异表即为待改清单）。

---

## 附：本次分析覆盖的文件清单

```
src/pages/novel/index.vue                        1222 行  ← Agent 编排主入口
src/pages/novel/components/AgentPlanPanel.vue     159
src/pages/novel/components/AgentStatusBar.vue      89
src/pages/novel/components/NovelEditor.vue        229       ← Tab 触发/Esc 中断/appendContent
src/pages/novel/components/MentionTextarea.vue    195
src/pages/novel/components/CharacterPanel.vue     195
src/pages/novel/components/CharacterDialog.vue    353
src/pages/novel/components/StoryStateDialog.vue   396
src/pages/novel/components/LorePanel.vue          339
src/pages/novel/components/ImportNovelDialog.vue  771
src/pages/novel/components/ChapterList.vue        232
src/pages/novel/components/NovelOverviewBar.vue   190
src/pages/novel/components/NovelList.vue          222
src/pages/lore/components/EntryEditor.vue         310
src/pages/lore/components/EntryList.vue           278
src/components/GlobalSearch.vue / WorkspaceInit.vue
src/services/agentService.ts                      449   ← 状态机 + tool-use 循环
src/services/agentTools.ts                        428   ← 6 个工具
src/services/deepseekService.ts                   227   ← 流式封装 + prompt
src/services/storyStateService.ts                  73
src/services/novelService.ts                      340
src/services/loreService.ts                       246
src/services/importService.ts                     415
src/services/workspaceService.ts                  125
src/store/agentStore.ts                            84
src/store/novelStore.ts / loreStore.ts / setting.ts
src/types/novel.ts / lore.ts / storyState.ts
README.md（逐条与实现比对）
```

---

## 9. 修复记录（本轮，分支 `arena/01a0dd7e-ysh`）

针对第 7 节 P0/P1 三项的功能性缺陷，已完成修复（未提交，改动见下表）。

| # | 问题 | 改动 |
|---|------|------|
| 7.1 | 确认面板中编辑的大纲不生效 | 新增 `services/agentProtocol.ts`：`buildGenerateInstruction()` 把已确认大纲/写法思路写入生成指令；`runGeneratePhase` 改用之 |
| 7.2 | 未提交字段被静默清空 | 新增 `services/storyStateMerge.ts`：`applyStoryStatePatch()` 真增量合并 + 关系按 target 合并；`update_story_state` 描述改为增量语义 |
| 7.3 | reasoner 不支持工具调用 | `deepseekService.supportsToolCalling()` + `runInlinePlanPhase()` / `runInlineStoryStateUpdate()` 无工具降级路径；空 `tools` 不再下发；UI 加降级提示 |

改动文件：

```
src/services/agentProtocol.ts      （新增）PLAN/STATE 协议解析、生成指令拼装、循环守卫签名
src/services/storyStateMerge.ts    （新增）故事状态增量合并规则（纯函数）
src/services/agentService.ts       （改） 模型分流 + 两条无工具路径 + 复用协议模块
src/services/agentTools.ts         （改） update_story_state 增量语义 + 调用合并模块
src/services/deepseekService.ts    （改） supportsToolCalling + prompt opts + 空 tools 过滤
src/pages/novel/index.vue          （改） reasoner 降级提示（.model-warn）
```

顺带的结构收益：原 `agentService.ts` 里的 `stableStringify` / `buildRoundKey` / `parsePlan` 内联实现抽到 `agentProtocol.ts`，与 `storyStateMerge.ts` 一起成为**纯函数、无 IO** 的可单测单元（此前 Agent 逻辑零测试覆盖）。

### 验证结果

| 手段 | 结果 |
|------|------|
| `tsc --noEmit --skipLibCheck` | 43 条错误 vs 基线 43 条，**集合完全一致**（均为既有问题：vueuse 类型、tinycolor2 声明、`ArrayBufferLike`、`vuetify/styles` 的 moduleResolution 等），改动文件 0 报错 |
| `vue-tsc --noEmit --skipLibCheck` | 47 条 vs 基线 47 条，**diff 为空** |
| `vite build --mode web` | ✅ 构建成功（保留既有 chunk 体积/pure 注释告警） |
| `storyStateMerge` 行为测试（esbuild + node 断言） | ✅ 6 组 22 项：未提交字段保留、关系按 target 合并、新角色/时间线/伏笔追加、入参不可变、畸形补丁被忽略 |
| `agentProtocol` 行为测试 | ✅ 7 组 31 项：PLAN/STATE 解析容错、生成指令含作者改过的大纲、签名与键序/调用顺序无关、连续三连才触发催促 |

> 说明：未做真实 API 端到端调用（无 API Key、项目本身无测试设施），DeepSeek 线上行为仍建议真机跑一次；测试脚本为一次性验证，未入库（仓库无 vitest 依赖）。

### 后续轮次

P2（7.4–7.9）与 P3（死代码/命名/测试/文档漂移）已在第二轮完成，详见第 10 节。

---

## 10. 第二轮修复记录（P2 / P3，分支 `arena/01a0dd7e-ysh`）

### P2 — 稳定性与体验

| # | 问题 | 修复 |
|---|------|------|
| 7.4 | 取消/报错后状态胶囊卡住 | `index.vue` 新增统一的 `finishAgent()`（刷新状态缓存 → `resetAgent()` → 清会话 → 解除生成态），错误/取消/成功三条路径全部汇入；`AgentStatusBar` 增加 `dismiss` 事件，`canceled` 只停留 3.5s 后自动收起；`onPhase` 对 `canceled` 兜底 4s 自动收尾 |
| 7.5 | 无上下文预算 | 新增纯函数模块 `services/contextBudget.ts`（`estimateTokens` / `enforceContextBudget`）：每次调用模型前按 64K×0.85 − 预留输出 − 工具 schema 估算预算，超限时**从最旧的工具调研单元**开始丢弃，保留 system、首条用户消息与最近若干单元，且绝不拆散 `assistant.tool_calls` 与其 `tool` 消息的配对；触发时通过 `onContextTrimmed` 通知 UI |
| 7.6 | 不校验 `finish_reason` | `runOneTurn` 返回 `finishReason`；正文若因 `length` 截断则**自动续写**（`CONTINUE_INSTRUCTION`，最多 2 次），仍截断则 `onWarn` 提示；planning 阶段若既无 PLAN 块又被截断，直接给出可操作错误（而不是把半截文本当大纲） |
| 7.7 | Tab 续写走完整 12 轮调研 | 会话新增 `planMaxToolRounds`（整章 12 / 内联 4，导出 `INLINE_PLAN_MAX_TOOL_ROUNDS`），催促阈值随上限动态计算；内联续写同时关闭摘要生成，降低首字延迟 |
| 7.8 | 工具列表与 schema 耦合 | `executeToolCalls` 形参改名 `registry` 并写明"必须与喂给模型的 schema 列表一致"；列表外工具名返回错误文本回传模型；**工具内部抛错改为捕获并回传错误文本**，不再中断会话 |
| 7.9 | API Key 明文 + 浏览器直连 | 新增 `hooks/useApiKey.ts`：Key 与 setting store 解耦，默认存 `deepseek.apiKey`，可切换为仅本次会话（`sessionStorage`），切换时自动迁移；旧的 `setting.deepseekApiKey` 一次性迁移并从 setting 中删除；设置页新增「记住 API Key」开关、清除按钮与存储位置说明。**浏览器直连未能消除**（本地优先应用无服务端代理），已在设置页与 README 明确说明并建议使用受限 Key |

### P3 — 工程卫生

| 类别 | 处理 |
|------|------|
| 死代码 / 未接线 | 移除 `AIGenerateParams`、`getCharacterState`、`novelStore.updateChapterList`；`ChapterMeta.summary` **接线为完整功能**（finalizing 生成摘要 → `onChapterSummary` → 写回 `novel.json` → 下次 planning 注入「前情提要」，最多 5 章，设置页可关）；`buildLoreContext` 已在无工具模式中启用；`@codemirror/autocomplete` 依赖接线为编辑器 `@角色` 补全，并让内联续写解析光标前的 @提及作为强制指定 |
| 命名遗留 | 工具 `select_skill` → `select_characters`（参数 `skillIds` → `characterIds`，两者均保留旧名兼容解析）；`AgentPlan.selectedSkills` → `selectedCharacters`（`parsePlan` 兼容旧字段名） |
| 零测试 | 新增 `tests/`（Node 内建 test runner + 类型擦除，**零新增依赖**）：`agentProtocol.test.ts`、`storyStateMerge.test.ts`、`contextBudget.test.ts`，共 **22 个用例**；`package.json` 增加 `test` / `test:watch` |
| 文档漂移 | README 的「小说创作 / AI 创作引擎 / 项目结构 / 数据存储 / 快速开始」按第 6 节差异表逐条改写（工具表、状态机含 finalizing、上下文管理与预算策略、reasoner 降级、扁平存储结构、测试命令） |

### 本轮新增文件

```
src/services/contextBudget.ts   （新增 ~200 行）token 估算与上下文裁剪（纯函数）
src/services/agentProtocol.ts   同名文件内新增：CONTINUE_INSTRUCTION、cleanChapterSummary、角色字段兼容
src/hooks/useApiKey.ts          （新增 ~100 行）API Key 双存储与迁移
tests/*.test.ts                 （新增 3 个文件）22 个用例
```

### 验证结果（本轮）

| 手段 | 结果 |
|------|------|
| `tsc --noEmit --skipLibCheck` | 43 条 vs 基线 43 条，**集合一致**（既有问题：vueuse 类型、tinycolor2 声明、ArrayBufferLike、moduleResolution 等），改动文件 0 报错 |
| `vue-tsc --noEmit --skipLibCheck` | 47 vs 基线 47，**diff 为空** |
| `pnpm test`（node --test） | ✅ 22/22 通过（协议解析容错、生成指令携带已确认大纲、签名与键序无关、连续三轮才催促、合并保留未提交字段、关系按 target 合并、纯函数不改入参、预算裁剪不拆散工具配对、预留输出影响裁剪量） |
| `vite build --mode web` | ✅ 构建成功（保留既有 chunk 体积/pure 注释告警） |
| Dev server 冒烟 | ✅ 首页 200，`agentService/agentProtocol/contextBudget/storyStateMerge/useApiKey/index.vue/NovelEditor/AgentStatusBar` 8 个模块均被 Vite 正常转换，日志无错误 |

> 仍属外部依赖、无法在本环境验证的部分：真实 DeepSeek API 的端到端行为（含 `deepseek-reasoner` 是否真的拒绝 `tools`——代码已按"不支持"降级，实测若其已支持工具调用，可把 `supportsToolCalling` 直接放开）。

### 剩余建议（未在本轮范围）

时间线/伏笔的 arc 追踪、生成前章节快照与回滚、多轮对话式写作界面、Agent 结果的自动化评测。
