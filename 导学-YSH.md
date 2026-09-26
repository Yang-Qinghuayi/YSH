# YSH 项目导学

> 说明：本文基于当前仓库源码与 README 生成。仓库能证明产品形态、技术实现和代码边界，但不能证明个人职责、线上用户量、性能指标或发布结果；这些内容在正文中以“待补”或“待测”标注。

## 1. 前置知识（面试高频标注）

| 知识点                             | 为何需要                                          | 在本项目中的位置                                                               | 高频度 |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Vue 3 Composition API 与响应式     | 理解页面、Store、服务层如何协作                   | `src/pages/`、`src/store/`                                                     | 高     |
| TypeScript 类型建模                | 理解 Novel、Lore、StoryState、AgentSession 的边界 | `src/types/`、`src/services/agentService.ts`                                   | 高     |
| Pinia 状态管理                     | 理解跨组件共享的编辑、Agent、朗读状态             | `src/store/agentStore.ts`、`src/store/ttsStore.ts`                             | 高     |
| Tauri 2 与前端/原生文件系统边界    | 理解本地优先和跨平台能力                          | `src/services/appService.ts`、`src/services/nativeAppService.ts`、`src-tauri/` | 高     |
| 文件型数据持久化                   | 理解元数据、正文、资料库如何分开保存              | `src/services/novelService.ts`、`src/services/loreService.ts`                  | 高     |
| LLM function calling 与流式响应    | 理解规划、工具调用、正文流式生成                  | `src/services/deepseekService.ts`、`src/services/agentService.ts`              | 高     |
| 状态机与副作用隔离                 | 理解 AI 规划为什么先只读、后确认、再写状态        | `src/services/agentService.ts`、`src/services/agentTools.ts`                   | 高     |
| AbortController 与异步取消         | 理解 AI 生成和 TTS 如何中断                       | `src/services/agentService.ts`、`src/services/tts/TTSController.ts`            | 中高   |
| SSML、Web Speech API、音频边界事件 | 理解朗读、高亮和跨段落推进                        | `src/services/tts/`、`src/utils/ssml.ts`                                       | 中高   |
| EPUB/CFI/DOM 范围定位              | 理解阅读器中的精确进度和句词高亮                  | `src/pages/book/`、`src/services/tts/TTSController.ts`                         | 中     |
| CI/CD 与多平台构建                 | 理解 macOS、Windows、Linux、Android 的发布链路    | `.github/workflows/main.yml`、`.github/workflows/release.yml`                  | 中高   |

## 2. 重点亮点与学习顺序（先看这个）

| 亮点标题              | 为什么重要                                                                 | 通用技术关键词                                       | 先看哪些文件                                                                                               | 建议学习顺序 |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ |
| 分阶段 Agent 状态建模 | 把高风险写操作放在用户确认之后，便于取消、恢复和定位                       | 状态机、阶段隔离、人工确认、AbortController          | `src/services/agentService.ts`、`src/store/agentStore.ts`、`src/pages/novel/components/AgentPlanPanel.vue` | 1            |
| 可扩展工具编排        | 通过统一工具协议把上下文读取、资料检索和状态更新接入模型                   | function calling、只读工具、副作用工具、工具轮次上限 | `src/services/agentTools.ts`、`src/services/deepseekService.ts`                                            | 2            |
| 本地优先的数据分层    | 小说元数据、章节正文、Lore 和故事动态状态分别存储，降低单文件耦合          | 文件持久化、数据迁移、增量写入、服务层               | `src/services/novelService.ts`、`src/services/loreService.ts`、`src/services/storyStateService.ts`         | 3            |
| 多引擎朗读与异步协调  | 用统一客户端接口屏蔽 Edge TTS 与 Web Speech 的差异，同时保持高亮和导航一致 | 适配器、流式事件、预加载、词边界、高亮同步           | `src/services/tts/TTSClient.ts`、`src/services/tts/EdgeTTSClient.ts`、`src/services/tts/TTSController.ts`  | 4            |
| 跨端抽象与发布治理    | 同一套业务服务适配 Web 和 Tauri，并通过 CI 产出多平台安装包                | 平台抽象、能力探测、Tauri、GitHub Actions            | `src/services/appService.ts`、`src/services/nativeAppService.ts`、`.github/workflows/`                     | 5            |

