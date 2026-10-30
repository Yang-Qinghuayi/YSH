# YSH 依赖与体积体检报告

> ✅ **执行状态（2026-10-27）**：本报告的 Wave 0–3 已全部落地，唯一例外是用户明确跳过「字体本地化」。
> 具体改动、度量结果与遗留项见 [`dependency-upgrade-2026-10.md`](./dependency-upgrade-2026-10.md)。

> 体检日期：2026-10-27
> 环境：Node 22.22.3 · pnpm 10.34.9 · Vite 8（Rolldown）· Vue 3.5.35 · Vuetify 4.1.1
> 基线验证：`pnpm install --frozen-lockfile` ✅（5.2 s）· `pnpm build` ✅（22.8 s）· `node --test tests/*.test.ts` ✅ 73/73 · `tsc --noEmit` ❌ 13 个既有错误
> 范围：`package.json`、`pnpm-lock.yaml`、`src-tauri/Cargo.toml` + `Cargo.lock`、`vite.config.ts`、`src-tauri/capabilities/*`、CI、以及 `src/foliate-js` 这份 vendored 代码

---

## 0. 速览（TL;DR）

**一句话结论：这个项目的依赖其实"不老"，真正的问题是三类——少数几个僵尸包、一条已经断掉的工具链、以及四处结构性臃肿。其中最大的一笔体积浪费（首屏 50%）只改 10 行配置就能拿回来，并且我已经在这份报告里做了构建验证。**

### 0.1 版本新鲜度：整体健康

- 23 个运行时依赖 + 33 个开发依赖里，**绝大多数是 2026 年 9–10 月的最新版本**：Vue 3.5.44、Vite 8.3.5、Vuetify 4.3.1、Tailwind 4.3.3、ESLint 10.13.0 都还在高频发版。
- 核心栈只落后几个 minor：Vue `3.5.35→3.5.44`、Vuetify `4.1.1→4.3.1`、Vite `8.0.16→8.3.5`、Vue Router `5.1.0→5.4.0`。
- 真正"该退休"的只有 6 个 JS 包（见 §4）和一小批 Rust crate（见 §4.4）。

### 0.2 体积：结构问题远大于单包问题

| 指标                                  | 现状                                          | 说明                                            |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| 首屏 JS+CSS（`index.html` 实际引用）  | **1.46 MB / 378 KB gzip**                     | 全量注册 Vuetify + 全量 `vuetify/styles` 导致   |
| 同一份代码改为 Vuetify 按需（已实测） | **0.73 MB / 220 KB gzip**                     | **-50% 原始 / -42% gzip**，构建 22.8 s → 10.6 s |
| `dist/` 总大小                        | 13 MB，其中 **6.9 MB 是 pdf.js 的 sourcemap** | 每次安装包/发布都白带                           |
| 单页最大 chunk                        | `novel` 802 KB / 249 KB gzip                  | 主要是 CodeMirror（编辑器核心，合理）           |
| `node_modules`                        | **381 MB / 972 个包**                         | 其中 `rxjs` 11 MB 只是 commitizen 的间接依赖    |
| vendored `src/foliate-js`             | 12 MB（vendor/）                              | pdf.js 4.7.76 + cmaps + 字体 + 地图文件         |

### 0.3 必须先知道的三件事

1. **`pnpm lint` 现在根本跑不起来**：`eslint` 不是直接依赖（`node_modules/.bin/eslint` 不存在），`vue-eslint-parser` 也没声明，`tsc` 另有 13 个错误。也就是说 lint 门禁形同虚设，`.husky/pre-commit` 里的 lint 也是注释掉的。
2. **Vuetify 被"全量注册"**：`import * as components from 'vuetify/lib/components/index'` 把约 100 个组件的 JS（641 KB / 203 KB gzip）全部打进首屏，而项目实际只用了 32 个组件。CSS 同理（`import 'vuetify/styles'` 一把梭 301 KB）。
3. **AI 相关的 Rust 代码已经死了**：`upload_file` / `download_file` 命令 JS 侧从未 invoke，`appService.uploadFileToCloud()` 已被掏空成 `console.log`，但 `reqwest` / `tokio` / `tokio-util` / `futures-util` / `read-progress-stream` / `tauri-plugin-oauth` 仍全量编进二进制——而 `reqwest` 还没开 TLS feature（`default-features = false` + `json`/`stream`），真发 https 会直接失败。

---

## 1. 体检方法与基线

```bash
pnpm install --frozen-lockfile --ignore-scripts   # 5.2 s，972 个包
npx vite build --mode web                          # 22.8 s，dist 13 MB
node --test tests/*.test.ts                        # 73 passed / 0 failed（984 ms）
npx tsc --noEmit --skipLibCheck                    # 13 errors
npx @tailwindcss/cli@4.3.0 -i src/styles/tailwind.css -o /tmp/tw.css --minify  # 14.6 KB / 3.1 KB gzip
```

单包体积用 esbuild 0.25.12 单独打包（`--bundle --minify --format=esm`，再 gzip）测量，避免"安装体积"和"打进产物的体积"混为一谈。

---

## 2. 体积账本

### 2.1 首屏（`index.html` 里真正引用的 16 个 JS/CSS 文件）

| 构建方式                                         |                   原始 |                   gzip |    构建耗时 |
| ------------------------------------------------ | ---------------------: | ---------------------: | ----------: |
| 现状（全量 Vuetify）                             |            1,459,671 B |              377,573 B |     22.81 s |
| Vuetify 按需（`autoImport: true`，已验证可构建） |              733,985 B |              220,323 B |     10.59 s |
| **差值**                                         | **-725,686 B（-50%）** | **-157,250 B（-42%）** | **-12.2 s** |

### 2.2 `dist/` 13 MB 的构成

