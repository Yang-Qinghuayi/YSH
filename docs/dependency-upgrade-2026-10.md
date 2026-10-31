# 依赖治理执行记录（2026-10）

> 对应报告：[`dependency-audit.md`](./dependency-audit.md)（2026-10-27 体检）
> 范围：报告 Wave 0–3 **全部执行**，唯一例外是用户明确要求跳过的「字体本地化」。
> 环境：Node 22.22.3 · pnpm 10.34.9 · Vite 8（Rolldown）· Vue 3.5.44 · Vuetify 4.3.1 · TypeScript 6

---

## 1. 结果总览

| 指标                                |                  治理前（报告基线） |                       治理后 | 变化                |
| ----------------------------------- | ----------------------------------: | ---------------------------: | ------------------- |
| 首屏（`index.html` 引用的全部资源） |          1,459,671 B / 377,573 B gz | **646,303 B / 214,722 B gz** | **-55.7% / -43.1%** |
| 首屏 gzip 绝对值                    |                            368.7 KB |                 **209.7 KB** | -159.0 KB           |
| `dist/` 总大小                      |                               13 MB |                  **4.98 MB** | -62%                |
| 全量 CSS（所有 chunk 之和）         |             590,965 B / 86,817 B gz |      281,011 B / 45,403 B gz | -52% / -48%         |
| 全量 JS（所有 chunk 之和）          |          2,407,783 B / 787,375 B gz |   2,095,227 B / 708,815 B gz | -13% / -10%         |
| 构建耗时（`vite build --mode web`） |                             22.81 s |                   **10.0 s** | -56%                |
| `node_modules`                      |                     381 MB / 972 包 |                   **308 MB** | -73 MB              |
| ESLint                              | 无法启动（配置与 ESLint 10 不兼容） |          0 error / 0 warning | ✅                  |
| `vue-tsc --noEmit`                  |                       13 个既有错误 |                        **0** | ✅                  |
| `node --test tests/*.test.ts`       |                             73 通过 |       **79 通过**（+6 新增） | ✅                  |

> 首屏 gzip 目标「≤ 240 KB」达成（209.7 KB）。

---

## 2. Wave 0 —— 清僵尸依赖（机械改动）

**JS 侧删掉的包**：`vue-toastification`、`tinycolor2`、`commitizen` + `cz-conventional-changelog`、`codemirror`（元包，实际只用 `@codemirror/*` 子包）、`@vitejs/plugin-vue-jsx`、`openai`、`tailwindcss` + `@tailwindcss/postcss` + `postcss`、`autoprefixer`、`eslint-plugin-import`、`@typescript-eslint/*`（并入 `typescript-eslint`）、`@vue/eslint-config-typescript`。

**替换**：

- `vue-toastification` → 自写 `src/plugins/toast.ts` + `src/components/ToastHost.vue`（纯 CSS，内联 MDI path，无额外依赖，首屏 0 成本）。原包 2021 年后停更，且会往首屏塞 15.8 KB CSS。
- `openai` SDK → `src/services/deepseekService.ts` 用 `fetch` + SSE 手写流式客户端，类型抽到 `src/types/llm.ts`（省 31.6 KB gzip，顺带去掉 SDK 的 Node 兼容层）。
- 死代码 `appService.uploadFileToCloud` / `downloadCloudFile` / `downloadBook` 及 `src/utils/transfer.ts` 一并删除。

**配置残留**：

- `.eslintrc.cjs` → `eslint.config.js`（ESLint 10 flat config）。
- `tailwind.config.js`、`src/styles/tailwind.css` 删除。
- `.husky/pre-commit` 从 husky v8 写法改成 v9 写法，并真正接上 `lint-staged`（原来那行是注释）。
- `.prettierignore` 新增，把 `src/foliate-js`（vendored 上游代码）与生成文件排除，避免格式化污染上游 diff。
- `tsconfig.json`：`moduleResolution` `node` → `Bundler`（Vite 项目正确取值），并开启 `skipLibCheck`，一次性消掉 Vuetify 4 的 `.d.ts` 噪音。
- `lint:ts` / `typecheck` 由 `tsc` 改为 `vue-tsc`（`tsc` 根本不认识 `.vue`，原来的检查形同虚设）。
- 图标：`YQHS.jpg`（683 KB）删除，改为 `favicon.png` / `apple-touch-icon.png`（PNG8 调色板量化，28 KB → 4.9 KB）/ `icon-512.webp`。
- vendored pdf.js 的 `pdf.mjs.map`（1.67 MB）+ `pdf.worker.mjs.map`（5.24 MB）删除，并去掉 `pdf.mjs` / `pdf.worker.mjs` 末尾悬空的 `sourceMappingURL`。

---

## 3. Wave 1 —— 升级 + 首屏瘦身

### 3.1 版本

patch/minor 全线升级，几个必须成组上 majors：`pinia` 4、`vue-router` 5、`@vueuse/core` 15、`vuetify` 4、`vite` 8、`eslint` 10 + `typescript-eslint` 8、`lint-staged` 17、`husky` 9。运行时依赖全部从 `devDependencies` 挪到 `dependencies`。

