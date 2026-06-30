/**
 * workspaceService.ts
 * 工作区文件夹管理服务
 * 扁平结构：一个文件夹 = 一本小说，文件夹直接是小说根目录。
 *   - 若设置了 workspaceDir：该文件夹就是当前小说的根，使用绝对路径
 *   - 若未设置：回退到 AppData（Web 兜底）
 */

import type { BaseDir } from '@/types/system'
import { useSettingStore } from '@/store/setting'
import { useAppService } from '@/hooks/useEnv'
import { open } from '@tauri-apps/plugin-dialog'
import { join, basename } from '@tauri-apps/api/path'

/**
 * 获取当前数据目录配置
 * 返回 base（Tauri BaseDir 类型）和 pathPrefix（路径前缀）
 *
 * workspaceDir 的语义：
 *   null         → 从未选择（显示 WorkspaceInit 向导）
 *   ''（空字符串）→ 用户选择了「使用默认 AppData」（Web 兜底）
 *   '/path/...'  → 用户选择的小说文件夹（绝对路径，扁平结构根）
 *
 * 使用方：
 *   const { base, pathPrefix } = getDataBase()
 *   await fs.readFile(pathPrefix + 'novel.json', base, 'text')
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

/** Windows 保留文件夹名 */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/**
 * 把小说标题规范化为合法的文件夹名（跨平台）。
 * 替换非法字符 / \ : * ? " < > | 为下划线，去掉首尾空格与点，
 * 处理 Windows 保留名，空结果兜底。
 */
export function sanitizeDirName(title: string): string {
  let name = title
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
  if (RESERVED_NAMES.test(name)) name = `${name}_`
  if (name.length > 80) name = name.slice(0, 80).trim()
  return name || '未命名小说'
}

/** 跨平台拼接路径 */
export async function joinPath(parent: string, name: string): Promise<string> {
  return join(parent, name)
}

/** 取路径最后一段（文件夹名） */
export async function getDirName(path: string): Promise<string> {
  return basename(path)
}

/**
 * 在 parentDir 下以小说标题创建小说文件夹，处理同名冲突，并设为当前工作区。
 * 返回新文件夹的绝对路径。
 */
export async function createNovelFolder(parentDir: string, title: string): Promise<string> {
  const appService = await useAppService()
  // target 是绝对路径，固定用 'None' 让 fs 当绝对路径处理
  const base: BaseDir = 'None'

  const slug = sanitizeDirName(title)
  let target = await joinPath(parentDir, slug)
  // 同名冲突：追加 -2、-3…
  let suffix = 2
  while (await appService.fs.exists(target, base).catch(() => false)) {
    target = await joinPath(parentDir, `${slug}-${suffix}`)
    suffix++
  }

  await appService.fs.createDir(target, base, false)
  setWorkspaceDir(target)
  return target
}

