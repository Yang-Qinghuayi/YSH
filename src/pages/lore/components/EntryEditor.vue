<template>
  <div class="entry-editor flex flex-col h-full">
    <!-- 顶部元数据表单 -->
    <div class="entry-meta-form shrink-0">
      <!-- 重要度 + 启用 -->
      <div class="flex items-center flex-wrap gap-2 mb-2">
        <select
          :value="entry.importance"
          class="native-input native-input-sm native-select"
          @change="handleMetaChange('importance', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in importanceOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <!-- 自定义启用切换，确保 off 状态清晰可见 -->
        <button
          class="enabled-toggle"
          :class="{ 'is-on': entry.enabled }"
          @click="handleMetaChange('enabled', !entry.enabled)"
        >
          <span class="et-track"><span class="et-thumb" /></span>
          <span class="et-label">{{ entry.enabled ? 'AI 读取中' : 'AI 不读取' }}</span>
        </button>
      </div>

      <!-- 简介 -->
      <label class="native-label mb-2">
        <span class="native-label-text">索引简介（3-5 句，供 AI 快速参考）</span>
        <textarea
          :value="entry.briefDescription"
          class="native-input native-input-sm native-textarea-xs"
          rows="2"
          placeholder="简短描述这个条目…"
          @input="
            handleMetaChange('briefDescription', ($event.target as HTMLTextAreaElement).value)
          "
        ></textarea>
      </label>

      <!-- 关键词 -->
      <label class="native-label">
        <span class="native-label-text">别名 / 触发词</span>
        <div class="native-tags-wrapper native-tags-sm" @click="focusKeywordInput">
          <span v-for="(kw, i) in entry.keywords" :key="i" class="native-tag">
            {{ kw }}
            <button type="button" class="native-tag-remove" @click.stop="removeKeyword(i)">
              &times;
            </button>
          </span>
          <input
            ref="keywordInputRef"
            v-model="keywordInput"
            type="text"
            class="native-tags-input"
            placeholder="输入后按回车添加"
            @keydown.enter.prevent="addKeyword"
            @keydown.backspace="removeLastKeyword"
          />
        </div>
      </label>
    </div>

    <!-- 正文 -->
    <label class="native-label">
      <span class="native-label-text">条目正文（支持 Markdown，内容会注入到 AI 写作上下文中）</span>
      <textarea
        :value="content"
        class="native-input native-textarea-lg"
        rows="12"
        placeholder="在此编写条目正文…"
        @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { EntryMeta } from '@/types/lore';
import { ENTRY_IMPORTANCE_LABELS } from '@/types/lore';

const props = defineProps<{
  entry: EntryMeta;
  content: string;
}>();

const emit = defineEmits<{
  'update:content': [content: string];
  'update:meta': [patch: Partial<EntryMeta>];
}>();

const importanceOptions = Object.entries(ENTRY_IMPORTANCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// 元数据变更（表单字段）
function handleMetaChange(field: keyof EntryMeta, value: unknown) {
  emit('update:meta', { [field]: value } as Partial<EntryMeta>);
}

// 关键词标签输入
const keywordInput = ref('');
const keywordInputRef = ref<HTMLInputElement | null>(null);

function focusKeywordInput() {
  keywordInputRef.value?.focus();
}

function addKeyword() {
  const val = keywordInput.value.trim();
  if (!val) return;
  const keywords = [...(props.entry.keywords ?? [])];
  if (!keywords.includes(val)) {
    keywords.push(val);
    emit('update:meta', { keywords } as Partial<EntryMeta>);
  }
  keywordInput.value = '';
}

function removeKeyword(index: number) {
  const keywords = [...(props.entry.keywords ?? [])];
  keywords.splice(index, 1);
  emit('update:meta', { keywords } as Partial<EntryMeta>);
}

function removeLastKeyword(e: KeyboardEvent) {
  if (keywordInput.value === '' && props.entry.keywords?.length) {
    const keywords = [...props.entry.keywords];
    keywords.pop();
    emit('update:meta', { keywords } as Partial<EntryMeta>);
    e.preventDefault();
  }
}
</script>

<style scoped>
.entry-editor {
  height: 100%;
  overflow: hidden;
  padding: 12px;
  gap: 12px;
}

.entry-meta-form {
  padding: 8px 4px 0;
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
  color: color-mix(in srgb, var(--color-on-surface) 70%, transparent);
  padding-left: 4px;
}
.native-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  color: var(--color-on-surface);
  background: color-mix(in srgb, var(--color-on-surface) 4%, transparent);
  border: none;
  border-radius: 14px;
  outline: none;
  transition: box-shadow 0.2s;
  box-sizing: border-box;
}
.native-input::placeholder {
  color: color-mix(in srgb, var(--color-on-surface) 40%, transparent);
}
.native-input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.native-input-sm {
  padding: 7px 10px;
  font-size: 13px;
  border-radius: 10px;
}
.native-textarea-xs {
  resize: vertical;
  min-height: 44px;
}
.native-select {
  max-width: 120px;
  cursor: pointer;
  appearance: auto;
}

/* ===== 原生标签输入 ===== */
.native-tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  min-height: 42px;
  background: color-mix(in srgb, var(--color-on-surface) 4%, transparent);
  border: none;
  border-radius: 14px;
  cursor: text;
  transition: box-shadow 0.2s;
}
.native-tags-wrapper:focus-within {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.native-tags-sm {
  padding: 4px 8px;
  min-height: 34px;
  border-radius: 10px;
}
.native-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
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
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
}
.native-tags-input {
  flex: 1;
  min-width: 100px;
  padding: 2px 4px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-on-surface);
  background: transparent;
  border: none;
  outline: none;
}
.native-tags-input::placeholder {
  color: color-mix(in srgb, var(--color-on-surface) 40%, transparent);
}

/* ---- 自定义启用切换 ---- */
.enabled-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  border: none;
  background: none;
  padding: 2px 0;
  user-select: none;
}

.et-track {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: 1.5px solid color-mix(in srgb, var(--color-on-surface) 28%, transparent);
  background: color-mix(in srgb, var(--color-on-surface) 7%, transparent);
  position: relative;
  flex-shrink: 0;
  transition:
    background 0.22s ease,
    border-color 0.22s ease;
}
.is-on .et-track {
  background: var(--color-primary);
  border-color: transparent;
}

.et-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-on-surface) 40%, transparent);
  transition:
    left 0.22s ease,
    background 0.22s ease;
}
.is-on .et-thumb {
  left: 19px;
  background: #fff;
}

.et-label {
  font-size: 12.5px;
  font-weight: 500;
  color: color-mix(in srgb, var(--color-on-surface) 45%, transparent);
  transition: color 0.22s ease;
}
.is-on .et-label {
  color: var(--color-primary);
}
</style>
