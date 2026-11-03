# YSH 阅读 · 移动端

> 一个本地优先的 EPUB / PDF 阅读器，基于 React Native Readium，面向 Android、iOS 手机与平板，提供种子色驱动的 Material 主题。

这段话可以直接用于项目介绍。更完整的介绍：

**YSH 阅读是一个不依赖账号或云同步的移动阅读应用。书籍、阅读进度、书签和笔记保存在设备本地；使用 Readium 原生集成承载 EPUB/PDF 阅读，通过 Google 官方 Material Color Utilities 从一颗种子生成全局主题，结合 NativeWind v5 RC 和 Material 3 组件完成手机、平板及分屏布局。项目不包含 AI 创作功能，不适配 Web/桌面，永久不支持 LCP/DRM。**

## 当前状态：首版实现，等待原生设备验收

这是仓库中的独立工程，根目录的 Vue/Tauri 应用不受影响。以下页面和数据流程已有代码，**不代表已在 Android/iOS 真机完成验收，也不是可以直接发布商店的成品**。

| 功能     | 当前实现                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------- |
| 导入     | 系统文件选择、多选、EPUB/PDF 内容识别、SHA-256 去重、失败回滚、取消剩余任务、持久副本、缓存清理      |
| 书库     | 标题/作者/封面或占位、最近阅读排序、标题/作者筛选、多列、删除确认；重新导入可修复丢失的副本          |
| 阅读     | ReadiumView、目录/章节跳转、前后翻页、原生手势、可用位置跳转、EPUB 分页/滚动、PDF 宽度适配滚动       |
| 位置     | Readium Locator 持久化，800ms 节流；退后台、失焦、退出主动刷新；重开恢复                             |
| 排版     | EPUB 字号、字体、行高、边距、大屏双页/双列；按当前出版物 capabilities 禁用不适用控件                 |
| 阅读工具 | 书签、高亮、笔记编辑/删除/跳转，选字复制，分页搜索与结果跳转；受格式/原生能力限制                    |
| 主题     | 4 个种子预设、自定义 #rgb/#rrggbb、system/light/dark、设置持久化、统一 Paper/NativeWind/Readium 颜色 |
| 响应式   | 实时窗口宽度驱动书库列数、侧栏/底部导航、目录侧栏/弹层、正文限宽、设置分栏；支持旋转与分屏的设计     |

EPUB2/3 可重排与固定版式、竖排/RTL、脚注、嵌入字体，以及 PDF 的搜索/选字/批注，最终均需对具体设备和样书验证。PDF 不会像 EPUB 一样改变文字字号，也不会自动把白色扫描页改成深色；扫描件没有文字层时不会凭空提供搜索/OCR。

## 技术栈与版本

- Expo SDK **57.0.22**，React Native **0.86.3**，React **19.2.3**，TypeScript。
- `react-native-readium` **5.3.0** + `react-native-nitro-modules` **0.35.0**。不使用 EPUB.js，不安装 LCP 配套包。
- NativeWind **5.0.0-rc.1** + `react-native-css` **3.1.0-rc.1** + Tailwind **4.1.18**。
- React Native Paper **5.15.3**，Material Color Utilities **0.4.0**。
- Expo Router、SQLite、文件系统、系统文件选择器；AsyncStorage 保存偏好。
- `fflate` + `fast-xml-parser` 只负责导入前检查和元数据，不另造排版引擎。

**使用 `package-lock.json` 和 `npm ci`，不要在此子工程用根目录 pnpm 安装，也不要直接把所有依赖升级到 latest。** `react-dom` 仅为 Expo/Router 间接依赖锁定同版 React 的 peer，不表示提供 Web 应用。

## 1. 准备环境

共同要求：

- **Node.js 24+**、npm（Readium 的部分间接依赖要求 Node 24）。例如 `nvm install 24 && nvm use 24`。
- Git；首次安装/原生构建可联网访问 npm、Google Maven、Maven Central、JitPack，以及 iOS 的 CocoaPods/Readium spec 源。
- 足够的原生构建空间。浏览器预览和 Expo Go 都不能运行本项目的 Readium 原生模块。

Android：

- Android Studio、SDK、模拟器或开启 USB 调试的真机；`adb devices` 能看到设备。
- JDK 17，正确配置 `JAVA_HOME`、`ANDROID_HOME` 和 platform-tools。
- 当前 RN 模板使用 API 36、Build Tools 36 和 NDK 27.1.12297006；以生成工程/Gradle 提示的工具版本为准。Readium 的 Kotlin 2.3.20、JitPack、Java API desugaring 由配置插件写入。
- 产品最低 Android 版本受 Expo/RN/Readium 组合约束；当前 RN 声明 minSdk 24，不是最低版本设备已经测试通过的保证。

