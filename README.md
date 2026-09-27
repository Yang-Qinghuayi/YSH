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

基于 CodeMirror 6 的 Markdown 编辑器，支持多部小说并行管理与章节排序。在编辑器或章节概要中输入 `@角色名`（编辑器内置补全，输入 `@` 触发）即可把该角色档案作为强制指定注入 AI 上下文。AI 支持两种生成模式：按 Tab 在光标处续写一小段，或从章节概要出发由 Agent 规划后生成完整章节。

### Lore 资料库

结构化的世界观管理系统。条目按 Major / Important / Minor 三级重要度分类，条目可开关"是否进入 AI 上下文"。角色信息分为两层：静态档案（`profile` 角色描述、别名、文学形象参考）与动态状态（心情/位置/伤势/持有物/关系），前者存 `novel.json`，后者存 `story-state.json`。

## AI 创作引擎

写作 AI 由自研的 Agent 状态机驱动，底层接入 DeepSeek API（OpenAI 兼容格式）。

```
idle → planning → awaiting_confirmation → generating → finalizing → done
          │               │                    │             │
      工具调用循环      用户确认闸门         流式文本输出   状态/摘要更新
     (只读，无副作用)  (大纲可编辑/取消)    (可随时中断)   (可随时中断)
                                       任一步骤可进入 canceled
```

- **planning**：Agent 自行调用只读工具调研（最多 12 轮，含渐进催促与"连续三轮重复"死循环检测），最后产出 `<<<PLAN>>>` 结构化规划。内联续写走轻量模式（4 轮、跳过确认）。
- **awaiting_confirmation**：弹出规划面板，大纲可直接编辑；确认后编辑结果会作为生成指令的一部分下发（不会被忽略）。
- **generating**：流式输出正文，逐字写入编辑器；被单次长度上限截断时自动续写（最多 2 次）。
- **finalizing**：增量更新角色动态状态（只覆盖提交过的字段，不会清空未提交字段），并按开关生成章节摘要写入 `ChapterMeta.summary`，作为后续章节规划时的「前情提要」。

**规划阶段工具**（只读）

| 工具 | 用途 |
|------|------|
| `query_lore` | 按关键词/重要度检索资料库（major 条目回正文，其余回索引） |
| `search_chapters` | 跨章节全文检索，回顾前文细节 |
| `read_story_state` | 读取角色动态状态、时间线、伏笔 |
| `read_context` | 读取当前章节光标前约 2000 字上下文 |
| `select_characters` | 选定本章要调用的角色档案，返回写作指导 |

**收尾阶段工具**（有副作用）

| 工具 | 用途 |
|------|------|
| `update_story_state` | 增量更新角色状态、追加时间线与伏笔 |

上下文管理：system prompt 常驻「小说简介 + 可用角色档案 + 前情提要 + 故事状态」，Lore 与正文细节由工具按需检索；每次请求前做 token 预算检查，超限时丢弃最旧的调研结果（保留 system、章节概要最近轮次，且不拆散工具调用配对）。

模型与降级：`deepseek-chat` 支持 Function Calling，走完整工具循环；`deepseek-reasoner` 官方不支持工具调用，选择后自动降级为「无工具模式」——直读故事状态与资料库（major 全文）进 prompt，状态更新改用 `<<<STATE>>>` JSON 协议解析后复用同一套合并逻辑。

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
pnpm test           # 30 个用例：协议解析 / 状态合并 / 上下文预算 + Agent 主循环端到端
```

`tests/` 使用 Node 内建 test runner（零测试依赖）。其中 `agentService.e2e.test.ts` 会驱动真实的
`agentService` / `agentTools` / `storyStateService` 跑完整链路（规划 → 确认 → 生成 → 收尾），
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
│   ├── agentProtocol.ts     # PLAN/STATE 协议解析、循环守卫（纯函数）
│   ├── agentTools.ts        # AI 工具集定义
│   ├── contextBudget.ts     # 上下文预算裁剪（纯函数）
│   ├── storyStateMerge.ts   # 故事状态增量合并（纯函数）
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
├── novel.json              # 元数据、角色静态档案、章节列表（含摘要与字数）
├── chapters/001_第一章.md   # 章节正文
├── lore/
│   ├── lore.json           # 条目索引（名称/重要度/简介/关键词/开关）
│   └── entries/*.md        # 条目正文
└── story-state.json        # 角色动态状态、时间线、伏笔
```

DeepSeek API Key 默认保存在本机存储（可在设置里关闭"记住"，改为仅本次会话有效）；除 `api.deepseek.com` 外不会发往任何服务。Web 部署形态请使用受限或限额 Key。