推荐阅读主线是：先读 Agent 状态流转，再读工具和模型封装；随后读本地数据服务，最后读阅读器/TTS 与跨平台发布。这样能先建立业务主链路，再补实现细节。

## 3. 必备知识点

- [ ] 能解释 Vue 页面、Pinia Store、service 层的职责边界。
- [ ] 能画出 `idle -> planning -> awaiting_confirmation -> generating -> finalizing -> done` 的状态流。
- [ ] 能说清只读工具和副作用工具为何分组，以及每组在哪里执行。
- [ ] 能解释 AI 规划阶段如何读取章节上下文、章节搜索、Lore 和故事状态。
- [ ] 能说明动态故事状态为何与人物静态档案分开。
- [ ] 能解释章节正文和元数据为何分文件保存，以及保存时如何更新 `updatedAt`。
- [ ] 能说清 Edge TTS 与 Web Speech 如何共享 `TTSClient` 接口。
- [ ] 能解释预加载、AbortController、音频边界和高亮事件的关系。
- [ ] 能说明 Web/Tauri 的文件系统实现为何通过 `AppService` 抽象隔离。
- [ ] 能根据 CI 配置说明一次构建如何覆盖多个目标平台。

## 4. 推荐阅读（结合仓库）

| 主题              | 通用技术点                               | 建议阅读位置                                                                                      | 预计时间 | 读完能回答什么                                   |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| 产品入口与路由    | 页面分区、路由组织、应用初始化           | `src/App.vue`、`src/router/index.ts`、`src/pages/layout/View.vue`                                 | 20 分钟  | 应用有哪些主要工作区，入口如何组织？             |
| 项目数据模型      | 类型边界、实体关系、兼容性               | `src/types/novel.ts`、`src/types/lore.ts`、`src/types/storyState.ts`                              | 25 分钟  | 小说、章节、角色、Lore 和动态状态分别表示什么？  |
| 小说本地持久化    | 元数据/正文分离、迁移、全文搜索          | `src/services/novelService.ts`                                                                    | 35 分钟  | 章节如何创建、保存、搜索和删除？                 |
| Lore 资料库       | 索引与正文分离、重要度、上下文构建       | `src/services/loreService.ts`、`src/pages/lore/components/EntryEditor.vue`                        | 30 分钟  | AI 如何按资料重要度获得设定信息？                |
| 故事动态状态      | 增量合并、角色状态、时间线与伏笔         | `src/services/storyStateService.ts`、`src/services/agentTools.ts`                                 | 30 分钟  | 生成一章后哪些状态被更新，如何避免覆盖无关状态？ |
| Agent 会话        | 状态机、流式生成、取消、轮次上限         | `src/services/agentService.ts`、`src/store/agentStore.ts`                                         | 45 分钟  | 规划和生成如何分阶段，何时允许副作用？           |
| 工具调用          | function calling、摘要控 token、工具错误 | `src/services/agentTools.ts`                                                                      | 35 分钟  | 模型如何检索上下文，工具返回什么给模型？         |
| 模型接入          | OpenAI 兼容协议、流式事件、系统提示词    | `src/services/deepseekService.ts`                                                                 | 25 分钟  | DeepSeek 接入如何与 Agent 服务解耦？             |
| 规划确认 UI       | 人机协同、可编辑计划、操作反馈           | `src/pages/novel/components/AgentPlanPanel.vue`、`src/pages/novel/components/AgentStatusBar.vue`  | 25 分钟  | 用户怎样查看、修改并确认 AI 计划？               |
| 阅读器与 TTS      | 多引擎适配、章节导航、句词高亮           | `src/services/tts/TTSClient.ts`、`src/services/tts/TTSController.ts`、`src/store/ttsStore.ts`     | 50 分钟  | 朗读状态如何同步到页面，高亮为何不会跟错章节？   |
| Edge TTS 音频处理 | 预加载、重试、词边界、暂停恢复           | `src/services/tts/EdgeTTSClient.ts`、`src/services/tts/wordHighlight.ts`                          | 35 分钟  | 外部语音请求抖动时，系统如何尽量不中断播放？     |
| 跨平台文件服务    | 目录映射、协议文件、平台差异             | `src/services/appService.ts`、`src/services/nativeAppService.ts`、`src/services/webAppService.ts` | 35 分钟  | Web 与桌面端如何共用上层业务逻辑？               |
| 发布链路          | 多平台矩阵、构建依赖、tag 发布           | `.github/workflows/main.yml`、`.github/workflows/release.yml`                                     | 25 分钟  | 分支构建和正式版本发布如何触发？                 |

