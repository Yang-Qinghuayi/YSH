/**
 * workspaceService.ts
 * 工作区文件夹管理服务
 * 支持用户自选文件夹作为数据目录（类 Obsidian 体验）
 *   - 若设置了 workspaceDir：数据存在用户选择的文件夹下，使用绝对路径
 *   - 若未设置：回退到 AppData（保持原有行为）
 */

import type { BaseDir } from '@/types/system'
import { useSettingStore } from '@/store/setting'
import { open } from '@tauri-apps/plugin-dialog'

/**
 * 获取当前数据目录配置
 * 返回 base（Tauri BaseDir 类型）和 pathPrefix（路径前缀）
 *
 * workspaceDir 的语义：
 *   null         → 从未选择（显示 WorkspaceInit 向导）
 *   ''（空字符串）→ 用户选择了「使用默认 AppData」
 *   '/path/...'  → 用户选择的自定义文件夹
 *
 * 使用方：
 *   const { base, pathPrefix } = getDataBase()
 *   await fs.readFile(pathPrefix + 'novels/xyz/novel.json', base, 'text')
 */
export function getDataBase(): { base: BaseDir; pathPrefix: string } {
  const setting = useSettingStore()
  // 有具体路径时使用工作区
  if (setting.workspaceDir) {
    return { base: 'None', pathPrefix: setting.workspaceDir + '/' }
  }
  // null 或空字符串都使用 AppData
  return { base: 'Data', pathPrefix: '' }
}

/** 是否已完成工作区初始化（null = 从未选择过） */
export function isWorkspaceInitialized(): boolean {
  return useSettingStore().workspaceDir !== null
}

/**
 * 打开系统文件夹选择对话框
 * 返回用户选择的文件夹绝对路径，取消则返回 null
 */
export async function pickWorkspaceDir(): Promise<string | null> {
  // multiple: false → 返回 string | null
  const result = await open({
    directory: true,
    multiple: false,
    title: '选择工作区文件夹',
  })
  return typeof result === 'string' ? result : null
}

/** 设置工作区文件夹路径（保存到 localStorage） */
export function setWorkspaceDir(dir: string) {
  const setting = useSettingStore()
  setting.workspaceDir = dir
}

/** 清除工作区文件夹（回退到 AppData） */
export function clearWorkspaceDir() {
  const setting = useSettingStore()
  setting.workspaceDir = null
}

/** 获取当前工作区路径（用于展示） */
export function getWorkspaceDir(): string | null {
  return useSettingStore().workspaceDir ?? null
}
