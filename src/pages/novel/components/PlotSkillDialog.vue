<template>
  <v-dialog v-model="isOpen" max-width="560" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center gap-2 pt-4">
        <v-icon :icon="mdiLightningBolt" />
        剧情技能管理
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- 技能列表 -->
        <div v-if="!editingSkill" class="d-flex flex-column gap-3">
          <div
            v-for="skill in plotSkills"
            :key="skill.id"
            class="skill-item pa-3 rounded-lg"
          >
            <div class="d-flex align-center justify-space-between">
              <div class="flex-1 mr-2">
                <div class="font-weight-medium">{{ skill.name }}</div>
                <div class="text-caption text-medium-emphasis mt-1 line-clamp-2">
                  {{ skill.prompt || '暂无描述' }}
                </div>
              </div>
              <div class="d-flex gap-1 flex-shrink-0">
                <v-btn icon size="small" variant="text" @click="startEdit(skill)">
                  <v-icon :icon="mdiPencil" size="18" />
                </v-btn>
                <v-btn icon size="small" variant="text" color="error" @click="confirmDelete(skill.id)">
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
            新增剧情技能
          </v-btn>
        </div>

        <!-- 编辑单个技能 -->
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
            v-model="editingSkill.name"
            label="技能名（用于 @提及）"
            placeholder="如：矛盾激化、战斗场景、情感铺垫"
            variant="outlined"
            density="compact"
          />

          <v-textarea
            v-model="editingSkill.prompt"
            label="技能描述（AI 写作指导）"
            placeholder="描述这个剧情技能的写作风格和要素，如：矛盾激化要通过对话和行动展现双方分歧加深，节奏加快，语句短促..."
            variant="outlined"
            rows="5"
            auto-grow
          />
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <template v-if="editingSkill">
          <v-btn @click="cancelEdit">取消</v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :disabled="!editingSkill.name.trim()"
            @click="saveSkill"
          >
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
import { mdiLightningBolt, mdiPencil, mdiDelete } from '@mdi/js'
import type { PlotSkill } from '@/types/novel'

const props = defineProps<{
  modelValue: boolean
  plotSkills: PlotSkill[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:plotSkills': [skills: PlotSkill[]]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const editingSkill = ref<PlotSkill | null>(null)
const isCreating = ref(false)

function startCreate() {
  isCreating.value = true
  editingSkill.value = {
    id: `plot-${Date.now()}`,
    name: '',
    prompt: '',
  }
}

function startEdit(skill: PlotSkill) {
  isCreating.value = false
  editingSkill.value = { ...skill }
}

function cancelEdit() {
  editingSkill.value = null
  isCreating.value = false
}

function saveSkill() {
  if (!editingSkill.value?.name.trim()) return

  const updated = [...props.plotSkills]
  if (isCreating.value) {
    updated.push(editingSkill.value)
  } else {
    const index = updated.findIndex((s) => s.id === editingSkill.value!.id)
    if (index !== -1) updated[index] = editingSkill.value
  }

  emit('update:plotSkills', updated)
  cancelEdit()
}

function confirmDelete(skillId: string) {
  const updated = props.plotSkills.filter((s) => s.id !== skillId)
  emit('update:plotSkills', updated)
}
</script>

<style scoped>
.skill-item {
  background: rgb(var(--v-theme-surface-variant), 0.5);
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
