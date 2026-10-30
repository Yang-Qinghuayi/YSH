/**
 * loader.mjs — Node 模块解析钩子
 *
 * 让 Vite 风格的 `@/` 别名与源码中的扩展名省略导入在 node:test 下可用，
 * 并把两个无法在 Node 环境运行的模块换成测试替身：
 *   - `@/hooks/useEnv`              → import.meta.env / Pinia 依赖，替换为内存 fs
 *   - `@/services/workspaceService` → setting store 依赖，替换为固定路径
 *
 * 网络边界（DeepSeek 的 fetch/SSE）由 `stubs/fetch.mjs` 替换，见各 e2e 测试。
 * 其余 `@/` 模块全部加载真实源码。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function firstExisting(candidates) {
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/**
 * 相对路径补扩展名。
 * 两类场景都要覆盖：
 * 1. 项目源码：`./session`、`./chat` 这类省略扩展名的导入（Vite 能解析，Node 不能）
 * 2. 依赖产物：某些 npm 包（如 @material/material-color-utilities）的 ESM 产物里
 *    写的是 `import './dynamic_scheme'`，同样需要补 `.js`
 */
function resolveRelative(specifier, context) {
  if (!specifier.startsWith('.') || !context?.parentURL) return null;
  const parent = context.parentURL;
  if (!parent.startsWith('file:')) return null;
  const base = path.resolve(path.dirname(fileURLToPath(parent)), specifier);
  // 已带扩展名的直接用；没带的按 TS → ESM → CJS 顺序补
  if (path.extname(specifier)) return firstExisting([base]);
  return firstExisting([
    base,
    `${base}.ts`,
    `${base}.mjs`,
    `${base}.js`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ]);
}

export function createHooks({ root, stubsDir }) {
  const stubs = {
    '@/hooks/useEnv': path.join(stubsDir, 'useEnv.ts'),
    '@/services/workspaceService': path.join(stubsDir, 'workspaceService.ts'),
  };

  function resolveAlias(specifier) {
    if (!specifier.startsWith('@/')) return null;
    const base = path.join(root, 'src', specifier.slice(2));
    return firstExisting([base, `${base}.ts`, path.join(base, 'index.ts')]);
  }

  return {
    resolve(specifier, context, nextResolve) {
      if (stubs[specifier]) {
        return { url: pathToFileURL(stubs[specifier]).href, shortCircuit: true };
      }
      const aliased = resolveAlias(specifier);
      if (aliased) {
        return { url: pathToFileURL(aliased).href, shortCircuit: true };
      }
      const relative = resolveRelative(specifier, context);
      if (relative) {
        return { url: pathToFileURL(relative).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  };
}
