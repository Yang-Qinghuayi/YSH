<template>
  <!-- 内嵌的工作区选择界面，直接占满父容器 -->
  <div class="workspace-init d-flex align-center justify-center h-100">
    <div class="workspace-init-card">
      <!-- 图标 -->
      <div class="d-flex justify-center mb-4">
        <v-icon :icon="mdiBookshelf" size="64" color="primary" />
      </div>

      <!-- 标题 -->
      <h2 class="text-h5 font-weight-bold text-center mb-2">
        选择工作区文件夹
      </h2>
      <p class="text-body-2 text-medium-emphasis text-center mb-6">
        选择一个文件夹作为工作区，<br />
        你的小说和资料库将存储在这里
      </p>

      <!-- 主要操作 -->
      <v-btn
        color="primary"
        size="large"
        block
        :prepend-icon="mdiFolderOpenOutline"
        :loading="picking"
        @click="handlePickFolder"
      >
        打开文件夹
      </v-btn>

      <!-- 分隔线 -->
      <div class="d-flex align-center my-4 gap-2">
        <v-divider />
        <span class="text-caption text-medium-emphasis text-no-wrap">或者</span>
        <v-divider />
      </div>

      <!-- 次要操作：使用默认 AppData 位置 -->
      <v-btn
        variant="outlined"
        block
        size="small"
        @click="handleUseDefault"
      >
        使用默认存储位置
      </v-btn>
      <p class="text-caption text-medium-emphasis text-center mt-1">
        数据将存储在系统 AppData 目录
      </p>

      <!-- 已选路径预览 -->
      <v-expand-transition>
        <div v-if="selectedPath" class="mt-4">
          <v-alert
            type="success"
            variant="tonal"
            density="compact"
            :icon="mdiCheck"
          >
            <div class="text-caption font-weight-medium">已选择工作区：</div>
            <div class="text-caption text-truncate">{{ selectedPath }}</div>
          </v-alert>
          <v-btn
            color="primary"
            block
            class="mt-3"
            @click="handleConfirm"
          >
            开始使用
          </v-btn>
        </div>
      </v-expand-transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mdiBookshelf, mdiFolderOpenOutline, mdiCheck } from '@mdi/js'
import { useSettingStore } from '@/store/setting'
import { pickWorkspaceDir, setWorkspaceDir } from '@/services/workspaceService'

const settingStore = useSettingStore()

const picking = ref(false)
const selectedPath = ref<string | null>(null)

const emit = defineEmits<{
  done: []
}>()

async function handlePickFolder() {
  picking.value = true
  try {
    const dir = await pickWorkspaceDir()
    if (dir) {
      selectedPath.value = dir
    }
  } catch (e) {
    console.error('选择文件夹失败：', e)
  } finally {
    picking.value = false
  }
}

function handleConfirm() {
  if (!selectedPath.value) return
  setWorkspaceDir(selectedPath.value)
  emit('done')
}

// 使用默认 AppData 路径（空字符串 = 已初始化但用默认）
function handleUseDefault() {
  settingStore.workspaceDir = ''
  emit('done')
}
</script>

<style scoped>
.workspace-init {
  background: rgb(var(--v-theme-background));
}

.workspace-init-card {
  width: 400px;
  max-width: 90%;
  padding: 8px;
}
</style>
