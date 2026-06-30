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

          <!-- 静态档案 -->
          <div class="text-subtitle-2">静态档案（不变的"是谁"）</div>

          <v-textarea
            v-model="editingCharacter.personality"
            label="性格"
            placeholder="如：坚毅、重情、寡言..."
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details
          />

          <v-textarea
            v-model="editingCharacter.background"
            label="出身背景"
            placeholder="如：寒门出身，师从青城派..."
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details
          />

          <v-textarea
            v-model="editingCharacter.appearance"
            label="外貌"
            placeholder="如：清瘦、剑眉、常着青衫..."
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details
          />

          <v-textarea
            v-model="editingCharacter.hobbies"
            label="爱好"
            placeholder="如：嗜酒、好弈..."
            variant="outlined"
            density="compact"
            rows="1"
            auto-grow
            hide-details
          />

          <v-combobox
            v-model="editingCharacter.aliases"
            label="别名/触发词"
            placeholder="如：小川、林少侠（回车添加）"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
            hide-details
          />

          <!-- 文风 voice -->
          <div class="text-subtitle-2 mt-2">文风（出场时怎么写）</div>
          <v-text-field
            v-model="voiceDescription"
            label="触发说明（供 Agent 按需激活）"
            placeholder="如：用于李明战斗场面"
            variant="outlined"
            density="compact"
            hide-details
          />
          <v-textarea
            v-model="voicePrompt"
            label="文风指导（AI 写作指导）"
            placeholder="如：剑法描写凌厉、短句、动词密集..."
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details
          />

          <v-text-field
            v-model="editingCharacter.description"
            label="角色整体触发说明（供 Agent 按需激活）"
            placeholder="如：主角，多用其视角推进剧情"
            variant="outlined"
            density="compact"
            hide-details
          />
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

// voice 字段的双向代理（voice 可能为 undefined）
const voicePrompt = computed({
  get: () => editingCharacter.value?.voice?.prompt ?? '',
  set: (v: string) => {
    if (!editingCharacter.value) return
    editingCharacter.value.voice = {
      ...(editingCharacter.value.voice ?? {}),
      prompt: v,
    }
  },
})
const voiceDescription = computed({
  get: () => editingCharacter.value?.voice?.description ?? '',
  set: (v: string) => {
    if (!editingCharacter.value) return
    editingCharacter.value.voice = {
      ...(editingCharacter.value.voice ?? {}),
      description: v,
    }
  },
})

function characterBrief(c: Character): string {
  const parts: string[] = []
  if (c.personality) parts.push(c.personality)
  if (c.background) parts.push(c.background)
  return parts.join('；')
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
}

function saveCharacter() {
  if (!editingCharacter.value) return
  const char = editingCharacter.value
  if (!char.name.trim()) return

  // 清理空 voice
  if (char.voice && !char.voice.prompt && !char.voice.description) {
    delete char.voice
  }

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
.character-item {
  background: rgb(var(--v-theme-surface-variant), 0.5);
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
