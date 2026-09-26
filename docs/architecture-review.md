# YSH 架构评审与清理报告

> 评审日期：2026-09-26 · 范围：`src/`（不含 vendored 的 `src/foliate-js`）、构建配置、依赖清单
> 基线验证：`pnpm build` ✅ · `node --test` 30/30 ✅ · `tsc --noEmit` 无新增错误 ✅

YSH 由两个上游项目杂交演化而来：电子书阅读器 **Readest**（services/types/utils 骨架）和一个**网易云音乐播放器模板**（Headline/Title/CardRow、歌词、miniPlayer、虚拟滚动等）。本次清理的核心就是摘除这两条谱系留下的死组织，并修复早已断掉的工程化链路。

---

## 一、已删除的冗余代码（净 -6700 行）

### 1.1 整文件死代码（26 个文件）

每个文件删除前都做了全仓库引用图扫描（import 语句 + Vue 模板标签 PascalCase/kebab-case 双写法 + 动态 import + tests 目录交叉核对）。

| 文件 | 行数 | 死因 |
|---|---|---|
| `components/Headline.vue` / `Title.vue` / `layout/CardRow.vue` / `toggle/DrawerToggle.vue` | 4 组件 | 无任何模板/路由引用（unplugin-vue-components 自动注册口径下依然无引用） |
| `pages/letter/index.vue` | 95 | 路由整段被注释，唯一消费 html2canvas 的页面 |
| `pages/novel/components/NovelList.vue` | 222 | `novel/index.vue` 自建了小说列表 UI，此组件成孤儿 |
| `utils/fn.ts` | 308 | 音乐模板遗留工具集（formatLyric/toHttps/downloadFile…），零引用 |
| `utils/icons.ts` | 55 | 音乐播放器图标（repeat/shuffle/mdiNetEase），零引用 |
| `utils/ua.ts` | 65 | WebView UA 解析，零引用 |
| `utils/service.ts` | 59 | 缓动函数库，唯一消费者是已死的 CardRow |
| `utils/animationData.json` + `utils/lottie-assets/*.json` ×3 | — | Lottie 动画数据，但项目从未安装 lottie 依赖 |
| `assets/gpt.svg`、`assets/netease-outline.svg` | — | 无引用素材（后者直接暴露音乐模板出身） |
| `directives/index.ts` | 16 | `v-visible` 指令全仓库零使用，却仍在 main.ts 全局注册 |
| `hooks/useMainSize.ts` / `useScrollToTop.ts` | 47 | 零引用 |
| `hooks/useBreakpoint.ts` / `useResponsiveGrid.ts` / `useElementScrollSize.ts` | — | 死链：仅被已死的 CardRow 使用，形成「死文件 → 死 hook → 死 hook」引用链 |
| `plugins/dayjs.ts` | 28 | 注册了 `$dayjs` 全局属性，模板零使用；dayjs 仅剩此死链引用 |
| `types.ts`（根）/ `types/misc.ts` / `types/user.ts` | — | 空接口 / Insets、LocaleWithTextInfo 零引用 / 配额类型仅被死常量引用 |
| `.env` | — | `VITE_DEV_SERVER_*` 无任何消费者（vite.config 不读，tauri.conf 写死端口） |

### 1.2 死导出修剪（约 60 个符号）

保留文件本身（仍有活代码），删除其中从未被消费的导出：