iOS：

- **必须使用 macOS**，安装匹配 Expo SDK 57 的 Xcode、Command Line Tools、iOS Simulator、CocoaPods。
- Readium 自身要求 Xcode 16.4+；当前 Expo/RN 组合可能要求更新工具，按本机 Xcode/SDK 的实际构建检查处理。
- 当前生成模板 deployment target 为 **iOS 16.4**，iPad 支持开启，未要求全屏；不要仅依据 Readium 的 iOS 15.1 最低要求下调整个应用。
- 真机需要你自己的 Apple 开发签名；修改 `app.config.ts` 中的 bundle identifier 后重新 prebuild。

## 2. 安装与运行

从仓库根目录进入移动端工程：

```bash
cd mobile
node --version             # v24 或更高
npm ci
npm run check             # 类型检查 + 自动化测试
```

### Android

先打开 Android 模拟器或连接真机：

```bash
npm run android
```

该命令生成原生工程、编译安装 development build 并启动 Metro。后续只改 JS/TS 时：

```bash
npm start
# 在已安装的开发客户端打开 Metro 显示的开发地址
```

真机与电脑需要能够互通；开发时从 Metro 输出中选择可达的局域网地址，或按 Expo/adb 的 USB 调试方式连接。不要把浏览器里的 localhost 地址当手机可以访问的电脑地址。

### iOS（仅 macOS）

```bash
npm run ios               # 编译安装到模拟器；CLI 会处理 pods
# 若需真机，在本机用 npx expo run:ios --device，完成开发签名
```

### 只生成原生工程

```bash
npm run prebuild
# 可用 npx expo prebuild --no-install 只生成，不安装原生依赖
```

`plugins/withReadium.cjs` 自动增加 Readium CocoaPods spec 源、Podfile helper 和 Android desugaring，`expo-build-properties` 设置 Kotlin/JitPack。`android/`、`ios/` 是生成文件，不纳入 Git；不要只在里面手改配置后期待重新生成仍保留。需要修改时更新 app config/config plugin。`prebuild --clean` 会删除这两个生成目录中的手动改动，执行前先备份。

### 发布模式验证（不是商店发布）

```bash
npm run android:release
npm run ios:release       # macOS
```

这些命令用于本地 Release 配置测试。Android 生成模板可能使用 debug signing，**不能作为商店正式签名**。商店证书、隐私声明、版本号、发行流程需单独配置。

首次验证：导入自己有权使用的无 DRM EPUB/PDF → 打开/翻页 → 退出重开 → 换主题 → 旋转/分屏 → 书签/笔记/搜索。验证离线请使用 Release 构建，开发客户端运行 JS 仍可能依赖电脑上的 Metro。

## 3. 测试与打包检查

```bash
npm run check             # TypeScript + 测试
npm run bundle:check      # Android/iOS JS + Hermes bundle；不编译 Swift/Kotlin
npm run format:check      # 格式检查
```

本次环境中验证过：

- TypeScript 严格检查。
- 28 个自动化测试：种子与对比度、真实 Tailwind/NativeWind 编译、响应式判断、格式/ZIP/CRC/DRM 检查、导入取消/去重/失败回滚、真实内存 SQLite CRUD/级联删除、进度刷新、阅读偏好单位转换、原生插件幂等。
- Android/iOS 的 Metro + Hermes bundle 导出。
- Android/iOS `expo prebuild --no-install`；已检查 Podfile helper、Kotlin 和 desugaring 插入。
- `npm ci` 锁文件可重复安装。

**未完成的验证：**当前执行环境没有 Android SDK/JDK/Xcode/CocoaPods/设备，且网络白名单不覆盖原生依赖仓库。因此没有生成 APK/IPA，没有跑 Gradle/Swift 编译，没有真机/UI 端到端验收。通过 bundle/prebuild 不能证明原生 API 行为无误。

详细真机清单见 [设备验收矩阵](./DEVICE-TESTING.md)。

## 4. 项目结构

