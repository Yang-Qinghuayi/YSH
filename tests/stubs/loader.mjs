/**
 * loader.mjs — Node 模块解析钩子
 *
 * 让 Vite 风格的 `@/` 别名与源码中的扩展名省略导入在 node:test 下可用，
 * 并把三个无法在 Node 环境运行的模块换成测试替身：
 *   - `openai`                   → 假 client（唯一的网络边界）
 *   - `@/hooks/useEnv`           → import.meta.env / Pinia 依赖，替换为内存 fs
 *   - `@/services/workspaceService` → setting store 依赖，替换为固定路径
 *
 * 其余模块全部加载真实源码。
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

export function createHooks({ root, stubsDir }) {
  const stubs = {
    openai: path.join(stubsDir, 'openai.mjs'),
    '@/hooks/useEnv': path.join(stubsDir, 'useEnv.ts'),
    '@/services/workspaceService': path.join(stubsDir, 'workspaceService.ts'),
  };

  function resolveAlias(specifier) {
    if (!specifier.startsWith('@/')) return null;
    const base = path.join(root, 'src', specifier.slice(2));
    return firstExisting([base, `${base}.ts`, path.join(base, 'index.ts')]);
  }

  function resolveRelative(specifier, context) {
    if (!specifier.startsWith('.') || !context.parentURL) return null;
    const parent = fileURLToPath(context.parentURL);
    const base = path.resolve(path.dirname(parent), specifier);
    return firstExisting([
      base,
      `${base}.ts`,
      `${base}.mjs`,
      `${base}.js`,
      path.join(base, 'index.ts'),
    ]);
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
