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

支持 EPUB、PDF、MOBI、AZW3、CBZ、FB2 格式。提供分页、双页、滚动三种阅读模式，以及划词高亮、笔记、书签等注释功能。阅读进度通过 CFI 标准精确记录，字体、字号、行高等排版参数均可自定义。内置 Edge TTS 与 Web Speech API 双引擎朗读。

### 小说创作

基于 CodeMirror 6 的 Markdown 编辑器，支持多部小说并行管理与章节排序。在编辑器中使用 `@角色名` 可将人物档案注入 AI 上下文。AI 支持两种生成模式：在光标处续写，或从章节简介出发由 Agent 规划后生成完整章节。

### Lore 资料库

结构化的世界观管理系统。条目按 Major / Important / Minor 三级重要度分类，AI 生成时按重要度自动引用相关内容。角色档案将静态信息（性格、背景、外貌、文风）与动态状态（当前位置、时间线事件）分离存储。

## AI 创作引擎

写作 AI 由自研的 Agent 状态机驱动，底层接入 DeepSeek API（OpenAI 兼容格式）。

```
idle → planning → awaiting_confirmation → generating → done
          │               │                    │
      工具调用循环      用户确认闸门         流式文本输出
     (只读，无副作用)  (可预览 / 取消)     (可随时中断)
```

**Planning 阶段**（只读工具，无副作用）

| 工具 | 用途 |
|------|------|
| `read_context` | 读取章节上下文与故事状态 |
| `search_lore` | 按关键词检索 Lore 资料库 |
| `list_characters` | 枚举活跃角色档案 |

**Generating 阶段**

| 工具 | 用途 |
|------|------|
| `update_story_state` | 更新角色动态状态与场景位置 |

上下文注入优先级：`光标前文本` > `@提及角色档案` > `Major Lore` > `Important Lore` > `故事状态` > `Minor Lore`

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
| TTS | Edge TTS / Web Speech API / HLS.js |

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

## 发布

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
│   ├── agentService.ts      # Agent 状态机
│   ├── agentTools.ts        # AI 工具集定义
│   ├── deepseekService.ts   # DeepSeek API 封装
│   ├── novelService.ts      # 小说数据读写
│   ├── loreService.ts       # Lore 数据读写
│   └── tts/                 # TTS 多引擎实现
├── store/              # Pinia 状态管理
├── types/              # TypeScript 类型定义
├── hooks/              # Vue Composables
└── foliate-js/         # 内嵌电子书渲染引擎
```

## 数据存储

所有数据存储在本地，无云同步：

```
{App Data}/Data/
├── novels/
│   └── {id}/
│       ├── novel.json        # 元数据与角色列表
│       ├── chapters/*.md     # 章节正文
│       └── lore/
│           ├── lore.json     # 条目索引
│           └── entries/*.md  # 条目正文
├── settings.json
└── library.json
```