- **`services/constants.ts`**：`BOOK_UNGROUPED_*`、`BOOK_IDS_SEPARATOR`、`DOWNLOAD_READEST_URL`、`READEST_WEB_BASE_URL`、`READEST_UPDATER_FILE`、`READEST_CHANGELOG_FILE`、`GITHUB_LATEST_DOWNLOAD`、`SYNC_*_INTERVAL_SEC` ×3、`CHECK_UPDATE_INTERVAL_SEC`、`DEFAULT_STORAGE_QUOTA`、`HIGHLIGHT_COLOR_HEX`、`CUSTOM_THEME_TEMPLATES`、`MIGHT_BE_RTL_LANGS` —— 一整块 Readest 云同步/更新器时代的遗骸
- **`utils/book.ts`**：`isBookFile`、`formatPublisher`、`formatLanguage`、`formatSubject`、`getCurrentPage`、`getBookDirFromWritingMode`、`getBookDirFromLanguage`（连带 `langCodeToLangName` 与随之悬空的 `SUPPORTED_LANGS`/`BookProgress`/`WritingMode`/`rtl` 导入）
- **`utils/window.ts`**：7 个窗口控制函数（最小化/最大化/置顶/焦点监听…）——阅读界面根本没有自绘标题栏，这些是模板遗留
- **`utils/transfer.ts`**：`webUpload/webDownload/tauriUpload/tauriDownload` + `UploadMethod`。125 行 → 9 行，只剩真正被 `appService`/`types/system` 使用的 `ProgressHandler` 类型（注意：Rust 侧对应命令未动，因为本环境无 cargo 无法验证）
- **`utils/bridge.ts`**：`installPackage`、`setSystemUIVisibility`、`getStatusBarHeight` 及其专属接口（Android 遗留）
- **其余**：`utils/md5.ts`（isMd5/md5Fingerprint）、`utils/misc.ts`（uniqueId/randomMd5/getUserLocale）、`utils/rtl.ts`（getDirFromUILanguage）、`utils/serializer.ts`（compressConfig）、`utils/shortcuts.ts`（saveShortcuts）、`utils/style.ts`（getFootnoteStyles）、`utils/toc.ts`（findTocItemBS）、`libs/document.ts`（DocumentFile）、`workspaceService.ts`（clearWorkspaceDir）
- **类型**：`types/book.ts`（BookGroupType/BooknoteGroup/BookDataRecord/BooksGroup——分组与云同步模型）、`types/lore.ts`（ENTRY_IMPORTANCE_COLORS）、`types/novel.ts`（DeepSeekConfig，实际配置走 setting store）、`types/settings.ts`（ThemeType）
- **SystemSettings 类型漂移修复**：`keepLogin`、`autoUpload`、`alwaysOnTop`、`autoCheckUpdates`、`screenWakeLock`、`lastSyncedAt*` ×3、`libraryViewMode`、`librarySortBy`、`customThemes` 等字段**只存在于默认值/接口声明，无任何读取方**，且其中数个本就不在类型声明里（正是基线 tsc 报错的原因）。已全部移除，**顺手消灭了 2 个基线 tsc 错误**

### 1.3 样式与模板死代码

- **`animate.scss` 320 行 → 78 行**：删除 `page`/`loader`/`slide-fade-y`/`card-animation`/`btn-animation`/`slide-left`/`slide-right`/`pop` 转场（无一模板使用）、`waveAnimation`/`lyric`/`bounce`(定义了两次!)/`pulseWarn`/`loaderAnimation` 关键帧、5 组 `[data-aos]` 选择器（AOS 库根本没装）。保留的 4 组转场名逐一与模板 `<transition name>` 核对
- **`global.scss`**：删除零消费者 token `--font-mono`、`--radius-ui`、`--radius-pill`
- **`index.html`**：删除指向不存在文件的 `apple-touch-icon`、`mask-icon`，以及从未被脚本添加的 `.chromeframe` 样式块
- **`main.ts`**：移除 `GesturePlugin`（模板零手势指令）、`VueVirtualScroller`（唯一使用者是死页面）、`useDirectives`、`useDayjs`、全局 `$t`（模板 0 处使用）

### 1.4 依赖清理（13 个包）

`html2canvas`、`@vueuse/gesture`、`dayjs`、`vue-virtual-scroller`、`overlayscrollbars`、`@vueuse/components`、`lodash-es` + `@types/lodash-es`、`md5` + `@types/md5`（与实际使用的 `js-md5` 重复装了两套 md5！）、`vite-plugin-pwa`、`vite-plugin-resolve`、`vite-plugin-spa-loading`（后三者连 vite.config 都没引）。

### 1.5 工程链路修复（本来是坏的）

| 问题 | 修复 |
|---|---|
| `.eslintrc.js` 用 CommonJS 写法 + `"type": "module"` → **ESLint 完全无法加载，`npm run lint` 必挂** | 改名 `.eslintrc.cjs` |
| 配置引用 `eslint-plugin-import`、`simple-import-sort`、`prettier`、`vue`、`vue-eslint-parser` 等 **6 个从未安装的包** | 补齐 devDependencies |
| `src/foliate-js`（3 万行 vendored 阅读引擎）在 lint 范围内 → ESLint 跑 15 分钟超时 | 加入 `ignorePatterns` |
| **无 `.prettierrc`** → prettier 按默认双引号风格与代码库主流单引号打架（3000+ 幻影错误） | 新增 `.prettierrc`，固化现状主流风格（单引号/分号/宽 100） |
| `vite.config.ts` 里 `loadEnv()` 结果从未使用、`mode: mode` 冗余 | 移除 |
| `tsconfig.json` 的 `@shared/*` 别名指向不存在的目录 | 移除 |
| `utils/misc.ts`、`utils/txt.ts` 正则里的无用转义（`\(`、`\[`、`\/`）与裸全角空格 | 修复转义，全角空格改写为自documenting 的 `\u3000`（行为等价性已用 node 验证） |

