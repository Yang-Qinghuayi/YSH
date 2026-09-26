/**
 * useEnv.ts（测试替身）
 *
 * 真实实现依赖 environment.ts 的 import.meta.env 与 store，无法在 Node 下加载。
 * 这里只提供数据层需要的 useAppService()，其余导出为最小兼容实现。
 */
import { fakeFs } from './fakeFs.ts'

export const useAppService = async () => ({
  fs: fakeFs,
  loadSettings: async () => ({}),
  loadLibraryBooks: async () => [],
})

export const envConfig = {} as Record<string, unknown>
export const libraryLoaded = { value: false }
export const initLibrary = async () => {}
export const initAppService = async () => {}
