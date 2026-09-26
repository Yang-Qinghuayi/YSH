/**
 * workspaceService.ts（测试替身）
 *
 * 真实实现依赖 setting store（Pinia + 持久化），测试中不需要。
 * getDataBase 返回 AppData 形态：pathPrefix 为空，base 为 'Data'，
 * 因此数据层写入的路径就是相对路径本身，便于断言。
 */
export function getDataBase(): { base: string; pathPrefix: string } {
  return { base: 'Data', pathPrefix: '' }
}

export function isWorkspaceInitialized(): boolean {
  return true
}