### 1.6 验证结论

- `pnpm build`（web 模式）通过，产物正常
- `node --test tests/*.test.ts` 30/30 通过
- `tsc --noEmit`：13 个错误，全部为基线既有的 `moduleResolution: node` 导致的 `.vue` 模块解析与 `NativeFile.stream` 泛型问题，**无新增**（且较基线净减 2-3 个）
- dev server 启动，全部页面模块按需编译 HTTP 200
- 改动过的每个文件 ESLint 0 error 0 warning

---

## 二、结构上不够优雅的地方（分析 + 建议）

以下问题**本轮未动**（改动风险/验证成本超出删除死代码的范畴），但值得排期处理：

### 2.1 `pages/novel/index.vue` 是一个 1315 行的上帝组件 ⭐ 最重要

一个文件同时负责：工作区初始化、小说 CRUD、章节 CRUD、自动保存、Agent 会话编排（plan/generate/abort 全流程）、lore 面板联动、角色状态、导入、全局搜索、快捷键、错误提示……script 段约 950 行。

**建议拆法**（模板可以不动，纯逻辑下沉，风险可控）：
```
pages/novel/
  composables/
    useNovelWorkspace.ts   # 工作区就绪/切换小说/导入
    useChapterActions.ts   # 章节 CRUD + 字数统计 + 自动保存
    useAgentSession.ts     # Agent 会话生命周期（novel/index 里 ~300 行）
    useLoreSidebar.ts      # lore chip 缓存与定位
  index.vue                # 只剩组装与布局
```
判据：现在 `agentStore` 已经存在，但会话的编排状态（`agentSession`、`chapterBrief`、回调闭包）仍散落在页面里，store 只收了结果。把「会话编排」整体沉进 composable/store，页面才可能回到 300 行以内。

### 2.2 两个几乎同名的 store：`setting` vs `settingsStore`

- `store/setting.ts` → `useSettingStore`：UI 首选项（语言/调色板/字体/工作区），localStorage 持久化
- `store/settingsStore.ts` → `useSettingsStore`：阅读器 `SystemSettings`（文件持久化，经 appService）

命名只差一个复数，语义却完全不同，新人极易混用（事实上 `useViewSettings` 又是第三层「视图设置」）。**建议**重命名为 `usePreferencesStore`（或 `uiSettingsStore`）与 `useReaderSettingsStore`，一次性全局替换，编译器保证不漏。

### 2.3 i18n 的三条通道与「第二真相源」

- `main.ts` 的全局 `$t`（本轮已删——零使用）
- `utils/i18n.ts` 的 `useI18n()`（自称「兼容 vue-i18n 的 shim」）
- `hooks/useTranslation.ts` 在 `useI18n` 外再包一层 namespace + fallback

`getCurrentLocale()` 为了避免循环依赖**直接 `JSON.parse(localStorage.getItem('setting'))`**——语言状态存在两份真相（store 与裸 localStorage），store 的 `mergeDefaults` 结构一旦变化 i18n 就静默失效。**建议**：把 locale 通过 pinia 依赖注入（main.ts 先装 pinia 再挂 i18n 插件即可，不存在循环），删掉 `useTranslation` 这层壳，统一走 `useI18n`。

### 2.4 调色板存在 CSS / TS 双份定义

同一套 Material You 调色板：
- `styles/global.scss`：4 组静态 CSS 变量（`data-palette` 选择器切换）
- `utils/materialYou.ts`：`getMaterialYouVars(seed)` 用同一算法再生成一遍 + `paletteSeedMap` 给每个调色板配种子

当 `seedEnabled=true`（默认）时内联样式覆盖 CSS；关闭种子时回落到 CSS 静态值。两份数据没有单一来源，改色板要改两处且无法保证视觉一致。**建议**：以 TS 算法为唯一来源，应用启动时（main.ts，mount 之前）同步生成一次变量写入 `:root`，删除 global.scss 里 4 组静态块，只保留 `--font-sans` 等结构 token，顺带解决闪色（FOUC）问题。

