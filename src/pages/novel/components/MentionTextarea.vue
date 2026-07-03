<template>
  <div class="mention-textarea">
    <v-textarea
      ref="textareaRef"
      :model-value="modelValue"
      v-bind="$attrs"
      @update:model-value="onInput"
      @keydown="onKeydown"
      @click="syncMentionState"
      @blur="onBlur"
    />
    <div
      v-if="menuOpen && filtered.length"
      class="mention-menu lg-card"
      role="listbox"
    >
      <button
        v-for="(char, i) in filtered"
        :key="char.id"
        type="button"
        class="mention-item"
        :class="{ 'mention-item--active': i === activeIndex }"
        role="option"
        @mousedown.prevent="selectCharacter(char)"
      >
        <span class="mention-name">@{{ char.name }}</span>
        <span v-if="char.profile" class="mention-detail">{{ char.profile }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Character } from '@/types/novel'
import type { VTextarea } from 'vuetify/components'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  characters: Character[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<VTextarea | null>(null)
const menuOpen = ref(false)
const activeIndex = ref(0)
const mentionFrom = ref(0)
const mentionQuery = ref('')

const filtered = computed(() => {
  const q = mentionQuery.value.toLowerCase()
  if (!q) return props.characters
  return props.characters.filter((c) => c.name.toLowerCase().includes(q))
})

function getTextareaEl(): HTMLTextAreaElement | null {
  const comp = textareaRef.value
  if (!comp) return null
  return comp.$el?.querySelector('textarea') ?? null
}

/** 检测光标前是否有未完成的 @提及 */
function detectMention(text: string, cursor: number) {
  const before = text.slice(0, cursor)
  const match = before.match(/@([一-龥\w]*)$/)
  if (!match) return null
  return { from: cursor - match[0].length, query: match[1] }
}

function syncMentionState() {
  const el = getTextareaEl()
  if (!el) {
    menuOpen.value = false
    return
  }
  const hit = detectMention(el.value, el.selectionStart)
  if (!hit || !props.characters.length) {
    menuOpen.value = false
    return
  }
  mentionFrom.value = hit.from
  mentionQuery.value = hit.query
  activeIndex.value = 0
  menuOpen.value = true
}

function onInput(value: string) {
  emit('update:modelValue', value)
  nextTick(syncMentionState)
}

function selectCharacter(char: Character) {
  const el = getTextareaEl()
  if (!el) return
  const cursor = el.selectionStart
  const before = props.modelValue.slice(0, mentionFrom.value)
  const after = props.modelValue.slice(cursor)
  const inserted = `@${char.name}`
  const next = before + inserted + after
  emit('update:modelValue', next)
  menuOpen.value = false
  nextTick(() => {
    const ta = getTextareaEl()
    if (!ta) return
    const pos = mentionFrom.value + inserted.length
    ta.focus()
    ta.setSelectionRange(pos, pos)
  })
}

function onKeydown(e: KeyboardEvent) {
  if (!menuOpen.value || !filtered.value.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % filtered.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    selectCharacter(filtered.value[activeIndex.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    menuOpen.value = false
  }
}

function onBlur() {
  setTimeout(() => {
    menuOpen.value = false
  }, 120)
}
</script>

<style scoped>
.mention-textarea {
  position: relative;
  flex: 1;
  min-width: 0;
}

.mention-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mention-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-sans);
  transition: background 0.15s;
}

.mention-item:hover,
.mention-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
}

.mention-name {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.mention-detail {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