| 文件                 |                大小 | 性质                                                       |
| -------------------- | ------------------: | ---------------------------------------------------------- |
| `pdf.worker.mjs.map` |             5.24 MB | **纯垃圾**（vendored pdf.js 的 sourcemap）                 |
| `pdf.worker.mjs`     |             2.20 MB | PDF 渲染 worker（按需加载，可接受）                        |
| `pdf.mjs.map`        |             1.67 MB | **纯垃圾**                                                 |
| `novel-*.js`         | 802 KB（249 KB gz） | CodeMirror 编辑器 + OpenAI SDK                             |
| `YQHS-*.jpg`         |              683 KB | favicon/图标，原图未压缩                                   |
| `pdf.mjs`            |              626 KB | vendored pdf.js 4.7.76                                     |
| `index-*.js`         | 519 KB（159 KB gz） | Vue + Router + Pinia + 全量 Vuetify + 58 条字体 @font-face |
| `index-*.css`        |  378 KB（56 KB gz） | 全量 Vuetify 样式 + Tailwind 产物                          |
| `pdf-*.js`           |              319 KB | foliate 的 PDF 适配层                                      |
| `settingsStore-*.js` |              222 KB | Vuetify 组件（被切成公共 chunk）                           |
| `zip.js-*.js`        |              167 KB | `@zip.js/zip.js`                                           |
| `VBtn-*.js`          |              149 KB | Vuetify 组件（被切成公共 chunk）                           |

> **结论：13 MB 里 6.9 MB（53%）是 sourcemap，1.7 MB 是能压到 200 KB 以内的大图，剩下的大头是"全量 Vuetify"+"两套 PDF/压缩实现"。**

### 2.3 安装体积（381 MB / 972 包）

| 包                               |   安装体积 | 备注                                 |
| -------------------------------- | ---------: | ------------------------------------ |
| `vuetify`                        |      68 MB | 含全部组件源码/类型                  |
| `typescript`                     |      24 MB | 可接受                               |
| `@rolldown/binding-*-{gnu,musl}` |  21 MB × 2 | 平台二进制装了两份                   |
| `@tauri-apps/cli-*-{gnu,musl}`   |  18 MB × 2 | 同上                                 |
| `openai`                         |      16 MB | 运行时只用了一个 POST                |
| `rxjs`                           |      11 MB | **只因为 `commitizen → inquirer@8`** |
| `lightningcss-*-{gnu,musl}`      | 9.6 MB × 2 | 只为 Tailwind v4                     |
| `prettier`                       |     8.4 MB |                                      |
| `@mdi/js`                        |     6.0 MB | 只用了 52 个图标（打包后 2 KB）      |
| `lodash`                         |     4.6 MB | 间接依赖（inquirer/eslint 链）       |
| `@zip.js/zip.js`                 |     4.4 MB | 与 vendored `zip.js` 功能重复        |

### 2.4 单包运行时成本（打包 + minify + gzip 实测）

| 依赖                                                            |    原始 |    gzip | 判定                               |
| --------------------------------------------------------------- | ------: | ------: | ---------------------------------- |
| `openai`（当前用法）                                            |  131 KB | 31.6 KB | 用一个 POST 换 31.6 KB，可换 fetch |
| `@codemirror/*`（当前组合）                                     |  526 KB |  173 KB | 编辑器核心，**值这个价**           |
| `vuetify` 全量注册                                              |  641 KB |  203 KB | 只用 32/100 组件，**主要浪费点**   |
| `vuetify` 32 个组件                                             |  281 KB |   91 KB | 按需后的合理值                     |
| `vue-toastification`                                            | 19.5 KB |  6.7 KB | + 15.8 KB CSS，但 4 年无新版       |
| `tinycolor2`                                                    | 15.3 KB |  5.3 KB | 无类型定义，导致 tsc 报错          |
| `js-md5`                                                        | 11.1 KB |  3.9 KB | 可用性 OK，版本落后                |
| `@mdi/js` × 52 图标                                             |  2.0 KB |  0.9 KB | **不重，别动**                     |
| `@vueuse/core` × 8 函数                                         |  9.6 KB |  4.2 KB | 只用 3 个函数，可留可换            |
| `@material/material-color-utilities`（替换 tinycolor2+手写 M3） |   94 KB | 21.7 KB | 换来的是一整套官方 HCT/M3 调色     |
| Tailwind 实际产物                                               | 14.6 KB |  3.1 KB | 工具链很重，产物很轻（见 §8.3）    |

---

## 3. 依赖台账（当前 → 最新）

### 3.1 运行时依赖（23）

| 包                                 | 当前       | 2026-10 最新                 | 处置                                        |
| ---------------------------------- | ---------- | ---------------------------- | ------------------------------------------- |
| `vue` ⚠️ 在 devDependencies        | 3.5.35     | 3.5.44                       | 移到 dependencies + 升级                    |
| `vue-router` ⚠️ dev                | 5.1.0      | 5.4.0                        | 同上                                        |
| `pinia` ⚠️ dev                     | 3.0.4      | **4.1.0**                    | 大版本，随 Wave 1                           |
| `vuetify` ⚠️ dev                   | 4.1.1      | 4.3.1                        | 升 + 改按需注册                             |
| `@vueuse/core` ⚠️ dev              | 14.3.0     | **15.0.0**                   | 大版本，低风险                              |
| `vue-toastification` ⚠️ dev        | 2.0.0-rc.5 | 1.7.14（latest 还停在 Vue2） | **删除**                                    |
| `@codemirror/view`                 | 6.43.4     | 6.43.15                      | patch                                       |
| `@codemirror/state`                | 6.7.0      | 6.7.6                        | patch                                       |
| `@codemirror/autocomplete`         | 6.20.3     | 6.20.4                       | patch                                       |
| `@codemirror/lang-markdown`        | 6.5.0      | 6.5.2                        | patch                                       |
| `@codemirror/theme-one-dark`       | 6.1.3      | 6.1.3                        | 最新（2025-06，主题包稳定）                 |
| `codemirror`（元包）               | 6.0.2      | 6.0.2                        | **删除（0 引用）**                          |
| `@tauri-apps/api`（精确锁 2.11.0） | 2.11.0     | 2.12.4                       | 升；改用 `^` 或 `~`                         |
| `@tauri-apps/plugin-cli`           | ^2.4.1     | 2.5.0                        | 升                                          |
| `@tauri-apps/plugin-deep-link`     | ^2.4.9     | 2.6.2                        | 升                                          |
| `@tauri-apps/plugin-dialog`        | ^2.7.1     | 2.8.3                        | 升                                          |
| `@tauri-apps/plugin-fs`            | ^2.5.1     | 2.7.1                        | 升                                          |
| `@tauri-apps/plugin-opener`        | ^2.5.4     | 2.7.2                        | 升                                          |
| `@tauri-apps/plugin-os`            | ^2.3.2     | 2.4.0                        | 升                                          |
| `@tauri-apps/plugin-process`       | ^2.3.1     | 2.4.0                        | 升                                          |
| `@tauri-apps/plugin-haptics`       | ^2.3.2     | 2.4.2                        | **仅移动端用，桌面可拆**                    |
| `@tauri-apps/plugin-http`          | ^2.5.9     | 2.8.3                        | **删除（0 引用）**                          |
| `@tauri-apps/plugin-log`           | ^2.8.0     | 2.10.1                       | **删 JS 包（0 引用；Rust 侧日志插件保留）** |
| `@tauri-apps/plugin-shell`         | ~2.3.5     | 2.5.0                        | **删除（0 引用）**                          |
| `@tauri-apps/plugin-websocket`     | ~2.4.2     | 2.5.0                        | **删除（0 引用）**                          |
| `openai`                           | 6.42.0     | **7.45.0**                   | 大版本；或改 fetch（推荐）                  |
| `tinycolor2`                       | 1.6.0      | 1.6.0                        | **替换**（2023 后停更，且无类型）           |
| `js-md5`                           | 0.8.3      | 0.9.2                        | 升 patch                                    |
| `@zip.js/zip.js`                   | 2.8.26     | 2.24.0                       | 升，并与 vendored zip 去重                  |

