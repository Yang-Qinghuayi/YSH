<template>
  <v-dialog v-model="isOpen" max-width="640" scrollable>
    <v-card rounded="xl" class="lg-dialog">
      <v-card-title class="d-flex align-center gap-3 pt-5 px-5">
        <span class="title-badge">
          <v-icon :icon="mdiAccountEdit" size="18" />
        </span>
        <span class="text-h6">角色管理</span>
      </v-card-title>

      <v-card-text class="pa-5">
        <!-- 角色列表 -->
        <div v-if="!editingCharacter" class="d-flex flex-column gap-3">
          <div
            v-for="character in characters"
            :key="character.id"
            class="character-item lg-card--inset pa-3"
          >
            <div class="d-flex align-center justify-space-between">
              <div class="flex-1 mr-2">
                <div class="font-weight-medium">{{ character.name }}</div>
                <div class="text-caption text-medium-emphasis mt-1 line-clamp-2">
                  {{ characterBrief(character) || '暂无档案' }}
                </div>
                <div v-if="character.aliases?.length" class="d-flex flex-wrap gap-1 mt-2">
                  <v-chip
                    v-for="alias in character.aliases"
                    :key="alias"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ alias }}
                  </v-chip>
                </div>
              </div>
              <div class="d-flex gap-1 flex-shrink-0">
                <v-btn icon size="small" variant="text" @click="startEdit(character)">
                  <v-icon :icon="mdiPencil" size="18" />
                </v-btn>
                <v-btn icon size="small" variant="text" color="error" @click="confirmDelete(character.id)">
                  <v-icon :icon="mdiDelete" size="18" />
                </v-btn>
              </div>
            </div>
          </div>

          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            rounded="pill"
            @click="startCreate"
          >
            新增角色
          </v-btn>
        </div>

        <!-- 编辑/新增单个角色 -->
        <div v-else class="d-flex flex-column gap-4">
          <label class="native-label">
            <span class="native-label-text">角色名（用于 @提及）</span>
            <input
              v-model="editingCharacter.name"
              type="text"
              class="native-input"
              placeholder="如：李明"
            />
          </label>

          <label class="native-label">
            <span class="native-label-text">角色描述</span>
            <textarea
              v-model="editingCharacter.profile"
              class="native-input native-textarea"
              placeholder="用自然语言描述角色。例如：寒门出身，师从青城派，性格坚毅重情却寡言。清瘦剑眉，常着青衫，嗜酒好弈..."
              rows="6"
            ></textarea>
          </label>

          <!-- 别名标签输入 -->
          <label class="native-label">
            <span class="native-label-text">别名/触发词</span>
            <div class="native-tags-wrapper" @click="focusAliasInput">
              <span v-for="(alias, i) in editingCharacter.aliases" :key="i" class="native-tag">
                {{ alias }}
                <button type="button" class="native-tag-remove" @click.stop="removeAlias(i)">&times;</button>
              </span>
              <input
                ref="aliasInputRef"
                v-model="aliasInput"
                type="text"
                class="native-tags-input"
                placeholder="输入后按回车添加"
                @keydown.enter.prevent="addAlias"
                @keydown.backspace="removeLastAlias"
              />
            </div>
          </label>

          <label class="native-label">
            <span class="native-label-text">文学形象参考</span>
            <textarea
              v-model="editingCharacter.literaryReference"
              class="native-input native-textarea"
              placeholder="请填写该角色参考的著名文学/影视形象（例如：杨过、李寻欢）。大模型将自动映射这些经典形象的气质、风骨与行为模式。"
              rows="3"
            ></textarea>
          </label>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <template v-if="editingCharacter">
          <v-btn variant="text" rounded="pill" @click="cancelEdit">取消</v-btn>
          <v-btn color="primary" variant="tonal" rounded="pill" :disabled="!editingCharacter.name.trim()" @click="saveCharacter">
            保存
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" rounded="pill" @click="isOpen = false">关闭</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiAccountEdit, mdiPencil, mdiDelete } from '@mdi/js'
import type { Character } from '@/types/novel'

const props = defineProps<{
  modelValue: boolean
  characters: Character[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:characters': [characters: Character[]]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const editingCharacter = ref<Character | null>(null)
const isCreating = ref(false)

// 别名标签输入
const aliasInput = ref('')
const aliasInputRef = ref<HTMLInputElement | null>(null)

function focusAliasInput() {
  aliasInputRef.value?.focus()
}

function addAlias() {
  const val = aliasInput.value.trim()
  if (!val || !editingCharacter.value) return
  if (!editingCharacter.value.aliases) {
    editingCharacter.value.aliases = []
  }
  if (!editingCharacter.value.aliases.includes(val)) {
    editingCharacter.value.aliases.push(val)
  }
  aliasInput.value = ''
}

function removeAlias(index: number) {
  if (!editingCharacter.value?.aliases) return
  editingCharacter.value.aliases.splice(index, 1)
}

function removeLastAlias(e: KeyboardEvent) {
  if (aliasInput.value === '' && editingCharacter.value?.aliases?.length) {
    editingCharacter.value.aliases.pop()
    e.preventDefault()
  }
}

function characterBrief(c: Character): string {
  return c.profile || ''
}

function startCreate() {
  isCreating.value = true
  editingCharacter.value = {
    id: `char-${Date.now()}`,
    name: '',
  }
}

function startEdit(character: Character) {
  isCreating.value = false
  editingCharacter.value = JSON.parse(JSON.stringify(character)) as Character
}

function cancelEdit() {
  editingCharacter.value = null
  isCreating.value = false
  aliasInput.value = ''
}

function saveCharacter() {
  if (!editingCharacter.value) return
  const char = editingCharacter.value
  if (!char.name.trim()) return

  const updated = [...props.characters]
  if (isCreating.value) {
    updated.push(char)
  } else {
    const index = updated.findIndex((c) => c.id === char.id)
    if (index !== -1) updated[index] = char
  }

  emit('update:characters', updated)
  cancelEdit()
}

function confirmDelete(characterId: string) {
  const updated = props.characters.filter((c) => c.id !== characterId)
  emit('update:characters', updated)
}
</script>

<style scoped>
.lg-dialog {
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
}
.title-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
.character-item {
  padding: 12px;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ===== 原生输入框 ===== */
.native-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.native-label-text {
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  padding-left: 4px;
}
.native-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: none;
  border-radius: 14px;
  outline: none;
  transition: box-shadow 0.2s;
}
.native-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.4);
}
.native-input:focus {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.45);
}
.native-textarea {
  resize: vertical;
  min-height: 80px;
}

/* ===== 原生标签输入 ===== */
.native-tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  min-height: 42px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: none;
  border-radius: 14px;
  cursor: text;
  transition: box-shadow 0.2s;
}
.native-tags-wrapper:focus-within {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.45);
}
.native-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
  border-radius: 10px;
  white-space: nowrap;
}
.native-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.native-tag-remove:hover {
  opacity: 1;
  background: rgba(var(--v-theme-primary), 0.2);
}
.native-tags-input {
  flex: 1;
  min-width: 120px;
  padding: 2px 4px;
  font-size: 14px;
  font-family: inherit;
  color: rgb(var(--v-theme-on-surface));
  background: transparent;
  border: none;
  outline: none;
}
.native-tags-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.4);
}
</style>
