import { defineStore } from 'pinia'
import type { Novel } from '@/types/novel'
import type { Lore, EntryMeta } from '@/types/lore'

export const useLoreStore = defineStore('lore', () => {
  // 当前绑定的小说
  const currentNovel = ref<Novel | null>(null)

  // 当前资料库元数据（含全部 EntryMeta）
  const lore = ref<Lore | null>(null)

  // 当前正在编辑的条目元数据
  const currentEntry = ref<EntryMeta | null>(null)

  // 当前条目的 Markdown 正文
  const currentEntryContent = ref('')

  // 是否有未保存的更改
  const isDirty = ref(false)

  // 条目列表（全部展示，按 order 排序；enabled 只影响 AI 上下文注入）
  const filteredEntries = computed(() => {
    if (!lore.value) return []
    return lore.value.entries.slice().sort((a, b) => a.order - b.order)
  })

  /** 打开某部小说的资料库 */
  function openNovel(novel: Novel, loreMeta: Lore) {
    currentNovel.value = novel
    lore.value = loreMeta
    currentEntry.value = null
    currentEntryContent.value = ''
    isDirty.value = false
  }

  /** 打开某条条目 */
  function openEntry(entry: EntryMeta, content: string) {
    currentEntry.value = entry
    currentEntryContent.value = content
    isDirty.value = false
  }

  /** 更新条目正文（用户编辑时调用，标记 dirty） */
  function updateContent(content: string) {
    currentEntryContent.value = content
    isDirty.value = true
  }

  /** 标记已保存 */
  function markSaved() {
    isDirty.value = false
  }

  /** 更新本地 lore 元数据（服务层保存后调用） */
  function updateLore(updated: Lore) {
    lore.value = updated
  }

  /** 更新本地当前条目元数据 */
  function updateCurrentEntryMeta(patch: Partial<EntryMeta>) {
    if (!currentEntry.value) return
    currentEntry.value = { ...currentEntry.value, ...patch }
    // 同步更新 lore entries 列表
    if (lore.value) {
      lore.value = {
        ...lore.value,
        entries: lore.value.entries.map((e) =>
          e.id === currentEntry.value!.id ? { ...e, ...patch } : e,
        ),
      }
    }
  }

  return {
    currentNovel,
    lore,
    currentEntry,
    currentEntryContent,
    isDirty,
    filteredEntries,
    openNovel,
    openEntry,
    updateContent,
    markSaved,
    updateLore,
    updateCurrentEntryMeta,
  }
})