> TypeScript 停在 6.x：`typescript-eslint` 的 peer 仍是 `<6.1.0`，升 7 会直接破坏 lint 链。

### 3.2 Vuetify 按需

- `vite.config.ts`：`vuetify({ autoImport: true })`，组件 / 指令 / 样式由 `vite-plugin-vuetify` 按需注入。
- `src/plugins/vuetify.ts`：不再 `import 'vuetify/styles'`（301 KB），改为 `vuetify/lib/styles/core.css`（19.8 KB）+ **生成的工具类子集**。
- `scripts/gen-vuetify-utilities.mjs`：扫描 `src`（跳过 `src/foliate-js`）里 `class="…"`、`:class="…"` 字符串字面量、`class: '…'` 收集实际用到的类名，再到 `npx @material/…` 之外的 `vuetify/lib/styles/utilities.css`（240 KB / 4,100 条规则）里逐条筛选，保留 `@layer` / `@media` 顺序重写。
  **结果：76 条规则 / 7,071 B**。新增工具类后需要重跑该脚本。

### 3.3 Tailwind → Vuetify utility

20 个 `.vue` 文件的工具类全部换成 Vuetify 4 的 M3 类名（`text-h6` → `text-title-large`、`text-body-2` → `text-body-medium`、`gap-2` → `ga-2`、`rounded-full` → `rounded-pill`…），Tailwind 专属效果（玻璃拟态、视口高度、TOC 面板）落到同文件 `<style scoped>`。

> **2026-10-30 反转**：这一节的方向已撤回，工具类重新统一到 Tailwind v4。
>
> - 接入方式：`@tailwindcss/vite` 插件（**没有**引入 `@tailwindcss/postcss` / `postcss` / `autoprefixer`），入口 `src/styles/tailwind.css`。
> - 迁移：`d-flex`→`flex`、`ga-2`→`gap-2`、`ma-3`/`pa-3`→`m-3`/`p-3`、`w-100`→`w-full`、`text-truncate`→`truncate`、`rounded-pill`→`rounded-full`、`text-body-small`→`text-xs`、`text-title-large`→`text-2xl`、`text-medium-emphasis`→`text-on-surface/60`（共 80 种 / 约 440 处，覆盖 30 个文件）。
> - `@theme` 里把 `--v-theme-*` 接成 Tailwind 颜色（`--color-surface` 等），`bg-surface` / `text-primary` / `border-outline/30` 直接跟随 Material You 换肤。
> - 层顺序在 `src/styles/tailwind.css` 顶部显式钉死：Vuetify 各层在前、Tailwind 的 `theme/base/components/utilities` 在后，所以 `fixed` 这类工具类能压住 `.v-btn { position: relative }`，book.vue 里那条未分层兜底规则随之删除。
> - `src/styles/vuetify-utilities.css` 与 `scripts/gen-vuetify-utilities.mjs` 删除（Vuetify 组件内部不使用工具类，删掉无副作用）。
> - 代价：依赖回到 `@tailwindcss/oxide`（2.9 MB）+ `lightningcss`（两份 ≈19 MB）原生二进制；入口 CSS 48 KB / gzip 9 KB。

### 3.4 路由级代码分割

`router/index.ts` 里只有 `Home` / `Library` 保持静态导入，阅读器、设置、写作工作台改为 `() => import(...)`。
仅这一项就把 211 KB 的 `VSelect` + 121 KB 的 `VSelect` CSS 移出首屏。

### 3.5 首屏文件构成（构建后）

`index.html` 现在只引用 24 个文件，最大的是 `VBtn`（210 KB / 76 KB gz）与 `index`（~187 KB / 59 KB gz）。

---

## 4. Wave 2 —— CI 门禁 + 依赖机器人

- 新增 `.github/workflows/ci.yml`：`pnpm install --frozen-lockfile` → ESLint（不自动修复）→ `prettier --check` → `vue-tsc` → `node --test` → 生产构建，并上传 `dist` 产物（保留 7 天）。
- `main.yml` / `release.yml`：Node 20 → **22**（Vite 8 要求 `^20.19 || >=22.12`），`pnpm/action-setup@v4` 去掉写死的 `version: 9`（改为读取 `packageManager` 字段），安装命令统一 `--frozen-lockfile`。
- 新增 `renovate.json`：Vue / Vuetify / Tauri / ESLint / CodeMirror / M3 分别成组，GitHub Actions 固定 digest，每月做一次 lockfile 维护，`vite` / `typescript` / `vue-tsc` 的大版本走 Dashboard 人工确认，`pdfjs-dist` 禁用（它被 vendored 进 `src/foliate-js`，不在 npm 侧管理）。

---

## 5. Wave 3 —— 结构性替换

### 5.1 M3 色彩系统（替换 `tinycolor2` + 手写 HSL）

新增运行时依赖 **`@material/material-color-utilities@0.4.0`**（Google 官方，Apache-2.0）。