```text
mobile/
├── app/
│   ├── _layout.tsx           # Provider、路由、全局提示
│   ├── index.tsx             # 书库、导入、删除
│   ├── settings.tsx          # 主题与全局阅读偏好
│   └── reader/[id].tsx       # 加载本地书籍
├── src/
│   ├── components/Reader.tsx # Readium、目录、搜索、书签/笔记、排版、响应式面板
│   ├── components/Shell.tsx  # 手机导航 / 大屏导航轨
│   ├── domain/               # 模型、输入校验、导入检查、阅读偏好映射
│   ├── services/             # 导入事务、Expo 文件适配、SQLite、进度、搜索、应用状态
│   └── theme/colors.ts       # 官方种子计算与主题 token
├── plugins/withReadium.cjs    # 可重现的原生集成配置
├── tests/                    # 不需要模拟器的自动化测试
└── app.config.ts             # 仅 ios/android 平台
```

数据：应用 Documents 下 `library/{sha256}.epub|pdf`，封面同 hash；SQLite `ysh-reader.db` 保存书籍/locator/批注；AsyncStorage `ysh.mobile.settings.v1` 保存偏好。数据库只保存相对文件名，iOS 容器绝对路径变化不影响记录。卸载会清除这些本地数据，目前未实现导出备份/旧桌面数据迁移。

主题链路：`seed + resolved mode → MCU → canonical roles → Paper theme / NativeWind VariableContextProvider / Readium preferences`。NativeWind 使用运行时语义变量，不在业务里拼接颜色类名；Paper 的 Portal 也位于同一个变量 Provider 下。

## 5. 边界、安全与待完善项

- 永久不支持 LCP/DRM，不接受密码、不接授权/解密服务。仅 EPUB/PDF，不支持其他格式、Web 或桌面。
- 当前导入限额：单文件 80 MB、展开 128 MB、单条目 32 MB、最多 5000 条目、文本资源 8 MB；拒绝 ZIP64/分卷、越界/重复资源、异常压缩比、校验失败与不支持的加密。
- EPUB 当前采用保守的自包含内容策略：拒绝检测到的书内脚本、嵌入程序、外部资源/协议链接（包括一些正常书籍的网页链接）和实体定义。字体的标准 IDPF/Adobe 混淆不当作 DRM。
- PDF 只作文件头与常见 `/Encrypt`、主动动作/外链标记预检，**不是完整 PDF 安全解析器**。文本/正则检查也不是经过审计的浏览器沙箱，不能保证发现所有编码、压缩对象或恶意内容。正式开放任意不可信文件前，必须补充原生资源/外链策略审计、模糊测试与样书回归。不要把“未发起业务网络请求”理解为已证明底层引擎绝不联网。
- 导入目前会读取整本受限大小的书籍并同步校验/解压，低端设备大书可能产生延迟和内存压力；取消在阶段之间生效，不会中断已在运行的同步解压。后续需要流式/原生后台导入及量化性能门槛。
- 搜索、PDF 选字/批注/目录等以 `onPublicationReady` / `onPreferencesChanged` 返回的 capabilities 为准；不支持时明确提示/禁用，而不是做无效按钮。没有对扫描 PDF 承诺 OCR。
- 双页/竖排/固定版式、选区重排定位、VoiceOver/TalkBack、长列表性能必须真机验证。当前没有“完美阅读器”或所有出版物完全兼容的保证。
- NativeWind 使用 RC，已固定 `lightningcss 1.30.1` 与 Expo 57 Metro 版本：1.30.2 被该 RC 明确禁止，较新的 CSS 编译依赖组合曾出现反序列化错误。不要无回归升级这些依赖。

## 常见问题

**`Nitro` / `Readium` 原生模块找不到？** 不要用 Expo Go。原生依赖变更后重新运行 `npm run android` / `npm run ios`，仅重启 Metro 不会安装原生模块。

**主题类名不生效？** 检查 `postcss.config.js`（不是 `.cjs`，当前 Expo 的 PostCSS 探测只覆盖 `.js/.mjs/.json`），以及 `metro.config.cjs` 的 NativeWind v5 包装；尝试 `npm start -- --clear`。

**Android Kotlin 编译不兼容？** 检查生成的 `android/gradle.properties` 中 `android.kotlinVersion=2.3.20`。修改原生设置后重新 prebuild；检查本机 JDK/Gradle/SDK 错误，不要绕过 peer 冲突强行安装。

**iOS 找不到 Readium Pod 或 Minizip 编译失败？** 检查插件生成的 Readium spec source、`readium_pods`、`readium_post_install`，使用当前锁定版本重新安装 pods；不要通过忽略报错声称构建成功。

**依赖明明装过但 `npm ci` 报 React peer 冲突？** 必须使用本工程更新后的锁文件，React/React DOM 已对齐到 19.2.3；不需要 `--force` 或 `--legacy-peer-deps`。
