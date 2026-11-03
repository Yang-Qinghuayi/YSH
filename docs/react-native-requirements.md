# YSH React Native 首期需求文档

> **已更新决策：** 阅读器改为 react-native-readium，样式改为 NativeWind v5 RC，第一版扩大到上游支持格式及手机/平板响应式。已确认只覆盖 Android/iOS 手机和平板、只支持无 DRM 的 EPUB/PDF、永久不支持 LCP；以下保留早期调研记录；冲突处以[最新方案](./react-native-plan.md)为准。

- 日期：2026-11-02
- 基线：`1bba06f`，以本仓库源码为准，README 只作参考。
- 状态：调研稿，尚未开发 RN 应用。默认目标 Android + iOS 手机，本地优先、无需账号、导入后离线阅读；平板优化、Web/桌面 RN 不作为首期承诺。
- 配套：[技术选型调研](./react-native-research.md)。

## 1. 当前项目能力盘点

“类型/底层支持”不等于“已提供完整可用的界面”。以下区分明确实现与待验证内容。

| 功能域 | 源码事实及入口 | RN 首期处理 |
|---|---|---|
| 运行平台 | Vue + Vite；`services/environment.ts` 按平台选择 `NativeAppService`（Tauri）或 `WebAppService` | RN 重写 UI 和平台适配，保留服务分层思想 |
| 书籍解析与排版 | `libs/document.ts` 包装内嵌 `foliate-js`，不是从零自研的 EPUB 内核。检测 ZIP/PDF/MOBI 等，解析元数据、目录、封面，`foliate-js/view.js` 串联排版 | 必须；先只承诺无 DRM、可重排 EPUB 2/3 |
| 其他格式 | 加载器分支包含 PDF、MOBI（内核含 KF8/AZW3）、CBZ、FB2、FBZ；`BaseAppService.importBook` 将 TXT 转 EPUB。PDF 内核说明为实验性且依赖 PDF.js，不能只据分支认定完整可用 | 全部延期，包括 TXT 转换和固定版式 EPUB；遇到不支持的书应明确提示 |
| 通用导入 | `types/system.ts` 定义接口，`services/appService.ts` 的 `BaseAppService.importBook` 统一路径/URI/浏览器 File；适配层实现打开、复制、读写文件。提取标题/作者/语言/封面，partial MD5 去重，保存书本与配置；重导入更新元数据、不覆盖既有配置 | 必须；重写 RN 的 URI/文件实现，不迁移 File/Blob 签名 |
| 导入界面 | `pages/library/Library.vue` 多文件选择、逐本导入、失败提示、保存书库。桌面外部打开处理中的自动跳转存在 TODO | 首期文件选择导入；系统“用本应用打开”、分享接收延期，不能当作已完成的移动能力 |
| 本地书库 | `BaseAppService.loadLibraryBooks/saveLibraryBooks/deleteBook`，索引、封面、每书配置落盘；Web 文件适配使用 IndexedDB | 必须：列表、封面占位、打开、删除、最近阅读 |
| 阅读导航 | `pages/book/book.vue`、`components/TOCView.vue`、`hooks/usePageFlip.ts`：目录、分页/滚动、进度；`useFoliateEvents.ts`、`readerStore.ts` 处理 relocate | 必须：单页分页、滚动、目录跳转、进度恢复；双页与桌面键盘快捷键延期 |
| 阅读排版 | 阅读设置 Menu 暴露宽度、字号、字重、滚动/双列、覆盖字体、字体选择；viewSettings 存在更丰富排版字段 | 首期字号、边距、行高、系统字体/有限内置字体；不能把所有类型字段都视为已完成 UI |
| 进度持久化 | `hooks/useProgressAutoSave.ts` 监听进度、约 1 秒节流保存；配置序列化位于 `utils/serializer.ts`，恢复使用引擎位置 | 必须；增加退后台/离开阅读器时落盘，不仅依赖节流 |
| 注释和搜索 | `types/book.ts` 定义书签/注释/摘录；`types/view.ts`、Foliate 有 annotation/search API | 不据此宣称完整产品闭环；首期排除书签、高亮、笔记、全文搜索 |
| 段落复制 | `hooks/useCopyParagraph.ts` 及测试，设置页可启用三击复制 | 桌面交互不照搬；手机先保留系统长按选字/复制能力，待真机验证 |
| 全局主题 | `utils/materialYou.ts` 使用官方 MCU 的 HCT + SchemeTonalSpot；4 个种子预设、自定义种子；`useMaterialYouTheme.ts` 写入 Vuetify，再派生 Tailwind CSS 变量 | 必须；复用算法，重写 RN/Paper/WebView 三端 token 应用 |
| 主题模式/字体 | `usePreferredDark()` 跟随系统；`store/setting.ts` 用 localStorage 存预设、种子、字体；`readerTheme.ts` 从 DOM CSS 读取正文颜色 | 首期支持系统/浅/深三态（手动三态为新增要求）；保留预设与自定义种子、重启恢复 |
| 小说/AI/资料库 | CodeMirror 小说编辑、章节、角色、Lore、记忆、Agent、API Key；`services/importService.ts` 是 AI 小说结构导入，与电子书导入不是一回事 | 全部不迁移；不保留相应路由、设置、依赖或模型请求 |
| 其他应用能力 | 导航、国际化资源、全局搜索、工作区、Tauri 深链/CLI 等 | 只抽取阅读所需文案和导航；不作为首期全量复刻项 |

## 2. 产品范围与流程

**目标：** 选择一本本地 EPUB → 导入书库 → 阅读并自动记住位置 → 切主题后正文与 UI 一致 → 重启继续阅读。

