/**
 * fakeFs.ts — 内存文件系统
 *
 * 模拟 AppService.fs 中本仓库数据层实际用到的 5 个方法（exists/readFile/writeFile/
 * createDir/removeFile），使 storyStateService / loreService / novelService 可以
 * 在 Node 下原样运行（不 stub 它们本身，只替换最底层的存储与路径来源）。
 *
 * 键 = `${base}::${path}`，与真实调用形态 fs.exists(path, base) 保持一致。
 */

const files = new Map<string, string>()
const dirs = new Set<string>()

function key(path: string, base?: string): string {
  return `${base ?? ''}::${path}`
}

export const fakeFs = {
  async exists(path: string, base?: string): Promise<boolean> {
    return files.has(key(path, base)) || dirs.has(key(path, base))
  },
  async readFile(path: string, base?: string, _kind?: string): Promise<string> {
    const k = key(path, base)
    if (!files.has(k)) throw new Error(`ENOENT: ${k}`)
    return files.get(k) as string
  },
  async writeFile(path: string, base?: string, data?: unknown): Promise<void> {
    files.set(key(path, base), typeof data === 'string' ? data : String(data ?? ''))
  },
  async createDir(path: string, base?: string, _recursive?: boolean): Promise<void> {
    dirs.add(key(path, base))
  },
  async removeFile(path: string, base?: string): Promise<void> {
    files.delete(key(path, base))
  },
}

/** 测试辅助：清空全部文件与目录 */
export function resetFs(): void {
  files.clear()
  dirs.clear()
}

/** 测试辅助：写入原始文本文件 */
export function seedFile(path: string, content: string, base = 'Data'): void {
  files.set(key(path, base), content)
}

/** 测试辅助：写入 JSON 文件 */
export function seedJson(path: string, value: unknown, base = 'Data'): void {
  files.set(key(path, base), JSON.stringify(value, null, 2))
}

/** 测试辅助：读取并解析 JSON（不存在返回 null） */
export function readJson<T = unknown>(path: string, base = 'Data'): T | null {
  const raw = files.get(key(path, base))
  if (raw === undefined) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** 测试辅助：列出所有已写入的文件路径（便于断言落盘行为） */
export function listFiles(): string[] {
  return [...files.keys()].sort()
}
