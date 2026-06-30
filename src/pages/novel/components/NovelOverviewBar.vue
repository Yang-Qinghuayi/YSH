<template>
  <div class="overview-bar lg-card">
    <!-- 标题简介 -->
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
  </div>
</template>

<script setup lang="ts">
import {
  mdiBookOpenVariant,
  mdiCounter,
  mdiAccountGroupOutline,
} from '@mdi/js'
import { formatTotalWordCount } from '@/services/novelService'
import type { Novel } from '@/types/novel'

const props = defineProps<{
  novel: Novel | null
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
  line-height: 1; /* 让文字高度 = 字号，使图标与文字几何中心真正对齐 */
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