页面仅三类：
1. **书库**：空态、导入按钮、书籍列表（标题、作者、封面/占位、阅读进度）、点击打开、删除确认。
2. **阅读器**：正文、上一页/下一页、目录抽屉、阅读进度、排版设置、返回书库。手机手势避免与系统返回冲突。
3. **设置**：主题模式、4 个预设、自定义十六进制种子色及校验/预览；不出现 Agent/API Key/小说工作区入口。

## 3. 首期功能需求与验收

| ID | 需求 | 验收口径 |
|---|---|---|
| IMP-01 | 系统文件选择器导入本地 EPUB，允许多选 | Android document provider、iOS Files 各跑通过；取消无报错，单个失败不影响其他书 |
| IMP-02 | 接管文件生命周期 | 选择后复制到应用持久目录，源文件移动/删除、系统清缓存后仍能读；不持久化临时 URI 作为唯一来源 |
| IMP-03 | 校验格式、内容与安全边界 | 不只检查扩展名/MIME；空文件、伪装 ZIP、缺失 OPF、损坏压缩、DRM 各有可理解错误，不留半条索引 |
| IMP-04 | 元数据、去重、事务化导入 | 标题/作者/封面缺失有回退；相同内容再次导入不重复、不重置进度；异常时清理临时文件，成功后再提交索引 |
| LIB-01 | 本地书库与删除 | 重启列表仍在；删除需确认，只删应用管理的副本/配置/封面，不动用户原文件 |
| READ-01 | EPUB 正文呈现 | 中文/英文、章节图片、内嵌 CSS、目录层级正确；长章分页/滚动能跨章，无重复/漏段；脚注与内部链接行为验证 |
| READ-02 | 导航 | 目录跳到对应章节/锚点；上一页下一页可靠；分页/滚动切换保持文本位置 |
| READ-03 | 排版 | 字号、边距、行高调整即时生效、可持久化；重排/旋转后尽量保持同一文本位置，不把动态页码当持久定位 |
| READ-04 | 保存与恢复 | 位置变化节流保存；退后台/退出阅读器主动刷新。正常退出重进回到最近文本位置；强杀允许丢失最后一次节流窗口内的进度，具体窗口在 POC 后固定 |
| THEME-01 | 模式 | 跟随系统、强制浅色、强制深色；系统变化只影响“跟随系统”，重启不丢选择 |
| THEME-02 | 种子取色 | 沿用 4 预设；支持 `#rgb`/`#rrggbb`，非法值不覆盖有效设置；同算法/同版本输入得到确定颜色 |
| THEME-03 | 全局一致 | 书库、导航、弹窗、控件、状态栏与正文同步更新；未加载及新章节也用当前主题，无重开书才生效问题 |
| DATA-01 | 离线与恢复 | 导入完成后飞行模式可重启、开书、翻页、换主题；所有脚本/字体/阅读资源随应用或书本本地提供 |
| SEC-01 | 不可信书籍隔离 | 默认阻止书内脚本及外部资源、外链需确认；桥接消息类型/长度/来源/载荷校验，不给书籍任意文件或原生调用能力 |
| UX-01 | 可用性 | 加载/失败/重试/取消反馈清晰；触控、刘海安全区、系统字号、VoiceOver/TalkBack 基础操作可用 |

### 3.1 数据模型（设计建议，不是现有 RN 代码）

- `BookRecord`：id、contentHash、format、title、author、relativeFilePath、relativeCoverPath、createdAt、lastReadAt；路径相对应用目录，避免 iOS 容器路径变化。
- `ReadingProgress`：bookId、engineId、engineVersion、locator（CFI 或 Readium Locator）、fallbackHref、fraction、updatedAt。不同引擎的 CFI/locator 不保证互通。
- `ReaderPreferences`：fontSize、lineHeight、margin、readingMode、fontFamily。
- `ThemePreferences`：schemaVersion、mode（system/light/dark）、paletteId、seedHex。
- 文件存持久文件目录；小规模索引/偏好可用 AsyncStorage，书多后升级 SQLite；二进制绝不存 AsyncStorage/base64 索引。导入去重建议流式全文件哈希；旧 partial MD5 仅作兼容线索，不是安全校验。

## 4. 非目标

不迁移 Agent、AI 文本导入、小说编辑、角色/Lore/记忆、API Key；不做 DRM、付费书城、云同步、网络下载、OPDS、TTS、注释搜索、多格式、桌面快捷键。现有用户书库自动迁移不是默认需求，若需要另定导出包及进度转换规则。

## 5. 验证与推进顺序

1. **POC 门槛**：Android/iOS 真机离线开书、跨章、目录、CFI 恢复、主题热切换、长书内存、中文竖排/RTL 探针、不可信脚本隔离；比较 Foliate 与 EPUB.js 封装。
2. **闭环**：实现文件适配、书库索引、阅读器接口、进度与主题持久化；不得直接耦合 UI 到引擎 API。
3. **验收**：上述表逐项记录设备/OS/WebView/库版本、成功率、耗时及错误；测小书、图片多书、长章书、大书、损坏书、恶意书，后台/强杀/权限撤回/低存储一起测。
4. 性能需先测后定：记录导入耗时、首次打开耗时、稳定翻页延迟、峰值内存。当前没有 RN 基准，不能声称达到某个性能数字。

## 6. 待产品确认（不阻塞调研）

- 是否接受首期只支持无 DRM、可重排 EPUB？TXT、多格式、双页是否进入下一期？
- Android/iOS 是否同时发布；最低系统版本、首要测试机型？
- 是否要求旧书库/CFI 进度迁移？这会影响引擎优先级。
- 是否必须使用 Tailwind 风格？若不是，Paper + StyleSheet 可减少配置。
- 阅读正文是否必须跟随全局种子，还是另有护眼纸色？本稿默认前者。
