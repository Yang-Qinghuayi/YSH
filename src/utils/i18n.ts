/**
 * 轻量 i18n 替代方案，无需 vue-i18n 依赖
 * 支持嵌套 key（如 "common.cancel"）和插值（{0} 或 {name}）
 */
import { computed } from 'vue'
import en from '../locale/en.json'
import zhCN from '../locale/zh-CN.json'

const messages: Record<string, Record<string, unknown>> = { en, zhCN }

/** 从嵌套对象中按点分隔的 key 取值 */
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

/** 替换插值，支持 {0} 数字索引和 {name} 命名插值 */
function interpolate(str: string, options: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    return key in options ? String(options[key]) : `{${key}}`
  })
}

/** 获取当前语言（避免循环依赖，直接读 localStorage） */
function getCurrentLocale(): string {
  try {
    // 与 setting store 保持一致的存储格式
    const raw = localStorage.getItem('setting')
    if (raw) {
      const s = JSON.parse(raw)
      return s?.locale ?? 'zhCN'
    }
  } catch {}
  return 'zhCN'
}

/**
 * 翻译函数
 * @param key  点分隔的翻译 key，如 "common.cancel"
 * @param options  插值参数，如 { 0: 100 } 或 { name: 'foo' }
 */
export function t(key: string, options: Record<string, string | number> = {}): string {
  const locale = getCurrentLocale()
  const dict = messages[locale] ?? messages['zhCN']
  const raw = getNestedValue(dict as Record<string, unknown>, key)
  if (raw == null) {
    // fallback 到英文
    const fallback = getNestedValue(messages['en'] as Record<string, unknown>, key)
    if (fallback == null) return key
    return Object.keys(options).length ? interpolate(fallback, options) : fallback
  }
  return Object.keys(options).length ? interpolate(raw, options) : raw
}

/**
 * 兼容 vue-i18n 的 useI18n hook，用于 <script setup> 中
 */
export function useI18n(_opts?: { useScope?: string }) {
  const translate = (key: string, options?: Record<string, string | number> | number[]) => {
    // 支持数组形式的插值（vue-i18n 支持 t('key', [val1, val2])）
    if (Array.isArray(options)) {
      const obj: Record<string, string | number> = {}
      options.forEach((v, i) => { obj[i] = v })
      return t(key, obj)
    }
    return t(key, options ?? {})
  }

  const locale = computed(() => getCurrentLocale())

  return { t: translate, locale }
}

export type TranslationFunc = typeof t
