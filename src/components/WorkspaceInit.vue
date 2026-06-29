<template>
  <div class="workspace-init">
    <div class="glass-card">

      <!-- 图标 -->
      <div class="icon-wrap">
        <v-icon :icon="mdiBookshelf" size="36" color="primary" />
      </div>

      <!-- 标题 -->
      <h2 class="card-title">选择工作区</h2>
      <p class="card-desc">
        选择一个文件夹存放你的小说和资料，<br />
        就像一个本地的创作库。
      </p>

      <!-- 主要操作 -->
      <v-btn
        color="primary"
        block
        rounded="pill"
        elevation="0"
        :prepend-icon="mdiFolderOpenOutline"
        :loading="picking"
        class="primary-btn"
        @click="handlePickFolder"
      >
        打开文件夹
      </v-btn>

      <!-- 分隔 -->
      <div class="divider-row">
        <div class="divider-line" />
        <span class="divider-text">或</span>
        <div class="divider-line" />
      </div>

      <!-- 使用默认 -->
      <button class="secondary-btn" @click="handleUseDefault">
        使用默认存储位置
      </button>
      <p class="secondary-desc">存储在系统 AppData 目录</p>

      <!-- 已选路径预览 -->
      <transition name="slide-down">
        <div v-if="selectedPath" class="selected-wrap">
          <div class="selected-path">
            <v-icon :icon="mdiCheckCircleOutline" size="16" color="success" class="mr-2 flex-shrink-0" />
            <span class="path-text">{{ selectedPath }}</span>
          </div>
          <v-btn
            color="primary"
            block
            rounded="pill"
            elevation="0"
            class="mt-3"
            @click="handleConfirm"
          >
            开始使用
          </v-btn>
        </div>
      </transition>

    </div>
  </div>
</template>

<script setup lang="ts">
import { mdiBookshelf, mdiFolderOpenOutline, mdiCheckCircleOutline } from '@mdi/js'
import { useSettingStore } from '@/store/setting'
import { pickWorkspaceDir, setWorkspaceDir } from '@/services/workspaceService'

const settingStore = useSettingStore()
const picking = ref(false)
const selectedPath = ref<string | null>(null)

const emit = defineEmits<{ done: [] }>()

async function handlePickFolder() {
  picking.value = true
  try {
    const dir = await pickWorkspaceDir()
    if (dir) selectedPath.value = dir
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

function handleUseDefault() {
  settingStore.workspaceDir = ''
  emit('done')
}
</script>

<style scoped>
/* 全屏居中容器 */
.workspace-init {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  background: rgba(var(--v-theme-background), 1);
}

/* 磨砂玻璃卡片 */
.glass-card {
  width: 360px;
  max-width: 92%;
  padding: 36px 32px 28px;
  border-radius: 20px;
  background: rgba(var(--v-theme-surface), 0.88);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow:
    0 2px 0 1px rgba(var(--v-theme-on-surface), 0.04),
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  text-align: center;
}

/* 图标 */
.icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

/* 标题 */
.card-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.88);
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.card-desc {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 0 0 24px;
  line-height: 1.6;
}

/* 主按钮 */
.primary-btn {
  font-weight: 500 !important;
}

/* 分隔线 */
.divider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: rgba(var(--v-theme-on-surface), 0.1);
}
.divider-text {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.35);
}

/* 次要按钮 */
.secondary-btn {
  width: 100%;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: transparent;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
  font-weight: 450;
}
.secondary-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}

.secondary-desc {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin: 6px 0 0;
}

/* 已选路径 */
.selected-wrap {
  margin-top: 16px;
}

.selected-path {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-success), 0.07);
  border: 1px solid rgba(var(--v-theme-success), 0.2);
  text-align: left;
}

.path-text {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 动画 */
.slide-down-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-down-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