## 5. 自学提醒

若某文件或原理看不懂，请继续追问 AI；本技能负责给学习路径与题目，不提供逐行讲解。

建议每读完一个主题，都用“输入是什么、状态如何变化、失败怎么处理、结果写到哪里”四个问题复述一遍，并在本地用一个最小小说、一个角色和一章短文本验证。

## 6. 项目技术定位

**交叉项目（桌面端前端 + AI 应用 + 本地数据）。** 依据是仓库同时包含 Vue/TypeScript 交互层、Tauri 跨平台运行时、文件型本地存储、电子书渲染/TTS，以及基于 DeepSeek function calling 的 Agent 创作链路。

## 7. 核心原理解析

### 7.1 分阶段副作用隔离

**问题 ->** AI 既要读取资料和前文，又可能修改故事动态状态；如果模型在调研阶段就能写盘，用户无法预览或撤销。

**机制 ->** `agentService.ts` 将会话拆为 planning、awaiting_confirmation、generating、finalizing 等阶段。规划阶段只传入 `READONLY_TOOLS`，生成结束后才在 finalizing 阶段传入 `SIDE_EFFECT_TOOLS`；用户还可以通过确认面板修改大纲，或通过 `AbortController` 取消会话。

**在本项目中的落点 ->** `src/services/agentService.ts` 的 `runPlanPhase`、`runGeneratePhase`，以及 `src/pages/novel/components/AgentPlanPanel.vue` 的可编辑确认界面。

### 7.2 工具调用的上下文收敛

**问题 ->** 章节前文、跨章节搜索结果、Lore 全文和故事状态都可能很长，直接塞入模型会造成 token 膨胀，也不利于控制工具职责。

**机制 ->** 每个工具统一返回 `{ ok, data?, error?, text }`，传给模型的是摘要文本；Lore 主要条目可加载截断后的正文，其他条目只返回索引信息；章节搜索限制返回条数，当前光标前文也有字符上限。

**在本项目中的落点 ->** `src/services/agentTools.ts` 的 `query_lore`、`search_chapters`、`read_context`、`read_story_state`。

### 7.3 文件型领域模型与增量更新

**问题 ->** 一本小说包含元数据、章节、Lore、角色静态档案和动态故事状态，全部塞在一个 JSON 中会导致读写范围过大、冲突边界不清。

**机制 ->** 小说元数据单独保存，章节正文按文件保存，Lore 采用索引和条目正文分离，故事状态再独立保存；保存服务负责创建目录、更新时间戳和必要的迁移。状态更新按角色名合并，时间线和伏笔按追加语义处理。

**在本项目中的落点 ->** `src/services/novelService.ts`、`src/services/loreService.ts`、`src/services/storyStateService.ts`。

### 7.4 统一语音客户端与阅读控制器

**问题 ->** Edge TTS 使用音频 URL、词边界和网络请求，Web Speech 使用浏览器合成事件；如果页面直接依赖其中一个实现，切换引擎会扩散修改。

**机制 ->** `TTSClient` 统一初始化、播放、暂停、恢复、停止、语音选择和语言能力；`TTSController` 负责阅读段落、SSML 标记、导航、高亮和取消；Pinia Store 把控制器事件桥接成页面可订阅的响应式状态。

**在本项目中的落点 ->** `src/services/tts/TTSClient.ts`、`src/services/tts/EdgeTTSClient.ts`、`src/services/tts/WebSpeechClient.ts`、`src/services/tts/TTSController.ts`、`src/store/ttsStore.ts`。