### 2.5 `services/constants.ts` 仍是 595 行的杂物箱

删完死常量后，里面同时住着：电子书格式、阅读默认值、6 个平台的字体清单（`WINDOWS_FONTS` 70 行、`MACOS_FONTS` 90 行…）、CJK 正则、缩放常量、翻译语言表。**建议**按域拆为 `constants/fonts.ts`、`constants/defaults.ts`、`constants/i18n.ts`，或至少把平台字体清单移到懒加载模块（它们只在设置页用到）。

### 2.6 hooks 的「隐式自动导入」与显式导入混用

`unplugin-auto-import` 对 `src/hooks` 目录做了全量自动注册，于是同一个 `useDialogEsc` 在 novel/index.vue 里是**显式 import**，在别的文件里又是**凭空出现**。两种范式并存让引用追踪变难（本次死代码排查就被迫做了双向核对）。**建议**二选一：要么从 AutoImport 的 `dirs` 里去掉 hooks 全部显式导入（推荐，tree-shaking 与跳转都更可控），要么全部依赖自动导入并删掉显式语句。

### 2.7 目录分类学：`utils` / `libs` / `services` / `helpers` 职责模糊

- `helpers/` 只有 1 个文件（openWith.ts）
- `libs/document.ts` 其实是「文档格式加载器 + 类型」，`libs` 与 `utils` 边界全凭感觉
- `utils/` 里既有纯函数（misc/rtl）也有 400 行的 `file.ts`（Tauri FS 封装，更像 service）和 366 行的 `txt.ts`（完整的 TXT→EPUB 转换器，其实是 domain service）

**建议**的归位原则：`utils/` 只留无状态纯函数；`txt.ts`、`file.ts` 移入 `services/`；`helpers/openWith.ts` 并入 `services/`；`libs/` 保留给第三方胶水（foliate 的 TS 包装）。改动是纯移动 + 路径替换，风险低但 diff 大，适合单独一个 PR。

### 2.8 Rust 侧疑似死插件（需 cargo 验证，本轮未动）

前端源码中 **零调用** 的 Tauri 插件：`plugin-haptics`（触觉反馈）、`plugin-websocket`（AI 走的是 openai SDK/fetch）、`plugin-shell`、`plugin-log`。它们仍在 `Cargo.toml`、`lib.rs` 注册与 capabilities 里。卸载可减编译体积，但必须在装有 Rust 工具链的环境跑 `cargo check && pnpm tauri build` 验证后再删。同理 `src-tauri/plugins/tauri-plugin-native-bridge` 里的 `install_package`/`set_system_ui_visibility`/`get_status_bar_height` 三个命令的前端调用已删，Rust 命令可一并退役。

### 2.9 其他小项

- **深色模式脱节**：`global.scss` 末尾的 `@media (prefers-color-scheme: dark)` 只硬编码覆盖 `--background/--foreground` 两个变量，绕过了整套调色板体系，深色下色板其余变量仍是浅色值，视觉上靠 Vuetify theme 兜底。建议并入 2.4 一并重构。
- **`environment.ts` 的 Readest 残留**：`window.__READEST_CLI_ACCESS`、`hasCli()` 只服务于 `helpers/openWith` 的 CLI 打开流程，若确认不需要「命令行传文件」功能可整体退役。
- **导航项 i18n 不一致**：`useNavItems` 里「书籍」「写作」硬编码中文，其余走 `t()`。
- **`pre-commit` 钩子被整行注释**：lint-staged 形同虚设。工具链修好后建议恢复，否则 prettier/eslint 配置会再次腐烂。
- **组件局部 `<style>` 与 utility.scss 的边界**：`utility.scss` 的 `.lg-*` 类被 novel 系组件共享（合理），但 `.char-panel` 这种单一组件的样式钩子放全局文件里，建议随组件走。

---

## 三、数字总结

| 指标 | 清理前 | 清理后 |
|---|---|---|
| 源码行数（不含 foliate-js） | ~28,700 | ~22,000（净 -6,700） |
| 死文件 | 26 | 0 |
| 死导出符号 | ~60 | 0 |
| npm 依赖 | 46 | 33 |
| `npm run lint` | 直接报错崩掉 | 可用（eslint+prettier+tsc） |
| 基线 tsc 错误 | 15-16 | 13（无新增） |
