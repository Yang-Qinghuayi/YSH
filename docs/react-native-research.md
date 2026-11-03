# React Native 阅读器与主题系统：技术选型调研

> **已更新决策：** 阅读器改为 react-native-readium，样式改为 NativeWind v5 RC，第一版扩大到上游支持格式及手机/平板响应式。已确认只覆盖 Android/iOS 手机和平板、只支持无 DRM 的 EPUB/PDF、永久不支持 LCP；以下保留早期调研记录；冲突处以[最新方案](./react-native-plan.md)为准。

日期：2026-11-02。基于当前仓库与 npm registry、GitHub 官方仓库 README/源码的静态调研，**没有完成 RN/Hermes、Metro、iOS/Android 真机验证**。网络环境只允许 GitHub/npm 等少数域名，因此没有声称访问完整官网文档或跑通原生构建。版本是当日 registry 快照，不是已验证的兼容组合。

配套：[需求文档与现有功能盘点](./react-native-requirements.md)。

## 1. 结论先行

推荐基线：**React Native + TypeScript + Expo development build + React Native Paper + 官方 Material Color Utilities + 文件系统适配 + 可替换阅读引擎接口**。

- Tailwind 对应方案是 **NativeWind**，但不是把当前 Tailwind v4/CSS 原样搬过去。首期可先 Paper + StyleSheet，团队确实需要 className 时再加 NativeWind。
- Vuetify 不支持 RN；最贴合现有 Material 3 方向的是 **React Native Paper**。
- 电子书优先做两个小 POC：**Foliate + react-native-webview**（保留现有排版语义）与 **@epubjs-react-native/core**（更快搭 RN 闭环）。通过真机门槛后选一个，而不是静态调研就宣布某个“更好”。
- **可以继续 npm 引入官方 `@material/material-color-utilities`，不需要重写种子计算器。** 可复用的是 HCT/调色板/角色色计算；不能复用 DOM 的 `applyTheme`、Vuetify、Pinia 和 CSS 注入层。
- **Readium Swift/Kotlin Toolkit** 是更重的长期备选，不是一个可零成本替换的 RN JS 包，也不等于不用 WebView 排版。

## 2. 候选库与版本快照

| 用途 | 候选、当日版本 | 建议与限制 |
|---|---|---|
| Tailwind 风格 | NativeWind latest **4.2.7**；v5 **5.0.0-rc.1** | v4 稳定路线与 v5/Tailwind v4 路线分别评估；不以 peer `>3.3.0` 推断完整 Tailwind v4 兼容 |
| Material 组件 | react-native-paper **5.15.3**；v6 为 alpha | 首选稳定 v5；按钮、卡片、对话框、菜单、滑块等用对应 RN 组件重写，不能复用 Vue 模板 |
| EPUB RN 封装 | @epubjs-react-native/core **1.4.8** | 基于 EPUB.js + WebView，非原生排版；peer 包含 WebView、gesture-handler |
| Expo 阅读文件适配 | @epubjs-react-native/expo-file-system **2.0.0** | README 表示采用新 File/Directory/Paths，peer 要求 expo-file-system >=54.0.0；需与所选 Expo SDK 联测 |
| WebView | react-native-webview **14.0.1** latest；另有 next **16.0.0** | 必须按 Expo SDK 支持版本安装，不能盲装 latest/next |
| 底层 EPUB.js | epubjs **0.3.93** latest（2022-02-16 发布） | RN 封装仍在更新不代表底层无维护/安全风险；审计封装实际内嵌脚本版本及补丁 |
| 种子计算 | @material/material-color-utilities **0.4.0** | 与本仓库一致；Apache-2.0，纯算法部分无原生模块 |
| 文件选择 | expo-document-picker **58.0.4** | 用 `npx expo install` 匹配 SDK；选择 URI 之后复制/接管文件 |
| 本地文件 | expo-file-system **58.0.13** | 持久目录存书与封面，缓存目录只存可重建内容；与旧 API/阅读封装版本联测 |
| 小数据持久化 | @react-native-async-storage/async-storage **3.1.1** | 偏好/小索引；不存整书；数据增长再考虑 SQLite |
| 组件替代 | Tamagui **3.1.10**、@gluestack-ui/core **5.0.15** | 更偏跨端设计系统/可定制组件；不自带本项目 MCU 主题链路，需自己接 token |
| 样式替代 | react-native-unistyles **3.7.0** | 主题式 StyleSheet 替代，非 Tailwind；当前 peer 含 RN >=0.81、Nitro 等，对构建约束更高，首期非必要 |

以上常见 JS 包 registry license 多为 MIT；EPUB.js 为 BSD-2-Clause，MCU 为 Apache-2.0。发布前按**实际锁定依赖和内嵌脚本**做许可证清单；不能只检查顶层包。

