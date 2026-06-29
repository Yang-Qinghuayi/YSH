import { defineStore } from 'pinia'
import type { Novel } from '@/types/novel'
import type { Lore, EntryMeta, EntryType } from '@/types/lore'

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

  // 类型筛选（'all' 表示全部）
  const filterType = ref<EntryType | 'all'>('all')

  // 按类型过滤后的条目列表（只显示 enabled，按 order 排序）
  const filteredEntries = computed(() => {
    if (!lore.value) return []
    return lore.value.entries
      .filter((e) => e.enabled)
      .filter((e) => filterType.value === 'all' || e.type === filterType.value)
      .sort((a, b) => a.order - b.order)
  })

  // 每种类型的条目数量（只统计 enabled）
  const typeCounts = computed(() => {
    if (!lore.value) return {} as Record<string, number>
    const counts: Record<string, number> = { all: 0 }
    for (const e of lore.value.entries) {
      if (!e.enabled) continue
      counts.all = (counts.all ?? 0) + 1
      counts[e.type] = (counts[e.type] ?? 0) + 1
    }
    return counts
  })

  /** 打开某部小说的资料库 */
  function openNovel(novel: Novel, loreMeta: Lore) {
    currentNovel.value = novel
    lore.value = loreMeta
    currentEntry.value = null
    currentEntryContent.value = ''
    isDirty.value = false
    filterType.value = 'all'
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
    filterType,
    filteredEntries,
    typeCounts,
    openNovel,
    openEntry,
    updateContent,
    markSaved,
    updateLore,
    updateCurrentEntryMeta,
  }
})
