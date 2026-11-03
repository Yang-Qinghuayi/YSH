# React Native 第一版方案（最新决策）

更新：2026-11-02。本文优先于早期需求/调研中的候选结论。本文记录技术决策；现已新增 mobile/ 首版代码，运行与实际验证状态以[移动端 README](../mobile/README.md)为准，尚未完成原生编译或真机验收。

## 1. 已确认技术决策

- React Native + TypeScript；仅覆盖 Android/iOS 手机与平板。Web、Windows、macOS 不在产品范围内，不设计对应适配。
- Expo development build + Expo Router 为应用工程候选；Readium 的 Podfile、Gradle、Nitro 原生配置必须先构建验证，不能用 Expo Go 替代。必要时用 config plugin/prebuild 或维护原生工程，不为 Expo 限制牺牲 Readium 能力。
- **react-native-readium**：阅读器唯一选定路线。不使用 EPUB.js，不再以 Foliate 为并行候选。
- **NativeWind v5 RC + Tailwind CSS v4**：接受预发布风险；锁定精确版本与 lockfile，升级单独回归。查询时 nativewind@rc 为 `5.0.0-rc.1`，peer 为 `tailwindcss >4.1.11`、`react-native-css 3.1.0-rc.1`；不能套用 NativeWind v4 配置。
- **React Native Paper**：Material 组件，需与选定 React/RN 及 NativeWind RC 验证。
- **@material/material-color-utilities**：共享种子计算，统一语义 token，分别适配 Paper、NativeWind、Readium 阅读偏好；Readium 可暴露的颜色范围需验证，不假定其 theme API 覆盖任意 CSS。
- `expo-document-picker`、`expo-file-system`：系统文件选择、持久书籍和封面；原生工程兼容性在集成阶段确认。
- `@react-native-async-storage/async-storage`：小型偏好；**expo-sqlite** 作为书库、进度、书签、批注等结构化数据的建议存储（本次范围扩大后，不再建议把全部索引/注释堆入 AsyncStorage）。二进制存文件目录。
- `react-native-nitro-modules`、`react-native-safe-area-context` 及 Router/NativeWind 要求的配套依赖，按兼容矩阵安装；不直接组合所有 latest。

## 2. Readium 格式与平台边界

确认项目：5-stones/react-native-readium，npm 包名 `react-native-readium`，不是名称相近的 fork。查询时 latest 为 5.3.0，peer 为 RN >=0.78.0、Nitro >=0.35.0；这只是声明范围，不是完整联测证明。

上游 README 当前标明：

| 格式 | 第一版要求 | 注意 |
|---|---|---|
| EPUB 2 | 支持 | 分页/滚动、目录、定位、资源呈现 |
| EPUB 3 | 支持 | 可重排及固定版式分别验收；竖排、RTL、脚注、字体/图片需覆盖，不能只测普通中文小说 |
| PDF | 支持 | 上游描述为滚动、适配宽度；不能把 EPUB 字号/行高等可重排设置强加 PDF，也不能未验证就承诺 PDF 双页/搜索/高亮与 EPUB 完全对等 |
| CBZ | 不列为当前可支持格式 | 上游标为 roadmap；若锁定版本将来新增，再更新验收矩阵 |
| MOBI/AZW3/FB2/TXT/音频等 | 不因原生 Readium toolkit 有相关能力而自动纳入 | RN 封装公开支持能力才是范围基线 |

“支持所有格式”定义为：**锁定版本 react-native-readium 实际公开支持的所有格式，在目标平台逐项验证**，不是宣称支持底层 toolkit、路线图或所有电子书格式。

**已确认永久不支持 LCP 受保护书籍。** 不引入 `react-native-readium-lcp`，不设计许可证、授权、续期或解密流程。产品仅支持无 DRM 的 EPUB/PDF；检测到 LCP/DRM 时明确提示不支持，不尝试绕过保护。未来上游新增其他格式也不会自动扩充产品范围，需另行确认。

原生优先指调用 iOS/Android 的 Readium 集成、平台文件和交互能力；EPUB 导航内部仍可能基于 Web 技术，不承诺全原生 Text 排版，也不自行引入 EPUB.js。

## 3. 第一版阅读器范围

目标是完整、稳定、可扩展的阅读闭环，不再是只开 EPUB 的极简 MVP。“十分完美”转换为以下可验收项，不作为无缺陷保证。

### 书库与导入

- EPUB/PDF 多文件导入、真实格式/内容校验、元数据和封面、去重、失败隔离、取消反馈。
- 应用持久目录接管文件；原文件移走后仍可离线读。
- 最近阅读、进度、书籍详情、删除确认；导入与索引事务化、失败清理。

### 阅读导航与排版