- `src/utils/materialYou.ts`：`SchemeTonalSpot`（Android 12/13 默认动态取色方案）生成 M3 角色色，映射到既有 CSS 变量（`--primary`、`--surface-elev-1`…）。`applyMaterialYouSeed(seed, isDark)` 现在会区分深浅色——之前只有一个（浅色）版本。
- `src/styles/themes.ts`（阅读器内容配色）：`tinycolor.darken/lighten/desaturate/analogous/triad` 换成 HCT 色彩空间的「同色相、改 tone / 改 chroma / 转 60°、120°」。
- 新增 `tests/materialYou.test.ts`（6 个用例）：角色色齐全且都是合法 hex、深浅色方向正确、非法种子色回落、阅读器调色板明暗方向。

### 5.2 Rust / Tauri 清理

| 删除/替换                                                         | 说明                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src-tauri/src/transfer_file.rs`（203 行）                        | `upload_file` / `download_file` 命令 JS 侧从未 invoke；连带删 `reqwest` / `tokio` / `tokio-util` / `futures-util` / `read-progress-stream`                                                                                                            |
| `start_server` 命令 + `tauri-plugin-oauth`                        | 无调用方                                                                                                                                                                                                                                              |
| `macos/safari_auth.rs`（255 行）、`macos/apple_auth.rs`（203 行） | `auth_with_safari` / `start_apple_sign_in` 无调用方；连带删 `objc2-authentication-services`、`serde_json`、`thiserror`                                                                                                                                |
| `macos/traffic_light.rs`（388 行）                                | 手写的 `NSWindowDelegate` 钩子 → 改用 Tauri 2.7+ 内置 `WebviewWindowBuilder::traffic_light_position()`（窗口 resize 时由框架自动保持位置）。连带删 `cocoa` / `objc` / `objc-foundation` / `objc_id` / `block` / `objc2` / `objc2-foundation` / `rand` |
| `[lints.rust] unexpected_cfgs = "allow"`                          | 本来只为压制 `objc 0.2` 宏的告警，随老绑定一起消失                                                                                                                                                                                                    |
| `capabilities/default.json`                                       | 删掉云同步遗留的 `http:default` 白名单（`*.deepl.com`、`*.cloudflarestorage.com`）以及 `oauth:allow-start                                                                                                                                             | cancel`、`websocket:default` |
| `macos/menu.rs`                                                   | 帮助菜单不再指向 `readest.com` / `github.com/readest/readest`，改为本仓库                                                                                                                                                                             |

> ⚠️ 沙箱里没有 Rust 工具链（`cargo` / `rustc` 均未安装），上述 Rust 改动**未经编译验证**；合入前必须在 macOS 真机上跑一次 `pnpm tauri build`，重点看 macOS 标题栏红绿灯位置与全屏切换。

---

## 6. 未做 / 后续

| 项                                                              | 原因                                                                                                                            | 建议                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 字体本地化（报告 3-e）                                          | **用户明确要求跳过**                                                                                                            | —                                                                                     |
| `src/foliate-js` 改成 git submodule                             | 该目录含本仓库自己改过的 `paginator.js`，submodule 化需要先有一个承载补丁集的 fork；且 Node 侧无 `git submodule` 可用的公网仓库 | 建 fork（含 paginator patch）后 `git submodule add`，并把补丁集记成 `patches/*.diff`  |
| vendored pdf.js 4.7.76 → 6.x                                    | 需要 EPUB / PDF / MOBI / 漫画四种格式的全量回归，且 foliate-js 的 `pdf.js` 适配层按 4.x API 写成                                | 单独 PR，先升 `pdf.mjs` / `pdf.worker.mjs` / `cmaps` / `standard_fonts`，再逐格式回归 |
| TypeScript 7                                                    | `typescript-eslint` peer 仍是 `<6.1.0`                                                                                          | 等上游放宽后再升，Renovate 已设为人工确认                                             |
| Rust-only 插件（`tauri-plugin-http` / `-websocket` / `-shell`） | 已无 JS 调用方，但仍在 `lib.rs` 初始化；本环境无法编译验证，仓促删除风险高于收益                                                | 等能在 CI 里跑 `cargo check` 后按报告 §5.2 删除                                       |

---

## 7. 验证方式

```bash
npx -y pnpm@10.34.9 install --frozen-lockfile
pnpm run lint:eslint        # 0 error
pnpm exec prettier --check "src/**/*.{js,tsx,css,scss,vue,md,json,html}"
pnpm run typecheck          # vue-tsc --noEmit
pnpm test                   # node --test → 79 passed
pnpm run build              # dist 4.98 MB，首屏 646,303 B / 214,722 B gz
```

首屏体积的测量口径与报告一致：解析 `dist/index.html`，累加 `<script src>` / `<link href>` 指向的本地文件，逐个 `gzip -9` 求和。

## 8. 回滚

改动按逻辑分提交：`chore(deps)`（依赖/工具链）、`perf(web)`（首屏与构建）、`feat(theme)`（M3）、`refactor(tauri)`（Rust）、`ci`（门禁与 Renovate）。任一提交都可单独 revert；首屏相关的三处（Vuetify 按需、Tailwind→Vuetify、路由懒加载）互相独立，回滚其一不影响其余。
