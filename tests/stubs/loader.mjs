/**
 * loader.mjs — Node 模块解析钩子
 *
 * 让 Vite 风格的 `@/` 别名在 node:test 下可用，并把两个无法在 Node 环境运行的
 * 模块换成测试替身：
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
 * 裸相对路径补扩展名。
 * 某些 npm 包（如 @material/material-color-utilities）的 ESM 产物里写的是
 * `import './dynamic_scheme'` 这类无扩展名相对路径 —— Vite 能解析，Node 不能。
 */
function resolveExtensionless(specifier, context) {
  if (!specifier.startsWith('.') || path.extname(specifier)) return null;
  const parent = context?.parentURL;
  if (!parent || !parent.startsWith('file:')) return null;
  const base = path.resolve(path.dirname(fileURLToPath(parent)), specifier);
  return firstExisting([
    `${base}.js`,
    `${base}.mjs`,
    `${base}.ts`,
    path.join(base, 'index.js'),
    path.join(base, 'index.ts'),
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
      const extensionless = resolveExtensionless(specifier, context);
      if (extensionless) {
        return { url: pathToFileURL(extensionless).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  };
}
