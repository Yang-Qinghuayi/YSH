# 部署到 Vercel（Web 版）

本项目是 **Vue 3 + Vite 8 + Tauri 2** 的混合工程：`pnpm build`（= `vite build --mode web`）产出的 `dist/` 就是可以部署到 Vercel 的纯静态站点；`src-tauri/` 里的 Rust 代码只在桌面端打包时使用，Vercel 不会也不需要编译它。

## 已经配置好的内容

| 文件 | 作用 |
| --- | --- |
| `vercel.json` | 指定框架为 Vite、构建命令 `pnpm run build`、产物目录 `dist`、Node 22、SPA 回退与缓存头 |
| `.vercelignore` | 部署时不上传 `src-tauri/`、`tests/`、`docs/` 等与 Web 构建无关的文件 |
| `.env.web` | 构建时注入 `VITE_APP_PLATFORM=web`，`src/services/environment.ts` 据此走 `WebAppService`（IndexedDB 存书），不会去调 Tauri API |

`vercel.json` 的关键字段：

```jsonc
{
  "framework": "vite",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm run build",   // 必须走 --mode web，否则 VITE_APP_PLATFORM 为空
  "outputDirectory": "dist",
  "env": {
    "NODE_VERSION": "22.x",           // Vite 8 要求 Node ^20.19 || >=22.12
    "HUSKY": "0",                     // 云端构建跳过 husky install
    "VITE_APP_PLATFORM": "web"        // 双保险：即使 buildCommand 被改也不会误判平台
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

> 路由目前用的是 `createWebHashHistory()`（`src/router/index.ts`），URL 形如 `/#/library`，本身不依赖服务端回退；上面的 `rewrites` 是给以后换成 `createWebHistory()` 留的保险，对现有 hash 路由无副作用（Vercel 先匹配真实文件，再套用 rewrite）。

## 方式一：Git 集成（推荐，push 即自动部署）

1. 把分支推到 GitHub（本仓库已在 GitHub：`Yang-Qinghuayi/YSH`）。
2. 打开 <https://vercel.com/new>，用 GitHub 账号登录 → **Import** 这个仓库。
3. Framework Preset 会自动识别为 **Vite**；`vercel.json` 已经把 Install / Build / Output 都写死了，不用在面板里再改。
4. **Root Directory 留空（即仓库根目录）**，不要填 `src`。
5. Node.js Version 选 **22.x**（`vercel.json` 里也设了 `NODE_VERSION`）。
6. Environment Variables **不需要**填任何值：`VITE_APP_PLATFORM` 已由 `.env.web` / `vercel.json` 提供；DeepSeek API Key 是使用者在设置页自己填、存在浏览器 localStorage 的（`src/hooks/useApiKey.ts`）。
   > 注意：README 里提到的 `.env.local` 中的 `VITE_DEEPSEEK_API_KEY` 目前在代码里**没有任何地方读取**（`src` 里唯一的 `import.meta.env` 读取只有 `src/services/environment.ts` 的 `VITE_APP_PLATFORM`），所以在 Vercel 面板里填它不会生效。
7. 点 **Deploy**。之后 `ysh` 分支 push 会部署到生产域名，其它分支/PR 会生成 Preview 域名。

## 方式二：Vercel CLI（本地一键上传）

```bash
npx vercel login          # 首次需要
npx vercel link           # 关联/新建项目
npx vercel                # 部署到预览地址
npx vercel --prod         # 部署到生产域名
```

CLI 会读取同一份 `vercel.json`，行为与 Git 集成一致。

## 部署前本地验证（和 Vercel 跑的命令一致）

```bash
pnpm install --frozen-lockfile
pnpm build      # 产物在 dist/
pnpm start      # vite preview，本地打开 dist/ 里的生产构建
```

## 上线后需要注意的几件事

1. **DeepSeek API Key 会暴露给浏览器**。`src/services/deepseekService.ts` 用 `dangerouslyAllowBrowser: true` 在浏览器直连 `api.deepseek.com`。桌面端可以接受，公网部署等于把 Key 交给访问者。建议：给 Web 版单独配一个**限额/受限 Key**，或者后续加一层 Serverless Function（`/api/chat`）代理转发。
2. **中文字体来自 jsDelivr CDN**（`index.html` 里的 `lxgw-wenkai-webfont`）。国内访问 jsDelivr 可能不稳定，需要的话可以把字体文件下载到 `src/assets/` 自托管。
3. **Web 端没有真实文件系统**：书籍走 IndexedDB（`src/services/webAppService.ts`），"用其他应用打开"、CLI、deep-link 等 Tauri 能力在 Web 下会自动隐藏（`isTauriAppPlatform()` 判定）。
4. **构建产物体积**：当前 `dist/` 约 13 MB，单块 `novel` chunk ~785 KB（gzip ~248 KB），Vite 会给出 chunk 过大警告，不影响部署。
