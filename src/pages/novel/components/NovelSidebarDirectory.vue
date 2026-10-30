<template>
  <!-- 当前小说区：标题 + 切换/导入入口 -->
  <div class="sidebar-card lg-card">
    <div class="sidebar-card__head">
      <v-icon :icon="mdiBookOpenVariant" size="14" class="lg-section-label" />
      <span class="lg-section-label">当前小说</span>
    </div>
    <div class="current-novel-box">
      <div v-if="novel" class="current-novel-title text-truncate">
        {{ novel.title }}
      </div>
      <div v-else class="current-novel-title current-novel-title--empty">未打开小说</div>
      <div class="current-novel-actions">
        <button class="lg-pill mini-action" @click="$emit('switchNovel')">
          <v-icon :icon="mdiSwapHorizontal" size="13" /> 切换
        </button>
        <button class="lg-pill mini-action mini-action--ghost" @click="$emit('importNovel')">
          <v-icon :icon="mdiImport" size="13" /> 导入
        </button>
      </div>
    </div>
  </div>

  <div v-if="novel" class="sidebar-card lg-card">
    <div class="sidebar-card__head">
      <v-icon :icon="mdiFormatListBulleted" size="14" class="lg-section-label" />
      <span class="lg-section-label">章节</span>
    </div>
    <ChapterList
      :chapters="novel.chapters"
      :current-chapter-id="currentChapterId"
      @select="$emit('select', $event)"
      @delete="$emit('delete', $event)"
      @create="$emit('create', $event)"
    />
  </div>

  <div
    v-if="novel"
    class="sidebar-card lg-card sidebar-card--clickable"
    @click="$emit('openCharacters')"
  >
    <div class="sidebar-card__head">
      <v-icon :icon="mdiAccountGroupOutline" size="14" class="lg-section-label" />
      <span class="lg-section-label">角色</span>
    </div>
    <div class="chip-wrap">
      <v-chip
        v-for="character in novel.characters"
        :key="character.id"
        size="x-small"
        variant="tonal"
        color="primary"
        class="chip-item chip-clickable"
        @click.stop="$emit('openCharacterPanel', character.name)"
      >
        {{ character.name }}
      </v-chip>
      <span v-if="!novel.characters.length" class="empty-hint">暂无角色</span>
    </div>
  </div>

  <div v-if="novel" class="sidebar-card lg-card sidebar-card--clickable" @click="$emit('openLore')">
    <div class="sidebar-card__head">
      <v-icon :icon="mdiBookshelf" size="14" class="lg-section-label" />
      <span class="lg-section-label">设定</span>
    </div>
    <div class="chip-wrap">
      <v-chip
        v-for="entry in loreEntries"
        :key="entry.id"
        size="x-small"
        color="info"
        variant="tonal"
        class="chip-item chip-clickable"
        @click.stop="$emit('openLoreAt', entry.id)"
      >
        {{ entry.name }}
      </v-chip>
      <span v-if="!loreEntries.length" class="empty-hint">暂无设定</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  mdiAccountGroupOutline,
  mdiBookOpenVariant,
  mdiBookshelf,
  mdiFormatListBulleted,
  mdiImport,
  mdiSwapHorizontal,
} from '@mdi/js';

import type { EntryMeta } from '@/types/lore';
import type { ChapterMeta, Novel } from '@/types/novel';

import ChapterList from './ChapterList.vue';

defineProps<{
  novel: Novel | null;
  currentChapterId?: string;
  loreEntries: EntryMeta[];
}>();

defineEmits<{
  select: [chapter: ChapterMeta];
  delete: [chapterId: string];
  create: [title: string];
  switchNovel: [];
  importNovel: [];
  openCharacters: [];
  openLore: [];
  openCharacterPanel: [name: string];
  openLoreAt: [entryId: string];
}>();
</script>
