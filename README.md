<div align="center">

```
██╗   ██╗███████╗██╗  ██╗
╚██╗ ██╔╝██╔════╝██║  ██║
 ╚████╔╝ ███████╗███████║
  ╚██╔╝  ╚════██║██╔══██║
   ██║   ███████║██║  ██║
   ╚═╝   ╚══════╝╚═╝  ╚═╝
```

**你的精神家园**

[![Build](https://github.com/Yang-Qinghuayi/YSH/actions/workflows/build.yml/badge.svg)](https://github.com/Yang-Qinghuayi/YSH/releases)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)

</div>

---

YSH 是一款本地优先的跨平台桌面应用，将电子书阅读、AI 辅助小说创作与世界观资料库管理整合在一起。所有数据存储在本地，不依赖任何云服务。

## 功能

### 电子书阅读

支持 EPUB、PDF、MOBI、AZW3、CBZ、FB2 格式。提供分页、双页、滚动三种阅读模式，以及划词高亮、笔记、书签等注释功能。阅读进度通过 CFI 标准精确记录，字体、字号、行高等排版参数均可自定义。

### 小说创作

基于 CodeMirror 6 的 Markdown 编辑器，支持多部小说并行管理与章节排序。在编辑器或章节概要中输入 `@角色名`（编辑器内置补全，输入 `@` 触发）即可强制指定该角色出场。AI 支持两种生成模式：按 Tab 在光标处续写一小段，或从章节概要出发由 Agent 规划后生成完整章节。

写完一章后点 Agent 面板顶部的「本章定稿」，Agent 依次：生成**章节概要** → 改写角色**短期记忆** → 判断是否需要改写**长期记忆** → 更新**整体进度**。顶部工具栏的「本章概要」可随时查看 / 手改当前章概要。

### Lore 资料库

结构化的世界观管理系统。条目按 Major / Important / Minor 三级重要度分类，条目可开关"是否进入 AI 上下文"。

### 人物记忆

一个人物只由两样东西记录：

| | 是什么 | 谁来写 | 存在哪 |
|---|---|---|---|
| **长期记忆（Skill）** | TA 是谁：性格、出身、外貌、信念、说话方式、别名、参考形象……一段自然语言 | 作者填写；发生重大事件（生死、背叛、顿悟、身份巨变…）后，定稿时 Agent 自动改写，每次改写都记日志，可在「故事状态」里回滚 | `novel.json` 的 `characters[].skill` |
| **短期记忆（POV）** | TA 此刻知道什么：以角色视角写的最近经历、已知信息、误解、处境与心绪 | 每章定稿时 Agent 为出场 / 得知新信息的角色整段改写；没出场的角色保持不变（信息差由此保留）；角色面板可手改 | `story-state.json` |

另有一段**整体进度**（主线梳理），由「已有整体进度 + 各章概要（含本章）」在定稿时重写。同一章重新定稿时，会先把记忆、整体进度和本章的 Skill 改写恢复到本章之前，再重新整理。

续写或写新章时，system prompt 会带上整体进度、每个角色的长期 / 短期记忆和 **POV 认知规则**：角色的言行与心理只能基于 TA 自己知道的信息，新得知的信息要在正文里写出得知的过程。

## AI 创作引擎

写作 AI 由自研的 Agent 状态机驱动，底层接入 DeepSeek API（OpenAI 兼容格式）。

```
idle → planning → awaiting_confirmation → generating → done
          │               │                    │
      工具调用循环      用户确认闸门         流式文本输出
     (只读，无副作用)  (大纲可编辑/取消)    (可随时中断)
                                 任一步骤可进入 canceled

「本章定稿」（作者手动触发，独立流水线 chapterFinalize.ts）：
章节概要 → 短期记忆 → 长期记忆（按需）→ 整体进度
```

- **planning**：Agent 自行调用只读工具调研（最多 12 轮，含渐进催促与"连续三轮重复"死循环检测），最后产出 `<<<PLAN>>>` 结构化规划。内联续写走轻量模式（4 轮、跳过确认）。
- **awaiting_confirmation**：弹出规划面板，大纲可直接编辑；确认后编辑结果会作为生成指令的一部分下发（不会被忽略）。
- **generating**：流式输出正文，逐字写入编辑器；被单次长度上限截断时自动续写（最多 2 次）。
- 写完正文**不会**自动更新记忆或摘要，统一在「本章定稿」时进行。章节概要写入 `ChapterMeta.summary`，作为后续章节规划时的「前情提要」。

**规划阶段工具**（只读）

| 工具 | 用途 |
|------|------|
| `query_lore` | 按关键词/重要度检索资料库（major 条目回正文，其余回索引） |
| `search_chapters` | 跨章节全文检索，回顾前文细节 |
| `read_story_state` | 读取整体进度与角色短期记忆 |
| `read_context` | 读取当前章节光标前约 2000 字上下文 |
| `select_characters` | 选定本章出场角色，返回完整长期记忆（Skill）+ 短期记忆（POV） |

**定稿工具**（有副作用，仅「本章定稿」使用）

| 工具 | 用途 |
|------|------|
| `update_short_term_memory` | 以角色视角整段改写短期记忆（只改提交的角色） |
| `update_long_term_memory` | 重大事件后改写某角色的 Skill（自动写入、记日志、可回滚） |

上下文管理：system prompt 常驻「小说简介 + 整体进度 + 人物（Skill 摘要 + 短期记忆）+ POV 规则 + 前情提要」，Lore 与正文细节由工具按需检索；每次请求前做 token 预算检查，超限时丢弃最旧的调研结果（保留 system、章节概要最近轮次，且不拆散工具调用配对）。

模型与降级：`deepseek-chat` 支持 Function Calling，走完整工具循环；`deepseek-reasoner` 官方不支持工具调用，选择后自动降级为「无工具模式」——直读完整 Skill、短期记忆与资料库（major 全文）进 prompt；定稿时记忆更新改用 `<<<MEMORY>>>` JSON 协议，解析后交给同一套定稿工具执行。

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端框架 | Vue 3.5 + TypeScript 6 + Vite 8 |
| UI 组件库 | Vuetify 4 (Material Design 3) + Tailwind CSS v4 |
| 状态管理 | Pinia 3 |
| 桌面运行时 | Tauri 2 (Rust) |
| 电子书引擎 | foliate-js（内嵌） |
| AI 接入 | DeepSeek API |
| 编辑器 | CodeMirror 6 |

## 快速开始

**前置要求**

- Node.js ≥ 20
- pnpm ≥ 9
- Rust stable（仅构建桌面版时需要）

**安装依赖**

```bash
pnpm install
```

**配置 AI**

在应用设置页面填入 DeepSeek API Key，或在项目根目录创建 `.env.local`：

```env
VITE_DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
```

**启动开发**

```bash
# Web 模式
pnpm dev

# Tauri 桌面模式
pnpm dev-tauri
```

**构建**

```bash
pnpm build          # Web，输出至 dist/
pnpm build-tauri    # 桌面，打包当前平台
```

**测试**

```bash
pnpm test           # 协议解析 / 人物记忆 / 角色迁移 / 上下文预算 + Agent 主循环与「本章定稿」端到端
```

`tests/` 使用 Node 内建 test runner（零测试依赖）。其中 `*.e2e.test.ts` 会驱动真实的
`agentService` / `agentChat` / `chapterFinalize` / `agentTools` / `storyStateService` 跑完整链路（规划 → 确认 → 生成；定稿四步），
只把三个模块替换为替身：`openai`（网络边界，改由脚本化的假模型驱动）、`@/hooks/useEnv`（内存
文件系统）、`@/services/workspaceService`（固定路径）——因此不联网、不写真实磁盘。

## 发布

### Web（Vercel）

仓库根目录已带 `vercel.json` + `.vercelignore`，在 <https://vercel.com/new> 导入本仓库即可（Framework 自动识别为 Vite，构建命令 `pnpm run build`，产物目录 `dist`，Node 22）。也可用 CLI：`npx vercel --prod`。
详细步骤与上线注意事项见 [`docs/vercel-deploy.md`](docs/vercel-deploy.md)。

### 桌面端

推送到 `ysh` 分支自动触发 GitHub Actions，并发布至 Releases：

| 平台 | 产物 |
|------|------|
| macOS (Apple Silicon) | `.dmg` |
| Windows x64 | `.msi` / `.exe` |
| Linux x64 | `.AppImage` / `.deb` |

## 项目结构

```
src/
├── pages/
│   ├── book/           # 电子书阅读器
│   ├── library/        # 图书馆管理
│   ├── novel/          # 小说创作工坊
│   ├── lore/           # Lore 资料库
│   └── setting/        # 应用设置
├── services/
│   ├── agentService.ts      # Agent 状态机与 tool-use 循环
│   ├── agentChat.ts         # Agent 交互面板（多轮对话）
│   ├── chapterFinalize.ts   # 「本章定稿」流水线：概要 → 短期记忆 → 长期记忆 → 整体进度
│   ├── agentProtocol.ts     # PLAN/MEMORY 协议解析、循环守卫（纯函数）
│   ├── agentTools.ts        # AI 工具集定义
│   ├── contextBudget.ts     # 上下文预算裁剪（纯函数）
│   ├── storyMemory.ts       # 人物记忆 / 整体进度 / 定稿快照（纯函数）
│   ├── characterMigration.ts # 旧角色结构 → { name, skill } 迁移（纯函数）
│   ├── deepseekService.ts   # DeepSeek API 封装
│   ├── novelService.ts      # 小说数据读写
│   └── loreService.ts       # Lore 数据读写
├── store/              # Pinia 状态管理
├── types/              # TypeScript 类型定义
├── hooks/              # Vue Composables
└── foliate-js/         # 内嵌电子书渲染引擎
```

## 数据存储

所有数据存储在本地，无云同步。**一个文件夹就是一部小说**：在"打开你的小说"向导里选定的目录即小说根，未指定时回退到 App Data。

```
{小说文件夹}/
├── novel.json              # 元数据、角色（name + 长期记忆 skill）、章节列表（含概要、定稿时间与字数）
├── chapters/001_第一章.md   # 章节正文
├── lore/
│   ├── lore.json           # 条目索引（名称/重要度/简介/关键词/开关）
│   └── entries/*.md        # 条目正文
└── story-state.json        # 整体进度、角色短期记忆、长期记忆改写日志、定稿快照
```

旧版数据会自动迁移：角色的 `profile` / 别名 / 文学形象参考等字段并入 `skill`；旧格式的 `story-state.json`（心情/位置/伤势/关系/时间线/伏笔）备份为 `story-state.v1.bak.json` 后按空状态处理。

DeepSeek API Key 默认保存在本机存储（可在设置里关闭"记住"，改为仅本次会话有效）；除 `api.deepseek.com` 外不会发往任何服务。Web 部署形态请使用受限或限额 Key。