### 3.2 开发依赖（33）

| 包                                     | 当前           | 最新             | 处置                                          |
| -------------------------------------- | -------------- | ---------------- | --------------------------------------------- |
| `vite`                                 | 8.0.16         | 8.3.5            | 升                                            |
| `@vitejs/plugin-vue`                   | 6.0.7          | 6.0.10           | 升                                            |
| `@vitejs/plugin-vue-jsx`               | 5.1.5          | 5.1.6            | **删除（0 个 .tsx/.jsx）**                    |
| `typescript`                           | 6.0.3          | **7.0.2**        | 暂缓（`@typescript-eslint` peer 仍 `<6.1.0`） |
| `vue-tsc`                              | 3.3.4          | 3.3.13           | 升                                            |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.0          | 4.3.3            | 升或整体删除（§8.3）                          |
| `postcss`                              | 8.5.15         | 8.5.32           | 随 Tailwind 去留                              |
| `autoprefixer`                         | 10.5.0         | 10.6.2           | **冗余**（Vite/lightningcss 已处理前缀）      |
| `sass`                                 | 1.100.0        | 1.106.1          | 升；若去 SCSS 可删                            |
| `unplugin-auto-import`                 | 21.0.0         | 21.1.0           | 升                                            |
| `unplugin-vue-components`              | 32.1.0         | 32.1.0           | 最新                                          |
| `vite-plugin-vuetify`                  | 2.1.3          | 2.1.3            | 最新（启用 `autoImport`）                     |
| `eslint`（未声明）                     | 8.56.0（间接） | **10.13.0**      | **补为直接依赖 + 迁 flat config**             |
| `vue-eslint-parser`（未声明）          | —              | 10.4.1           | **补为直接依赖**                              |
| `@typescript-eslint/*`                 | 8.61.0         | 8.72.1           | 升                                            |
| `eslint-plugin-vue`                    | 9.33.0         | **10.12.0**      | 大版本                                        |
| `eslint-config-prettier`               | 9.1.2          | **10.1.8**       | 大版本                                        |
| `eslint-plugin-prettier`               | 5.5.6          | 5.5.7            | 升                                            |
| `eslint-plugin-import`                 | 2.32.0         | 2.32.0           | 最新（维护模式，可选迁 `import-x`）           |
| `eslint-plugin-simple-import-sort`     | 10.0.0         | **14.0.0**       | 大版本                                        |
| `prettier`                             | 3.8.4          | 3.9.10           | 升                                            |
| `lint-staged`                          | 17.0.7         | 17.6.0           | 升                                            |
| `husky`                                | 9.1.7          | 9.1.7            | 最新（2024-11），但钩子是空的                 |
| `commitizen`                           | 4.3.1          | 4.3.2            | **删除**                                      |
| `cz-conventional-changelog`            | 3.3.0          | 3.3.0（2020-08） | **删除**                                      |
| `@mdi/js`                              | 7.4.47         | 7.4.47           | 保留（打包仅 2 KB）                           |
| `@tauri-apps/cli`                      | 2.11.2         | 2.12.4           | 升                                            |

---

## 4. 陈旧清单（按严重度）

### 4.1 A 级：已停更 / 僵尸（必须处理）

| 包                                  | 最后的发布                                                                         | 证据                                                                                          | 处置                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `vue-toastification` `2.0.0-rc.5`   | **2021-10-18**（仓库 2022-05 后再无动静；npm `latest` 至今仍是给 Vue 2 的 1.7.14） | 全项目只有 `Library.vue` 两处 `toast.success/error`；项目自己已经用了 3 处 `v-snackbar`       | **删除**，改用 `v-snackbar` 封装（或 `vue-sonner@2.0.9`） |
| `tinycolor2` `1.6.0`                | 2023-02（仓库 2023-07 后无更新；无内置类型）                                       | 只被 `src/styles/themes.ts` 用来算阅读器配色；`tsc` 因此报 `TS7016`                           | **替换**为 `colord`（2 KB、自带类型）或直接上官方 M3 算法 |
| `cz-conventional-changelog` `3.3.0` | **2020-08-26**                                                                     | 只为 commitizen 服务；commitizen 又拉进 `inquirer@8` → `rxjs 7.8.1`（11 MB）                  | **删除**（commitizen 一并删）                             |
| `eslint` `8.56.0`                   | ESLint 8 已于 2024-10 结束支持                                                     | 不是直接依赖，`node_modules/.bin/eslint` 不存在 → `pnpm lint:eslint` 直接 `command not found` | **补进依赖并升到 10.x + flat config**                     |
| `@vitejs/plugin-vue-jsx`            | 仍在维护，但项目 **0 个** `.tsx/.jsx`                                              | `find src -name '*.tsx' -o -name '*.jsx'` 为空                                                | **删除**                                                  |
| `codemirror`（元包）                | 6.0.2（2025-06）                                                                   | 全仓库 0 处 `from 'codemirror'`，实际只用 `@codemirror/*`                                     | **删除**                                                  |

### 4.2 B 级：版本落后，需按窗口升级

见 §3 台账。重点：

