<template>
  <div class="overview-bar lg-card">
    <!-- 左：折叠 + 标题简介 -->
    <button class="lg-icon-btn collapse-btn" :title="collapsed ? '展开侧栏' : '折叠侧栏'" @click="$emit('toggle-sidebar')">
      <v-icon :icon="collapsed ? mdiMenuOpen : mdiMenuClose" size="18" />
    </button>

    <div class="overview-title-wrap" v-if="novel">
      <div class="overview-title text-truncate">{{ novel.title }}</div>
      <div class="overview-synopsis text-truncate" v-if="novel.synopsis">{{ novel.synopsis }}</div>
    </div>

    <v-spacer />

    <!-- 中：统计胶囊组 -->
    <div class="stat-group" v-if="novel">
      <div class="stat-pill" :title="`章节数 ${chapterCount}`">
        <v-icon :icon="mdiBookOpenVariant" size="14" />
        <span class="stat-num">{{ chapterCount }}</span>
        <span class="stat-unit">章</span>
      </div>
      <div class="stat-pill" :title="`总字数 ${totalWordCount}`">
        <v-icon :icon="mdiCounter" size="14" />
        <span class="stat-num">{{ totalWordCount }}</span>
      </div>
      <div class="stat-pill" :title="`角色 ${characterCount}`">
        <v-icon :icon="mdiAccountGroupOutline" size="14" />
        <span class="stat-num">{{ characterCount }}</span>
      </div>
    </div>

    <!-- 右：操作入口 -->
    <div class="action-group" v-if="novel">
      <button class="lg-icon-btn" title="角色管理" @click="$emit('open-characters')">
        <v-icon :icon="mdiAccountGroupOutline" size="18" />
      </button>
      <button class="lg-icon-btn" title="全局搜索 (⌘⇧F)" @click="$emit('open-search')">
        <v-icon :icon="mdiMagnify" size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  mdiMenuClose,
  mdiMenuOpen,
  mdiBookOpenVariant,
  mdiCounter,
  mdiAccountGroupOutline,
  mdiMagnify,
} from '@mdi/js'
import { formatTotalWordCount } from '@/services/novelService'
import type { Novel } from '@/types/novel'

const props = defineProps<{
  novel: Novel | null
  collapsed: boolean
}>()

defineEmits<{
  'toggle-sidebar': []
  'open-characters': []
  'open-search': []
}>()

const chapterCount = computed(() => props.novel?.chapters.length ?? 0)
const characterCount = computed(() => props.novel?.characters.length ?? 0)
const totalWordCount = computed(() => {
  const n = props.novel?.chapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0) ?? 0
  return formatTotalWordCount(n)
})
</script>

<style scoped>
.overview-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin: 10px 14px 0;
  flex-shrink: 0;
  border-radius: 18px;
}

.collapse-btn {
  flex-shrink: 0;
}

.overview-title-wrap {
  min-width: 0;
  flex: 1;
  max-width: 100%;
}
.overview-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.88);
  line-height: 1.3;
}
.overview-synopsis {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  margin-top: 1px;
}

/* 统计胶囊组 */
.stat-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 11.5px;
  transition: background 0.18s ease, color 0.18s ease;
}
.stat-pill:hover {
  background: rgba(var(--v-theme-on-surface), 0.09);
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.stat-num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.stat-unit {
  font-size: 10.5px;
  opacity: 0.7;
}

/* 操作入口 */
.action-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding-left: 4px;
  margin-left: 2px;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* 窄屏：隐藏简介与单位，统计精简 */
@media (max-width: 720px) {
  .overview-synopsis,
  .stat-unit {
    display: none;
  }
  .overview-bar {
    margin: 8px 10px 0;
  }
}
</style>