- EPUB 分页/滚动、跨章、目录/内部锚点/脚注、前后翻页、稳定位置恢复。
- Readium Locator 为持久定位依据，保存引擎/版本和可用回退位置，不继续以 Foliate CFI 为默认数据协议。
- EPUB 字号、字体、行高、边距、对齐等以封装实际暴露能力实现；长章、中文竖排、RTL、图文、固定版式分别测。
- PDF 宽度适配与连续滚动、页位置恢复；缩放、页跳转等需先核验公开 API，缺失则明确原生扩展/上游贡献工作，不以同名底层 API 当作 RN 已支持。
- 旋转/调整窗口/切换阅读模式或字号后不丢当前位置；退后台和离开阅读器主动保存。

### 阅读工具（纳入首版产品范围，按格式能力验收）

- 书签添加、列表、跳转、删除。
- 选字、复制、自定义选择动作、高亮与笔记的创建/编辑/删除、持久化与恢复。
- 全文搜索、结果展示与定位、空结果/取消/大书反馈。
- 上游 README 宣称提供高亮/笔记/搜索，但各格式、平台支持度仍需查 API 和真机确认。建立 EPUB2/EPUB3/PDF × Android/iOS 能力表；缺失项明确补齐成本、降级或范围决策，不能静默省略。

### 主题与品质

- 四预设/自定义种子，system/light/dark，Paper/NativeWind/阅读器同步，重启恢复。
- 主题语义色只算一份，组件用 `bg-surface`/`text-on-surface` 等语义类；Paper 控件仍优先走其 theme。
- 离线、加载/重试/异常恢复、安全隔离、受控外链、压缩限额与资源权限。
- VoiceOver/TalkBack、动态字体、触控目标、对比度及阅读焦点基本验证。
- 记录开书耗时、翻页延迟、峰值内存、搜索耗时，选设备和样书后确定量化门槛，不预先编造性能承诺。

## 4. 跨端与响应式：第一版硬要求

已确认跨端仅指 **Android/iOS 手机与平板，横竖屏、分屏和动态窗口**。不适配 Web、Windows、macOS，不为这些平台建设路由、存储、资源服务或交付矩阵。

- 根据实时**可用窗口宽度**而非设备名称/一次性屏幕尺寸选择布局，使用 `useWindowDimensions` 和可共享断点 token；NativeWind 响应式类按 RN 实际窗口行为验证。
- 初步可用 compact <600、medium 600–839、expanded >=840 逻辑像素作为设计起点，非锁定标准；具体按内容最小宽度和实机修正。
- 书库：手机单/少列，平板自适应多列；卡片有最小/最大宽度、封面比例，不拉伸到铺满大屏。
- 导航：窄屏底栏/抽屉，大屏侧栏或导航轨；同一路由状态连续，不因跨断点重置书籍。
- 阅读：手机目录抽屉，大屏可固定目录侧栏；正文限制舒适行宽与留白。双页/多列是能力验证项，仅在对应格式和 navigator 支持时启用，不把放大正文当适配。
- 设置：窄屏单列，大屏分区/主从布局；弹窗限宽、合理锚定，避免手机尺寸对话框或全屏超宽表单。
- 触摸优先，同时验证平板键盘/指针；iPad Split View、Android 分屏、窗口拖动与横竖屏变化不丢选区、进度或未保存笔记。
- 上游虽包含 Web 实现，本项目不使用该交付目标；共享业务与响应式设计只服务于 Android/iOS 手机和平板。

## 5. 推进门槛与未确认项

1. 锁定 Readium、NativeWind v5 RC、React/RN/Expo/Nitro 组合，双平台 release 构建过关；依赖必须能在实际开发/CI 环境获取。本调研环境网络白名单不包含 CocoaPods/Maven 等，当前未进行原生构建。
2. 用同批 EPUB2/3（可重排/固定版式、竖排/RTL、图片/字体）、PDF、大文件/损坏文件建立格式×平台×功能矩阵；验证持久 locator、偏好、选择/批注、搜索和离线。
3. 手机/平板响应式原型与真机验收，包含旋转、分屏、主题同步和进度不丢失。
4. 完成数据库模型、可替换服务边界、主题适配后再扩展完整业务；不把第三方库 README 当成本应用完成证明。

已确认：仅 Android/iOS 手机和平板；仅 EPUB/PDF；永久不支持 LCP，不适配 Web/Windows/macOS。

后续工程阶段需确定：最低系统与首要测试设备；各格式阅读工具缺口的原生扩展方案。旧版书库迁移仍不默认包含；Agent/小说创作仍不迁移。

## 资料

- https://github.com/5-stones/react-native-readium （README 格式、功能、平台要求）
- https://github.com/5-stones/react-native-readium/tree/main/packages/react-native-readium
- https://registry.npmjs.org/react-native-readium/latest
- https://registry.npmjs.org/nativewind/rc （v5 RC 配套 peer 约束）
- https://github.com/nativewind/nativewind
