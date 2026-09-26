/**
 * useApiKey.ts
 * DeepSeek API Key 的存取策略。
 *
 * 背景：此前 Key 与整个 setting store 一起明文存进 localStorage，且无法选择
 * 「不记住」。现在拆成两处：
 *   - 记住（默认）：localStorage 'deepseek.apiKey'
 *   - 不记住：sessionStorage 'deepseek.apiKey.session'，关掉标签页即失效
 * 并自动迁移旧 setting 里的 deepseekApiKey 字段。
 *
 * 注意：本地优先应用没有服务端代理，Key 只能存在客户端；Web 部署形态下请使用
 * 受限/限额的 Key。（桌面端可接受）
 */

import { useLocalStorage, useSessionStorage } from '@vueuse/core'
import { useSettingStore } from '@/store/setting'

const LOCAL_KEY = 'deepseek.apiKey'
const SESSION_KEY = 'deepseek.apiKey.session'
const LEGACY_SETTING_KEY = 'setting'

/** 持久化存储的 Key */
const rememberedKey = useLocalStorage(LOCAL_KEY, '')
/** 仅本次会话有效的 Key */
const sessionKey = useSessionStorage(SESSION_KEY, '')

/**
 * 一次性迁移：把旧的 setting.deepseekApiKey 搬到新的存储位置，
 * 并从 setting 里删除该字段。幂等。
 */
function migrateLegacyApiKey(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(LEGACY_SETTING_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return
    if (!('deepseekApiKey' in parsed)) return

    const legacy = parsed['deepseekApiKey']
    if (typeof legacy === 'string' && legacy.trim() && !rememberedKey.value) {
      rememberedKey.value = legacy
    }
    delete parsed['deepseekApiKey']
    localStorage.setItem(LEGACY_SETTING_KEY, JSON.stringify(parsed))
  } catch {
    // 迁移失败不影响使用（用户重新填写即可）
  }
}

migrateLegacyApiKey()

export function useApiKey() {
  const settingStore = useSettingStore()

  /** 是否「记住」（持久化到 localStorage）；关闭后只在本次会话有效 */
  const remember = computed<boolean>({
    get: () => settingStore.rememberApiKey,
    set: (v) => {
      // 切换时把已有 Key 迁移到目标存储，避免用户重填
      if (v) {
        if (sessionKey.value && !rememberedKey.value) rememberedKey.value = sessionKey.value
      } else if (rememberedKey.value) {
        sessionKey.value = rememberedKey.value
        rememberedKey.value = ''
      }
      settingStore.rememberApiKey = v
    },
  })

  const apiKey = computed<string>({
    get: () => (remember.value ? rememberedKey.value || sessionKey.value : sessionKey.value),
    set: (v) => {
      if (remember.value) rememberedKey.value = v
      else sessionKey.value = v
    },
  })

  /** 清除两处存储的 Key */
  function clear(): void {
    rememberedKey.value = ''
    sessionKey.value = ''
  }

  return { apiKey, remember, clear, hasKey: computed(() => !!apiKey.value) }
}