### 7.5 跨平台能力抽象

**问题 ->** Web、桌面和移动端的文件访问、目录、协议 URI 和系统能力不同，但上层阅读和小说服务不应分叉成多套业务代码。

**机制 ->** `BaseAppService` 抽象设置、文件和书籍相关能力；Web 与 Native 实现分别提供具体文件系统和平台能力，服务层通过 `useAppService` 获取当前实现。Tauri 配置和 Actions 再负责平台构建与发布。

**在本项目中的落点 ->** `src/services/appService.ts`、`src/services/nativeAppService.ts`、`src/services/webAppService.ts`、`src/services/environment.ts`。

## 8. 关键设计决策

| 决策                                  | 备选                         | 取舍                                                   | 风险                                   | 验证                                                 |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------- |
| 规划后人工确认再生成                  | 一次请求直接生成             | 多一步交互，但能预览和编辑大纲，降低错误写入风险       | 用户可能觉得流程变长                   | 对比确认率、取消率、重写率；当前数据待测             |
| 规划工具只读，状态更新放到 finalizing | 规划阶段允许直接更新状态     | 牺牲即时性，换取副作用边界清晰和可解释                 | 生成失败时状态可能没有更新             | 模拟生成中断、工具失败和重复调用，检查状态文件       |
| 文件型本地优先存储                    | 引入远端数据库或统一大 JSON  | 无需云服务，正文按文件可直接迁移；但缺少跨设备同步     | 文件损坏、并发写入和迁移需要额外治理   | 做断电写入、版本迁移、重复保存测试；当前结果待测     |
| Edge TTS 与 Web Speech 共用客户端接口 | 页面直接调用两个 SDK         | 上层稳定，能按平台能力切换；底层语义只能抽象到共同子集 | 不同引擎的边界事件和语音能力不完全一致 | 验证播放、暂停、恢复、停止、跨语言和高亮一致性       |
| 外部请求设置重试/预加载边界           | 无限重试或全部串行等待       | 兼顾启动速度和抖动容忍；仍可能增加网络和内存消耗       | 重试风暴、音频预加载过多               | 统计失败次数、重试次数、首句播放时间；当前指标待测   |
| 通过平台服务隔离文件访问              | 各页面自行调用 Tauri/Web API | 降低页面与运行时耦合，便于 Web 与桌面复用              | 抽象层遗漏平台特性                     | 在 Web、Tauri 桌面、移动端分别跑导入、保存和删除流程 |

## 9. 量化与验证（含待测，建议）

当前仓库未提供可直接引用的用户量、成功率、延迟、崩溃率或发布采用数据，简历和面试中不应自行补数字。建议建立以下验证记录：

1. **Agent 链路：** 建立包含 Lore、跨章节搜索和故事状态的样例小说，记录规划耗时、工具轮数、确认后生成耗时、取消成功率和状态更新成功率；结果记为待测。
2. **上下文控制：** 对比完整注入与摘要/截断注入的 token 数、首字延迟和输出一致性；重点验证 `query_lore` 的全文截断和章节搜索上限是否足够。
3. **本地存储：** 测试创建、连续保存、异常中断、版本迁移、重复导入和跨平台路径；记录数据丢失、损坏和恢复结果，当前为待测。
4. **TTS：** 在 Web、Tauri、不同语言和网络抖动下测试首句开始时间、连续播放完成率、预加载命中率、暂停恢复误差和高亮错位次数；当前为待测。
5. **阅读器：** 用 EPUB、PDF、MOBI 等代表格式验证打开耗时、分页切换、进度恢复、注释和朗读跨章节跳转；格式覆盖结果待补。
6. **跨平台发布：** 对 Actions 的构建产物做安装、启动、导入书籍、保存小说和自动更新冒烟测试；当前仓库能证明工作流配置，不能单凭配置证明每次构建均成功。
7. **个人贡献证据：** 补充负责模块、关键 PR/commit、问题单、截图、发布记录和用户反馈。没有这些材料时，使用“参与/实现了仓库中可见模块”而不是“主导/负责全链路”。