- `typescript 6.0.3 → 7.0.2`：**不要现在升**。`@typescript-eslint@8.x` 的 peer 是 `typescript >=4.8.4 <6.1.0`，升到 TS 7 会让整条 lint 链失效。等 `@typescript-eslint` 支持后再说。
- `pinia 3 → 4`、`@vueuse/core 14 → 15`、`openai 6 → 7`：三个大版本，适合并成一次 "Wave 1" 小步快跑。
- `@tauri-apps/api` 被精确锁在 `2.11.0`（其余插件都是 `^`），而 CLI 是 `2.11.2`。建议统一用 `^2.12`，或统一用 `~` 并靠 Renovate 发 PR。

### 4.3 C 级：已是最新，但"多年不动"的稳定包（可接受）

| 包                                 | 最后发布 | 说明                                                                 |
| ---------------------------------- | -------- | -------------------------------------------------------------------- |
| `@mdi/js 7.4.47`                   | 2023-12  | 图标素材天然稳定；且只打进去 52 个（2 KB），无需替换                 |
| `@codemirror/theme-one-dark 6.1.3` | 2025-06  | 主题包，正常                                                         |
| `husky 9.1.7`                      | 2024-11  | 最新版，但当前钩子是空壳                                             |
| `eslint-plugin-import 2.32.0`      | 2025-06  | 维护模式；生态在迁 `eslint-plugin-import-x`，可随 ESLint 10 一起评估 |

### 4.4 Rust / Tauri 侧

| 依赖                                          | 当前                   | 状态                                                                                               | 处置                                                               |
| --------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `cocoa`                                       | 0.25.0                 | 老 Objective-C 绑定，官方已不推荐                                                                  | **迁移到 `objc2` + `objc2-app-kit`**（只被 `traffic_light.rs` 用） |
| `objc`                                        | 0.2.7（2019）          | 原作者已停止维护，指向 `objc2`                                                                     | 同上                                                               |
| `objc-foundation` / `objc_id` / `block`       | 0.1.1 / 0.1.1 / 0.1.6  | 同一时代的老绑定                                                                                   | 随手一起删                                                         |
| `reqwest`                                     | 0.12.28（最新 0.13.5） | **且未开 TLS feature**，`https` 请求必然失败                                                       | 唯一调用方是死代码 → **整块删除**                                  |
| `rand`                                        | 0.8                    | 最新已到 0.9 系                                                                                    | 只用于 `traffic_light.rs` 生成随机字符串 → 换成时间戳/计数器       |
| `schemars`                                    | 0.8（本地插件）        | 最新 1.x                                                                                           | 随插件升级                                                         |
| `tauri`                                       | 2.11.3                 | 最新 2.12.5                                                                                        | `cargo update` 即可（caret 语义）                                  |
| `read-progress-stream`                        | 1.0.0                  | 单一版本、无后续发布                                                                               | 随 `transfer_file.rs` 一起删                                       |
| `tauri-plugin-oauth`                          | 2.x                    | 命令 `start_server` JS 从未 invoke                                                                 | 删                                                                 |
| `tauri-plugin-http` / `-websocket` / `-shell` | 2.5 / 2.4 / 2.3        | Rust 注册了，JS 0 引用，capabilities 还留着 `*.deepl.com` / `*.cloudflarestorage.com` 的云同步权限 | 删（同时收窄权限面）                                               |
| `tauri-plugin-sign-in-with-apple`             | 1.0.2                  | 仅 iOS 编译，但 `start_apple_sign_in` 无调用方                                                     | 若不发 iOS 版可删                                                  |
| `objc2-authentication-services`               | 0.3                    | 只服务 `apple_auth.rs`（无调用方）                                                                 | 随模块删                                                           |

---

## 5. 死重清单（有证据，可直接删）

### 5.1 JS 依赖

| 包                                                       | 证据                                                              | 影响                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `codemirror`                                             | 0 处 import                                                       | 少一个包，少一次锁文件维护                                 |
| `@vitejs/plugin-vue-jsx`                                 | 0 个 jsx/tsx 文件                                                 | 少一条 Vite 插件链                                         |
| `vue-toastification`                                     | 2 处 toast + 15.8 KB CSS                                          | 少一个僵尸包                                               |
| `@tauri-apps/plugin-{http,shell,websocket,log}`（JS 包） | JS 0 处 import                                                    | 少 4 个包 + 缩小权限面；haptics 仅移动端，按需保留         |
| `@vueuse/core`                                           | 只用 `useLocalStorage` / `usePreferredDark` / `useSessionStorage` | 可保留（4 KB），也可换成 3 个 30 行的 composable           |
| `openai`                                                 | 仅 `deepseekService.ts` 里 `new OpenAI()` 一个流式 POST           | 可改成 fetch，SDK 降级为类型依赖（省 31.6 KB gzip）        |
| `commitizen` + `cz-conventional-changelog`               | 提交信息并未强制                                                  | 删掉后连带 `inquirer`、`rxjs`、`lodash`（≈16 MB 安装体积） |

### 5.2 Tauri 命令 / Rust 模块（全都没有调用方）

| 命令 / 模块                                           | 行数 | 依赖                                                                     | 证据                                                                              |
| ----------------------------------------------------- | ---: | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `transfer_file.rs`（`download_file` / `upload_file`） |  203 | `reqwest`、`tokio`、`tokio-util`、`futures-util`、`read-progress-stream` | JS 侧从未 `invoke('download_file')`；`appService.uploadFileToCloud()` 已是空壳    |
| `macos/safari_auth.rs`                                |  255 | `objc`、`objc2`                                                          | `auth_with_safari` 无调用方                                                       |
| `macos/apple_auth.rs`                                 |  203 | `objc2-authentication-services`                                          | `start_apple_sign_in` 无调用方                                                    |
| `start_server`（oauth）                               |    8 | `tauri-plugin-oauth`                                                     | 无调用方                                                                          |
| `tauri-plugin-http` / `-websocket` / `-shell`         |    — | 三个插件 + JS 包                                                         | JS 0 引用                                                                         |
| `macos/menu.rs` 的链接                                |   38 | —                                                                        | 仍然指向 `readest.com` 和 `github.com/readest/readest`（上游残留，品牌/法律风险） |

> 保守估计：删完这 1,000 行左右的 Rust 与 8 个 crate，macOS/Windows 产物都能小一截，冷启动少几个插件初始化。

### 5.3 配置残留