资料：[NativeWind README](https://github.com/nativewind/nativewind)、[Paper](https://github.com/callstack/react-native-paper)、[EPUB RN](https://github.com/victorsoares96/epubjs-react-native)、[Expo 文件适配](https://github.com/victorsoares96/epubjs-react-native-expo-file-system)、[WebView](https://github.com/react-native-webview/react-native-webview)。版本核对入口为 npm registry，例如 [NativeWind](https://registry.npmjs.org/nativewind)、[MCU](https://registry.npmjs.org/@material%2fmaterial-color-utilities)、[Paper](https://registry.npmjs.org/react-native-paper)。

## 3. Tailwind：能保留习惯，不能保留浏览器假设

NativeWind 将工具类转换到 RN 样式系统，支持 className、主题变量、dark mode 等；它**不是组件库**。当前 `src/styles/tailwind.css` 的 Vuetify CSS RGB 变量、SCSS、DOM 选择器和任意浏览器布局不能直接复用。

- 原生用 `View/Text/Pressable`，而不是 div/span；所有 Tailwind 类需在 RN 支持范围内验证。
- 运行时颜色放 token/vars，不拼接 `bg-${color}` 让编译器猜；不要假定 CSS 级联能穿透 Paper 组件。
- Paper 组件优先用 `theme`、`style`、`contentStyle` 等 API；需要 className 互操作时做小型包装/interop，不全面双写颜色。
- WebView 正文仍是 CSS，但不会自动继承外层 NativeWind 变量，必须通过桥接单独更新。
- 推荐先不把 NativeWind 作为阅读器阻塞依赖。若选 v4，按其版本指南锁 Tailwind 3 路线；若坚持复用 Tailwind v4 工作流，单列 v5 RC 兼容实验，不默认生产采用 RC。

替代选择：内建 StyleSheet（依赖最少）；Unistyles（主题/响应式更系统，但原生依赖更重）；Tamagui（连同组件体系迁移时考虑）。不要三套样式系统同时铺开。

## 4. Vuetify：Paper 最接近，但不是一对一移植

Paper 的 MD3 theme 与本项目 Material You 目标一致。替换的是设计角色，而不是 Vue API：`v-btn → Button`、`v-card → Card`、`v-dialog → Portal + Dialog`、`v-menu → Menu`。RN 导航另用 Expo Router 或 React Navigation，不把 Paper 当完整路由框架。

Tamagui 更适合追求 Web/Native 共享设计系统；gluestack 更适合深度定制/工具类习惯。这两者均需额外设计 Material 角色映射；当前需求更适合 Paper，减少重建主题语义的工作。

Paper 默认 light/dark theme 要保留完整结构，并覆盖种子生成的颜色。除 primary 等常见颜色，还要处理 `on*`、container、outline、surface、inverse、`surfaceDisabled/onSurfaceDisabled`、`backdrop`、`elevation.level0..5`。只换 primary 不算全局动态主题。

## 5. EPUB：解析器不等于完整阅读器

EPUB 是 ZIP 容器中的 OPF/目录/XHTML/CSS/资源。解压/XML 库只能解决前半段；分页、图片/字体加载、竖排、CFI、选字和章节生命周期才是主要成本。RN 的 Text 不是 HTML/CSS 浏览器引擎，不建议把每个 XHTML 解析成 Text 树来重写 EPUB 排版。

| 路线 | 收益 | 代价/风险 | 定位 |
|---|---|---|---|
| **Foliate + react-native-webview** | 复用本仓库内核、目录/CFI/排版/现有测试经验；潜在多格式扩展 | 自建本地 HTML/ES module 资源打包、文件资源加载及消息桥；需验证 iOS WKWebView 和 Android WebView 特性、字体解混淆/Web Crypto、安全策略 | 保留现有阅读效果、迁移旧进度优先时先验证 |
| **@epubjs-react-native/core** | 已有 ReaderProvider/Reader/useReader、目录、initialLocation/onLocationChange、changeTheme/font API，Expo 文件适配，可较快完成闭环 | 底层仍 WebView + EPUB.js；CFI 与 Foliate 不保证互通；依赖第三方封装维护；大书内存、本地资源、竖排需验证 | RN 新应用、基础 EPUB 快速落地候选 |
| **直接 EPUB.js + WebView** | 比封装可控，按需桥接 | 同样承担文件、安全、离线、桥接与生命周期；底层 latest 较老 | 只有封装无法满足且团队愿维护时使用 |
| **Readium Swift/Kotlin Toolkit** | 原生平台工具链提供 publication、navigator、preferences、定位、无障碍等；有 EPUB2/3 支持与长期扩展路径 | RN 侧需要 Native Module/View 与双平台原生开发；Readium EPUB 导航内部仍可能用 Web 技术；构建/版本约束更重。LCP 需额外二进制与授权流程 | 要专业阅读能力、无障碍/DRM 路线时另立专项 |

Readium 资料：[Kotlin toolkit](https://github.com/readium/kotlin-toolkit)、[Swift toolkit](https://github.com/readium/swift-toolkit)。当前上游分支可能包含 alpha，不应把 develop 的最低系统/构建要求当成锁定稳定版要求。

### 5.1 推荐选择过程

- 同一批样书对比两条首选路线，记录开书、翻页、目录、重排恢复、主题、新章节配色、图片/脚注、离线、大书内存。
- 若 Foliate 的本地模块/文件加载与 WKWebView 安全隔离可维护，且旧进度/竖排重要，优先保留；若集成成本超标，而 EPUB RN 达到功能门槛，就选封装。
- 不把 CFI 名称相同当可跨引擎迁移保证。位置中存 engine/version，并保留章节 href/fraction 回退；测试后才承诺旧进度迁移。
- 不引入临时 HTTP 服务作为默认前提；若本地资源/模块跨域问题必须由本地服务解决，单独评估额外原生模块、端口与安全成本。

### 5.2 必须处理的安全与离线问题

本仓库 `src/foliate-js/README.md` 已明确警告：书籍脚本与 iframe/blob 同源可能不安全，必须有 CSP 等防护。EPUB RN README 的 `allowScriptedContent` 甚至写明 Android 默认 false、iOS 默认 true，**必须显式设定并真机验证，不能信任默认值**。

宿主阅读 JS 需要运行，不等于允许 EPUB 内脚本运行。禁用书内脚本/弹窗、阻止外部资源与任意导航；外链只经受控原生确认；限制 file 访问到书籍/资源目录；桥接只接受白名单消息，书籍页面不能执行任意原生代码。HTML/CSS 资源路径需规范化，防 ZIP 路径穿越/解压炸弹（限制条目数、总解压大小、压缩比）。CSP、URL 拦截、内容清理按实际内核联测，不能只靠一个布尔参数宣布安全。

检查封装实际打包的 EPUB.js、ZIP、字体和其他脚本是否来自 CDN；README 不构成“首次离线必可用”的证据。使用发布构建、清缓存、飞行模式验证。

## 6. Material You：官方 JS 能否直接用？

**能复用计算部分，不能原样复用浏览器主题应用方法；集成仍需 Metro/Hermes 验证。** 当前项目已经通过 npm 使用该官方库，不需要复制官网计算器或自己翻译算法。优先锁版本安装、保留许可证，而不是复制一段不可追踪的 JS。

现有链路：

```
seed → Hct + SchemeTonalSpot → Vuetify kebab-case colors
     → --v-theme-* → Tailwind/CSS → getComputedStyle → EPUB iframe
```

建议 RN 链路：

```
seed + resolvedDarkMode → MCU → canonical camelCase Material roles
                              ├─ Paper theme / Navigation theme / RN styles
                              ├─ NativeWind vars（可选）
                              └─ ReaderTheme 消息 → WebView CSS（当前及未来章节）
```

### 6.1 可复用与不可复用边界

- `argbFromHex`、`Hct`、`SchemeTonalSpot`、`hexFromArgb`：数值算法，适合作为共享核心。
- `paletteConfig.ts`：4 个预设 id/种子可保留；hex 校验逻辑可保留。
- `utils/materialYou.ts`：生成逻辑可提取，但现有返回值是 Vuetify 专用映射，不应直接塞 Paper。
- `applyTheme` 使用 document/HTMLElement/CSS style；`themeFromImage` 使用 HTML 图片/图像读取，不适用于 RN 原生环境。未来封面提色需要原生图像像素读取或另选库，首期不需要。
- `useMaterialYouTheme.ts`、Pinia/usePreferredDark/localStorage、`readerTheme.ts` 的 getComputedStyle 必须重写为 React context/store、RN useColorScheme、异步存储和显式 ReaderTheme。
- 手动输入种子并不等于读取 Android 壁纸动态色；后者要额外平台 API，iOS 也没有等价的 Android 壁纸角色色接口。本次只实现可移植的种子方案。

### 6.2 示例：共享角色色核心（架构草图，未作为 RN 代码落地）

```ts
import { argbFromHex, Hct, SchemeTonalSpot, hexFromArgb }
  from '@material/material-color-utilities';

export function createCoreRoles(validatedSeed: string, dark: boolean) {
  const s = new SchemeTonalSpot(Hct.fromInt(argbFromHex(validatedSeed)), dark, 0);
  return {
    primary: hexFromArgb(s.primary),
    onPrimary: hexFromArgb(s.onPrimary),
    primaryContainer: hexFromArgb(s.primaryContainer),
    onPrimaryContainer: hexFromArgb(s.onPrimaryContainer),
    background: hexFromArgb(s.background),
    onBackground: hexFromArgb(s.onSurface),
    surface: hexFromArgb(s.surface),
    onSurface: hexFromArgb(s.onSurface),
  };
}
```

此例只说明调用方式，不是完整 Paper theme。生产实现必须补齐 secondary/tertiary/error/outline/inverse/surface containers 等，并保留 Paper fonts、roundness、animation、dark、version 等结构，针对 disabled/backdrop/elevation 做适配；导航与状态栏也订阅同一份 theme。

**不要为了方便改成 `themeFromSourceColor` 后宣称与现有视觉一致。** 当前用的是 SchemeTonalSpot，官方 themeFromSourceColor 走 CorePalette + Scheme，两条算法路径可能不同。

### 6.3 当前映射存在兼容性取舍

从本仓库源码可见：secondary 用 tertiary；onContainer 多处用 onSurface；outline/outlineVariant 对调；errorContainer/onError 等有硬编码，深色模式没有完整使用 scheme 角色。迁移前需选择：

1. 精确复刻旧观感：单独保留 legacy mapper，并测试；
2. 推荐方案：核心角色遵守标准 Material 语义，Paper/WebView 各自消费同一核心，接受少量视觉变化。

不要机械地仅把 kebab-case 转 camelCase；也不要把当前映射缺陷一并当成官方算法行为。常规文本对比度至少按 4.5:1、大字 3:1 做自动检查和人工抽查。

### 6.4 本次验证的实际边界

读取了官方源码 `typescript/utils/theme_utils.ts`，确认 DOM 应用层与数值算法可分离；检查 npm 0.4.0 发布包时，Node 22 原生 ESM 导入遇到 `dynamiccolor/dynamic_scheme` 的无扩展名模块解析错误，**本次没有得到成功运行的颜色 smoke test**。这不等于 Metro 一定失败（解析策略不同），但也不能声称“安装即可保证兼容 RN”。POC 必须覆盖根入口打包、Hermes release、4 种子 × light/dark 快照；若有问题，优先采用已验证版本/可追踪补丁，而不是修改 node_modules 后无记录发布。

资料：[官方 MCU](https://github.com/material-foundation/material-color-utilities)、[主题工具源码](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/utils/theme_utils.ts)、[SchemeTonalSpot](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/scheme/scheme_tonal_spot.ts)。

## 7. RN 架构与可复用资产

```
app: 书库 / 阅读 / 设置
 ├─ LibraryService → FilePickerPort + FileStoragePort + LibraryRepository
 ├─ ReaderController → ReaderEnginePort → FoliateWebView 或 EpubJsReader
 └─ ThemeProvider → MCU core → Paper/Navigation/NativeWind/ReaderTheme
```

- 阅读端口：open、close、next、prev、goTo、setPreferences、setTheme；事件 ready/locationChanged/error。生命周期要有 ready 握手、消息 requestId/schemaVersion、重新挂载后重放最新主题与位置。
- 文件端口输入统一为 `{ uri, name?, mimeType?, size? }`，不能假定 Android content URI 是普通路径，也不要继续把浏览器 File 当跨平台契约。
- 复制到临时 staging → 校验/限额 → 提取元数据与封面 → 算哈希 → 移到持久目录 → 提交索引。失败回滚；并发/重复导入有锁或队列。
- 设置启动异步恢复完成再展示正确主题，避免先默认再闪色；前后台变化主动保存位置，WebView 销毁后可重建。
- 可移植：种子配置、hex 校验、部分类型/元数据格式化、可验证的 CFI 工具/纯函数与测试思路。
- 需适配：序列化、去重/文件路径策略、阅读设置转换。
- 必须重写：Vue 页面/Pinia/composables、Vuetify、DOM CSS、Tauri/IndexedDB 适配、WebView 桥接。Foliate 留在 WebView，不直接进入 RN 原生运行时。

## 8. 推荐落地步骤与退出条件

1. 定 RN/Expo SDK 支持矩阵，用 `expo install` 配原生依赖；固定 lockfile，不将上述 latest 表直接组合安装。
2. 最小双引擎 POC；iOS/Android 各验证本地 EPUB、CFI、目录、跨章、离线与安全。若只用 Expo Go 测试，不算原生发布验证。
3. MCU/Paper 小 POC：补全颜色角色、light/dark、持久化、WebView 新章节同步；跑 Metro/Hermes release。
4. 选定引擎后做需求文档中的书库/导入/阅读/主题闭环。
5. 性能/安全/无障碍验收后才排 TXT、书签、多格式等二期；若需要 DRM/复杂出版能力，重新评估 Readium。

最终建议不是“RN 重写 EPUB 引擎”，而是“RN 重写应用壳和服务适配，复用成熟 Web 排版或原生出版工具链；Material 颜色算法继续共享”。
