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
                  {{ character.skill || '暂无长期记忆' }}
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
            <span class="native-label-text">长期记忆（Skill）</span>
            <textarea
              v-model="editingCharacter.skill"
              class="native-input native-textarea"
              placeholder="用自然语言写下这个角色是谁：性格、出身、外貌、信念、说话方式、别名/称呼、可参考的文学形象……&#10;例如：寒门出身，师从青城派，性格坚毅重情却寡言。清瘦剑眉，常着青衫，嗜酒好弈。旁人唤他「青衫客」。气质可参考令狐冲。"
              rows="9"
            ></textarea>
            <span class="native-hint">
              发生重大事件后，「本章定稿」时 Agent 可能改写这里（改写记录可在「故事状态」里回滚）。角色此刻知道什么，记录在短期记忆里（角色面板查看）。
            </span>
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
  background: rgb(var(--v-theme-surface));
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
.native-hint {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.5);
  padding-left: 4px;
}

</style>