- `package.json → pnpm.onlyBuiltDependencies`：列了 `core-js`、`es5-ext`、`@parcel/watcher`、`vue-demi`——**这四个包在 lock 里 0 命中**，纯历史残留。
- `.husky/pre-commit`：`. "$(dirname "$0")/_/husky.sh"` 是 husky v8 写法，`# npm run lint:lint-staged` 被注释 → 钩子等于不存在。
- `tailwind.config.js`：Tailwind v4 **默认不读 JS 配置**（除非 `@config`），`content`/`preflight` 都是无效设置。
- `@types/tinycolor2` 未安装 → `tsc` 直接报 `TS7016`。
- `eslint` / `vue-eslint-parser` 未声明为直接依赖 → lint 无法运行。
- 运行时依赖全部挂在 `devDependencies`（vue / vue-router / pinia / vuetify / @vueuse/core / vue-toastification）→ `pnpm install --prod` 会缺包。
- `.github/workflows/*`：只做打包发布，**不跑 lint / test / tsc**；无 Renovate / Dependabot；`pnpm/action-setup@v4 version: 9` 与本地 pnpm 10 漂移；`package.json` 没有 `packageManager` 字段。

### 5.4 静态资源

- `src/foliate-js/vendor/pdfjs/*.map`：6.9 MB，会被原样拷进 `dist/`。
- `src/assets/YQHS.jpg`：683 KB，仅当 favicon / 应用图标。
- `src/styles/fonts.css`：22 KB、58 个 `@font-face`，全部指向 `fonts.gstatic.com`，通过 `?raw` 注入每个阅读 iframe → 离线时全部 404。
- `index.html`：从 `cdn.jsdelivr.net` 拉两套霞鹜文楷 CSS → 桌面端离线首启直接缺字/回退。
- 三套压缩实现：`vendor/zip.js`（55 KB）、`@zip.js/zip.js`（167 KB）、`fflate`（3.8 KB），都在包里。

---

## 6. 结构性臃肿（真正的"重"）

### 6.1 Vuetify 全量注册（最大单笔）

```ts
// src/plugins/vuetify.ts —— 现状
import 'vuetify/styles'                                  // 301 KB 全量 CSS
import * as components from 'vuetify/lib/components/index'  // ~100 个组件全量 JS
import * as directives from 'vuetify/lib/directives/index'
...
createVuetify({ components, directives, ... })
```

- 实测：全量组件 JS **641 KB / 203 KB gzip**；项目实际用 32 个，按需 **281 KB / 91 KB gzip**。
- 首屏 CSS 378 KB（gzip 56 KB）→ 按需后 `index.css` 40.7 KB（gzip 7.9 KB）。
- 已验证的修法（**构建通过**）：

```diff
- import 'vuetify/styles'
  import type { App } from 'vue'
  import { createVuetify } from 'vuetify'
- import * as components from 'vuetify/lib/components/index'
- import * as directives from 'vuetify/lib/directives/index'
  import { aliases, mdi } from 'vuetify/lib/iconsets/mdi-svg'
```

```diff
  vuetify({
+   autoImport: true,
    styles: { configFile: './src/styles/settings.scss' },
  }),
```

```diff
  const vuetify = createVuetify({
-   components,
-   directives,
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
```

> 注意：`autoImport` 依赖模板里的 `<v-*>` 标签自动注入。项目里只有两处 `<component :is>`（都是路由视图），没有 JS 侧 `h(VXxx)`，所以风险很低；上线前仍需跑一遍设置页/阅读页/小说页的手工回归。

### 6.2 pdf.js + foliate-js（vendored 12 MB）

- vendored `pdf.js` 是 **4.7.76**（foliate 上游 `package.json` 写的就是 `pdfjs-dist ^4.7.76`），npm 上 `pdfjs-dist` 已到 **6.4.299**（2026-10）——落后两个大版本。
- `src/foliate-js` 是从上游整仓拷进来的：上游最后提交 2026-05-01，但本地 `paginator.js` 与上游 diff 统计 **1,964 行**（自研 `cssAnimateScroll` 多视图动画）、`view.js` 139 行 → **已经是一个 fork，不能无脑覆盖升级**。
- 建议：把 `src/foliate-js` 改成 **git submodule + `patches/` 补丁集**（上游 README 也推荐 submodule），至少先删掉 `.map`、`package-lock.json`（55 KB）、`rollup/`、`tests/`、`ui/` 里未被引用的文件。

### 6.3 字体与离线

- 离线优先的应用不该在启动路径上依赖 jsdelivr / gstatic。
- 建议：`@fontsource/lxgw-wenkai` 之类本地打包（或直接进 `src/assets/fonts` + `@font-face`），删掉 `index.html` 的两个 CDN `<link>`；`fonts.css` 只保留实际提供的 6 个族 × 需要的字重（当前 58 条），并按阅读器设置里真正可选的字体裁剪（`constants.ts` 里列了 Bitter/Literata/Merriweather/Roboto/Noto Sans/Fira Code）。

### 6.4 OpenAI SDK

- 运行时只用了一个 `client.chat.completions.create({ stream: true })`，却带进 **131 KB / 31.6 KB gzip** 与 16 MB 安装体积。
- 两种走法：
  - **A（推荐）** 在 `deepseekService.ts` 里用 `fetch` + `ReadableStream` 手写 SSE（约 120 行），`openai` 降级为 `devDependencies` 只提供类型（8 个文件在用它的类型）。
  - **B** 升到 `openai@7.45.0`，接受这份体积。

### 6.5 CodeMirror（可接受的重）

- 单测：`@codemirror/view + state + autocomplete + lang-markdown + theme-one-dark` = 526 KB / 173 KB gzip，novel 路由按需加载（首屏不加载）。
- 作为 Markdown 编辑器内核，这个体量正常；比它更轻的替代（自研 textarea + 高亮）会丢掉 @提及补全、折叠、多光标等能力，**不建议换**。只需删掉未使用的 `codemirror` 元包。

### 6.6 安装体积

- 381 MB、972 个包，对一个桌面应用来说偏大，但大部分是构建期依赖（TS 24 MB、两个平台的 rust/rolldown 二进制各 21–18 MB）。
- 删掉 commitizen 链（inquirer/rxjs/lodash ≈ 16 MB）与 Tailwind 链（lightningcss ×2 ≈ 19 MB）能砍掉近 40 MB。

