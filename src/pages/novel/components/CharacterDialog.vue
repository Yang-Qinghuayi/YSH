<template>
  <v-dialog v-model="isOpen" max-width="640" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center gap-2 pt-4">
        <v-icon :icon="mdiAccountEdit" />
        角色管理
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- 角色列表 -->
        <div v-if="!editingCharacter" class="d-flex flex-column gap-3">
          <div
            v-for="character in characters"
            :key="character.id"
            class="character-item pa-3 rounded-lg"
          >
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="font-weight-medium">{{ character.name }}</div>
                <div class="text-caption text-medium-emphasis mt-1">
                  {{ character.profile || '暂无描述' }}
                </div>
                <div class="d-flex flex-wrap gap-1 mt-2">
                  <v-chip
                    v-for="skill in character.skills"
                    :key="skill.id"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ skill.name }}
                  </v-chip>
                </div>
              </div>
              <div class="d-flex gap-1">
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
            @click="startCreate"
          >
            新增角色
          </v-btn>
        </div>

        <!-- 编辑/新增单个角色 -->
        <div v-else class="d-flex flex-column gap-4">
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-arrow-left"
            @click="cancelEdit"
          >
            返回
          </v-btn>

          <v-text-field
            v-model="editingCharacter.name"
            label="角色名（用于 @提及）"
            placeholder="如：李明"
            variant="outlined"
            density="compact"
          />

          <v-textarea
            v-model="editingCharacter.profile"
            label="角色简介"
            placeholder="角色的基本背景、性格、外貌等，作为 AI 写作时的参考..."
            variant="outlined"
            rows="3"
            auto-grow
          />

          <!-- 技能列表 -->
          <div>
            <div class="text-subtitle-2 mb-2">角色技能</div>
            <div class="d-flex flex-column gap-3">
              <div
                v-for="(skill, index) in editingCharacter.skills"
                :key="skill.id"
                class="skill-item pa-3 rounded-lg"
              >
                <div class="d-flex align-center gap-2 mb-2">
                  <v-text-field
                    v-model="skill.name"
                    label="技能名"
                    placeholder="如：剑法"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-1"
                  />
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    color="error"
                    @click="removeSkill(index)"
                  >
                    <v-icon :icon="mdiDelete" size="18" />
                  </v-btn>
                </div>
                <v-textarea
                  v-model="skill.prompt"
                  label="技能描述（AI 写作指导）"
                  placeholder="描述使用该技能时的写作风格，如：剑法描写要简洁有力，多用动词，短句为主..."
                  variant="outlined"
                  density="compact"
                  rows="2"
                  auto-grow
                  hide-details
                />
              </div>

              <v-btn
                variant="outlined"
                size="small"
                prepend-icon="mdi-plus"
                @click="addSkill"
              >
                添加技能
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <template v-if="editingCharacter">
          <v-btn @click="cancelEdit">取消</v-btn>
          <v-btn color="primary" variant="tonal" :disabled="!editingCharacter.name.trim()" @click="saveCharacter">
            保存
          </v-btn>
        </template>
        <template v-else>
          <v-btn @click="isOpen = false">关闭</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiAccountEdit, mdiPencil, mdiDelete } from '@mdi/js'
import type { Character, CharacterSkill } from '@/types/novel'

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
    profile: '',
    skills: [],
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

function addSkill() {
  if (!editingCharacter.value) return
  const skill: CharacterSkill = {
    id: `skill-${Date.now()}`,
    name: '',
    prompt: '',
  }
  editingCharacter.value.skills.push(skill)
}

function removeSkill(index: number) {
  editingCharacter.value?.skills.splice(index, 1)
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
.character-item,
.skill-item {
  background: rgb(var(--v-theme-surface-variant), 0.5);
}
</style>