---

## 7. 更新计划（四波，按风险排）

### Wave 0 —— 今天做，0 风险，约 30 分钟

```bash
# 1) 先把 Library.vue 的两处 toast.success/error 换成 v-snackbar 封装，再删包
pnpm remove codemirror @vitejs/plugin-vue-jsx vue-toastification \
  @tauri-apps/plugin-http @tauri-apps/plugin-shell \
  @tauri-apps/plugin-websocket @tauri-apps/plugin-log \
  commitizen cz-conventional-changelog

# 2) 把运行时依赖挪回 dependencies（vue / vue-router / pinia / vuetify / @vueuse/core）
# 3) 清理 package.json 的 pnpm.onlyBuiltDependencies 四条幽灵条目
# 4) 删掉 src/foliate-js/vendor/pdfjs/*.map（-6.9 MB dist）
# 5) YQHS.jpg → webp/svg（-650 KB）
# 6) 修 .husky/pre-commit：要么接 lint-staged，要么删掉 husky
```

验收：`pnpm build` 通过、`dist` 从 13 MB → 约 5.9 MB、首屏不变差。

### Wave 1 —— 本周，低风险（patch/minor + 两个大版本），约半天

```bash
pnpm up --latest vue vue-router vuetify vite @vitejs/plugin-vue \
  @codemirror/view @codemirror/state @codemirror/autocomplete @codemirror/lang-markdown \
  tailwindcss @tailwindcss/postcss postcss autoprefixer sass prettier \
  lint-staged unplugin-auto-import vue-tsc @tauri-apps/api \
  @tauri-apps/plugin-{cli,deep-link,dialog,fs,opener,os,process} \
  js-md5 @zip.js/zip.js @typescript-eslint/{parser,eslint-plugin}
pnpm up --latest pinia @vueuse/core        # 两个大版本，业务代码零改动
```

同时上 §6.1 的 Vuetify 按需注册。验收：首屏 ≤ 0.8 MB / 240 KB gzip，构建 ≤ 15 s，73 个测试全绿。

### Wave 2 —— 2 周内，中风险：工具链重建，约 1–2 天

1. **ESLint 10 + flat config**：`eslint@10 config`，`vue-eslint-parser@10`、`eslint-plugin-vue@10`、`eslint-config-prettier@10`、`eslint-plugin-simple-import-sort@14`；`plugin:import` → `eslint-plugin-import-x`（可选）。
2. `eslint`、`vue-eslint-parser` 写成**直接依赖**，修 `.eslintrc.cjs` → `eslint.config.js`。
3. 补 `@types/tinycolor2`（如果暂时不换 tinycolor2），修掉 13 个 tsc 错误。
4. 新增 `ci.yml`：PR 上跑 `lint` + `tsc --noEmit` + `test` + `build`（只跑 Ubuntu，省钱）。
5. CI 的 node 20 → **22**（`tests/*.test.ts` 依赖 Node 内建类型擦除，20.19 直接跑不了）；`pnpm/action-setup` 与本地对齐；加 `packageManager` 字段。
6. 加 **Renovate**（或 Dependabot），只开 patch/minor 自动合并，major 人工。
7. 删掉 `autoprefixer` + `postcss`（随 Tailwind 去留，见 §8.3）。

### Wave 3 —— 本季度，高风险：结构性替换，按子项拆 PR

| 子项 | 内容                                                                                                              | 预估                                |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 3-a  | `openai` → fetch + SSE（或升 7.x）                                                                                | 0.5 天                              |
| 3-b  | `tinycolor2` + 手写 HSL → `@material/material-color-utilities`（真正的 M3/HCT）                                   | 1 天                                |
| 3-c  | Rust：删 `transfer_file.rs` + 5 个 crate + 3 个插件；`traffic_light.rs` 迁 `objc2`；删 `safari_auth`/`apple_auth` | 1–2 天（需真机验证 macOS 标题栏）   |
| 3-d  | `src/foliate-js` → submodule + patch 集；vendored pdf.js 4.7.76 → 6.x                                             | 2–3 天（回归 EPUB/PDF/MOBI 全格式） |
| 3-e  | 字体本地化 + `fonts.css` 裁剪                                                                                     | 0.5 天                              |
| 3-f  | Tailwind → Vuetify utility（删 3 层 PostCSS 链）                                                                  | 0.5–1 天                            |
| 3-g  | TypeScript 7（等 `@typescript-eslint` 支持后）                                                                    | 观察                                |

**节奏建议**：Wave 0 + 1 可以合成一个 PR（都是机械改动）；Wave 2 独立；Wave 3 每个子项单独 PR，方便回滚。

---

## 8. 重要组件替换计划

### 8.1 总表

| #   | 现在的方案                               | 替换为                                                        | 为什么                                                                             | 成本      | 收益                           | 风险                            |
| --- | ---------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------- | ------------------------------ | ------------------------------- |
| 1   | Vuetify 全量注册 + `vuetify/styles`      | `vite-plugin-vuetify` 的 `autoImport` + 按需样式              | 用 32/100 个组件却付全量钱                                                         | 10 行配置 | 首屏 -50%，构建 -54%           | 低（需回归动态组件）            |
| 2   | `tinycolor2` + `materialYou.ts` 手写 HSL | `@material/material-color-utilities`                          | 官方 M3/HCT tonal palette，颜色角色齐全；tinycolor2 已停更且无类型                 | 1 天      | 主题更"正"、删除僵尸包、修 tsc | 中（配色观感会变，需截图比对）  |
| 3   | `vue-toastification@rc`                  | `v-snackbar` 封装 / `vue-sonner`                              | 4 年无新版，功能重复                                                               | 1 小时    | 少 1 包 + 15.8 KB CSS          | 低                              |
| 4   | `openai` SDK                             | `fetch` + SSE（类型仍用 SDK）                                 | 一个 POST 换 31.6 KB gzip + 16 MB 安装                                             | 0.5 天    | 包小、可控                     | 中（流式解析要测）              |
| 5   | Tailwind 4 + PostCSS + Autoprefixer      | Vuetify utility class（`d-flex` / `ga-2` / `mt-2` / `w-100`） | 两套 utility 系统并存；Tailwind 产物只有 3.1 KB gzip，却带 lightningcss 双份二进制 | 0.5–1 天  | 删 4 个包与 1 份配置           | 中（60 个类要逐个换，视觉回归） |
| 6   | ESLint 8 + `.eslintrc`                   | ESLint 10 + flat config + `import-x`                          | 8 已 EOL，且现在根本跑不起来                                                       | 1 天      | lint 门禁真正生效              | 低                              |
| 7   | commitizen + cz-conventional-changelog   | 删（或 commitlint）                                           | 2020 年的包，拉 16 MB                                                              | 10 分钟   | -16 MB                         | 无                              |
| 8   | vendored `objc`/`cocoa` + 3 个老 crate   | `objc2` + `objc2-app-kit`                                     | 老绑定已停维护；项目已有 objc2 0.6                                                 | 1 天      | Rust 依赖更干净、少 5 个 crate | 中（需 macOS 真机）             |
| 9   | `transfer_file.rs` + reqwest/tokio 链    | 删                                                            | 云同步遗物，命令无调用方，TLS 还没开                                               | 0.5 天    | 二进制更小、攻击面更小         | 低                              |
| 10  | vendored foliate-js 整仓                 | git submodule + `patches/`                                    | 12 MB 整仓、1964 行分叉、无法追踪上游                                              | 2–3 天    | 可升级、可审计                 | 高（阅读核心）                  |
| 11  | vendored pdf.js 4.7.76                   | foliate 升级后跟 `pdfjs-dist@6.x`                             | 两个大版本差距，安全/性能修复拿不到                                                | 随 #10    | PDF 兼容性/性能                | 中                              |
| 12  | jsDelivr + Gstatic 远程字体              | 本地打包 / 系统字体                                           | 离线优先应用启动依赖 CDN                                                           | 0.5 天    | 首启不闪、离线可用             | 低                              |
| 13  | `js-md5` 0.8.3                           | 升 0.9.2（或 WebCrypto + 自实现 MD5）                         | 版本落后；但 WebCrypto 无 MD5                                                      | 10 分钟   | 小                             | 低                              |
| 14  | 3 套 zip/deflate                         | 统一到 `@zip.js/zip.js`（或 `fflate`）                        | vendored zip.js 与 npm 包重复                                                      | 1 天      | 少 55 KB + 一个实现            | 中（ebook 解包要回归）          |

### 8.2 关于 Material You（重点）

> 你说的 "we use" 我理解成 **Vuetify**；如果是别的包（比如 Buefy），见 §8.3。

- **Vuetify 本身就是 Google Material Design 的 Vue 实现**，4.x 已经是 Material 3（Material You）的组件与 token 体系。所以"换成 Google 的材质系统"这件事，**不需要换组件库，只需要把主题算法换成官方 M3 的**。
- 现状：`src/utils/materialYou.ts` 是手写的 HSL 近似（旋转色相 + 手工明度），`themes.ts` 用 tinycolor2 生成阅读器的 `base-200/300`。这两套都不是真正的 M3 调色（M3 用的是 HCT 色彩空间 + tonal palette：0/10/20/…/95/99 的色调阶）。
- 替换方案：`@material/material-color-utilities`（Google 官方，0.4.0，2026-01；全量打包 94 KB / 21.7 KB gzip，tree-shake 后更小）
  - `themeFromSourceColor(seed)` → `primary/secondary/tertiary/error/neutral/neutralVariant` 六组 tonal palette；
  - `MaterialDynamicColors` → surface/surfaceContainer/onSurface… 全套角色色；
  - 把 `useMaterialYouTheme.ts` 里 `syncVuetifyTheme()` 的映射表换成 M3 角色（Vuetify 4 的 theme colors 与 M3 角色基本一一对应）。
- 好处：4 个调色板（陶土缪斯/蔷薇晨雾/鼠尾草诗页/靛蓝夜曲）全部自动得到正确的对比度与明暗两套；`themeFromSourceColor` 还能直接产出深色模式。
- 同时把 `tinycolor2` 从依赖里去掉（阅读器配色的 `darken/lighten/analogous` 可以换成 `colord` 的 2 KB 实现，或直接用 tonal palette 的相邻阶）。

### 8.3 关于 "beautify" / 格式化链

> 项目里没有 `js-beautify` 依赖；"beautify" 可能指代码格式化链、Buefy，或 Tailwind 这类"美化"工具，下面分别说。

- 如果指的是**代码美化（Prettier / js-beautify）**：项目用的是 Prettier 3.8.4，最新 3.9.10，**在正常维护，不用换**。真正该动的是它旁边那条链：ESLint 8（EOL）+ `.eslintrc.cjs` + `eslint-plugin-prettier`（把格式化塞进 lint，速度慢、报错吵）+ husky 空钩子 + commitizen。建议：Prettier 管格式、ESLint 10 管质量、`lint-staged` 只管暂存文件，三者边界清晰。
- 如果指的是 **Buefy**：它是 Bulma 生态的组件库（最新 3.1.0，2026-08），跟 Material 没有关系，本项目也没有使用它——不需要引入。
- 如果指的是 **Tailwind**：它确实"美化"了 60 来个类，但 Vuetify 自带 utility class（`d-flex`、`align-center`、`justify-space-between`、`ga-2`、`mt-2`、`w-100`），完全可以二选一（§8.1 #5）。

---

## 9. 工程链路问题（和依赖同样重要）

| 问题                         | 证据                                                                                      | 修法                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| lint 跑不起来                | `node_modules/.bin/eslint` 不存在                                                         | 补 `eslint` + `vue-eslint-parser` 直接依赖 |
| tsc 13 个错误                | 缺 `@types/tinycolor2`；`file.ts` `ReadableStream` 变体；`viewSettingsHelper.ts` 布尔参数 | 逐个修，纳入 CI gate                       |
| 测试只在 Node 22 能跑        | `node --test tests/*.test.ts` 依赖内建类型擦除；`engines` 允许 20.19                      | CI/引擎统一 ≥22.12                         |
| CI 不校验                    | 两个 workflow 只打包发布                                                                  | 新增 `ci.yml`（lint/test/tsc/build）       |
| 无自动化升级                 | 无 Renovate/Dependabot                                                                    | 加 Renovate，patch 自动、major 人工        |
| pnpm 版本漂移                | CI `pnpm 9` vs 本地 `10.34.9`                                                             | `packageManager` 字段 + `corepack enable`  |
| 运行时依赖在 devDependencies | 6 个包                                                                                    | 移到 `dependencies`                        |
| 钩子是空的                   | `.husky/pre-commit` 注释掉 lint                                                           | 接 `lint-staged` 或删 husky                |

---

## 10. 预算与守门（建议写进 CI）

| 指标                | 当前      | Wave 0/1 后目标        | 守门方式                               |
| ------------------- | --------- | ---------------------- | -------------------------------------- |
| 首屏 JS+CSS（gzip） | 378 KB    | **≤ 240 KB**           | 构建后解析 `index.html` 引用的资源求和 |
| `dist/`             | 13 MB     | **≤ 6 MB**             | `du -sb dist`                          |
| 单 chunk 上限       | 802 KB    | ≤ 900 KB（novel 允许） | Vite `chunkSizeWarningLimit`           |
| 构建耗时            | 22.8 s    | ≤ 15 s                 | CI 记录                                |
| tsc                 | 13 errors | **0**                  | `tsc --noEmit`                         |
| 测试                | 73        | ≥ 73                   | `node --test`                          |
| 未使用依赖          | 9 个      | 0                      | Renovate + `knip`（可选）              |

> 建议再加 `knip`（或 `depcheck`）做"未使用依赖/未使用导出"守门——这次审计里的 `codemirror`、`@vitejs/plugin-vue-jsx` 就是它能自动抓到的类型。

---

## 11. 风险与"不要做"的事

1. **不要整体替换 foliate-js**：`paginator.js` 已分叉 1964 行（自研翻页动画），换库等于重写阅读器。只做"submodule 化 + 裁剪 + 跟 pdf.js"。
2. **不要现在升 TypeScript 7**：`@typescript-eslint@8` 的 peer 上限是 `<6.1.0`，升了 lint 链直接崩。
3. **不要一次升 pinia 4 + vueuse 15 + openai 7 + Vuetify 4.3 再叠加 Vuetify 按需改造**：拆成两个 PR，否则出问题无法定位。
4. **Vuetify `autoImport` 改造要回归**：设置页（`v-select`/`v-switch`/`v-slider`）、阅读器菜单（`v-menu`/`v-bottom-sheet`）、小说面板（`v-dialog`/`v-textarea`/自动补全）、Library 的 toast。
5. **Rust 侧删代码要真机验证**：macOS 红绿灯（`traffic_light.rs`）、Windows 圆角/阴影、文件关联打开（deep-link/cli/single-instance）。
6. **不要用 `reqwest` 重写下载**：那块功能在 TS 侧已经被掏空，先确认产品上是否还需要"云上传"；不需要就直接删。

---

## 附录 A：测量命令

```bash
# 安装与构建
pnpm install --frozen-lockfile --ignore-scripts
npx vite build --mode web

# 首屏（index.html 引用的 JS+CSS）
files=$(grep -oE '(src|href)="\.?/?assets/[^"]+\.(js|css)"' dist/index.html | sed 's/.*="//; s/"//')
for f in $files; do stat -c%s "$f"; gzip -c "$f" | wc -c; done

# 单包运行时体积（esbuild + gzip）
npx esbuild entry.js --bundle --minify --format=esm --platform=browser --external:vue --outfile=/tmp/out.js
gzip -c /tmp/out.js | wc -c

# Tailwind 实际产物
npx @tailwindcss/cli@4.3.0 -i src/styles/tailwind.css -o /tmp/tw.css --minify

# 使用情况
grep -rhoE '<v-[a-z0-9-]+' src --include=*.vue | sort | uniq -c | sort -rn
grep -rn "from 'codemirror'" src
grep -rn "@tauri-apps/plugin" src --include=*.ts --include=*.vue
grep -rn "invoke(" src --include=*.ts --include=*.vue
```

## 附录 B：本次实测原始数据

| 项目                               | 数值                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| 首屏 JS+CSS（现状）                | 1,459,671 B / 377,573 B gzip                                  |
| 首屏 JS+CSS（Vuetify 按需）        | 733,985 B / 220,323 B gzip                                    |
| 总 JS（现状 → 按需）               | 2,407,783 → 2,071,040 B                                       |
| 总 JS gzip（现状 → 按需）          | 787,375 → 688,201 B                                           |
| 总 CSS（现状 → 按需）              | 590,965 → 253,985 B                                           |
| 总 CSS gzip（现状 → 按需）         | 86,817 → 39,089 B                                             |
| 构建耗时（现状 → 按需）            | 22.81 s → 10.59 s                                             |
| `dist/`                            | 13 MB（含 6.9 MB sourcemap）                                  |
| `node_modules`                     | 381 MB / 972 包                                               |
| 自有代码                           | 20,919 行（`src/`，不含 foliate）                             |
| vendored foliate-js                | 9,668 行 JS + 12 MB vendor                                    |
| 测试                               | 73 passed / 0 failed（984 ms）                                |
| tsc                                | 13 errors                                                     |
| Vuetify：全量 vs 32 组件           | 640,759 / 202,852 gzip vs 281,454 / 91,036 gzip               |
| Vuetify CSS                        | `lib/styles/main.css` 301,232 B；`dist/vuetify.css` 680,355 B |
| openai                             | 131,177 B / 31,639 B gzip                                     |
| CodeMirror 组合                    | 525,609 B / 172,651 B gzip                                    |
| vue-toastification                 | 19,516 B / 6,710 B gzip（CSS 15,795 B）                       |
| tinycolor2                         | 15,282 B / 5,335 B gzip                                       |
| js-md5                             | 11,075 B / 3,856 B gzip                                       |
| @mdi/js × 8 图标                   | 1,999 B / 927 B gzip                                          |
| @vueuse/core × 8 函数              | 9,588 B / 4,223 B gzip                                        |
| @material/material-color-utilities | 94,484 B / 21,714 B gzip                                      |
| Tailwind 产物                      | 14,609 B / 3,154 B gzip                                       |

---

## 附录 C：来源

- npm registry 实时查询（2026-10-27）：各包 `dist-tags.latest` 与 `time` 字段。
- GitHub API：`johnfactotum/foliate-js` 最后提交 2026-05-01；`tauri-apps/tauri` 最新 tag `tauri-v2.12.5`；`seanmonstar/reqwest` 最新 `v0.13.5`。
- 本地：`pnpm-lock.yaml`、`src-tauri/Cargo.lock`（614 个 crate）、`node_modules` 实际安装物。
