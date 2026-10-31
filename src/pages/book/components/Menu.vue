<template>
  <v-dialog v-model="showMenu" width="520" max-width="calc(100% - 24px)" :aria-labelledby="titleId">
    <v-card class="reading-menu" elevation="0">
      <header class="reading-menu__header">
        <span class="reading-menu__emblem" aria-hidden="true">
          <v-icon :icon="mdiTuneVariant" size="23" />
        </span>
        <div class="reading-menu__title-group">
          <h2 :id="titleId">阅读设置</h2>
          <p>版式、字体与阅读习惯</p>
        </div>
        <button
          type="button"
          class="reading-menu__close"
          aria-label="关闭阅读设置"
          @click="showMenu = false"
        >
          <v-icon :icon="mdiClose" size="20" />
        </button>
      </header>

      <div class="reading-menu__body lg-scroll">
        <section class="reading-menu__sliders" aria-label="正文排版">
          <ReadingWidthSlider />
          <FontSizeSlider />
          <FontWeightSlider />
        </section>

        <section aria-label="阅读方式">
          <div class="reading-menu__section-heading">
            <h3>阅读方式</h3>
            <span>{{ scrollMode ? '连续滚动' : twoColumn ? '双页分页' : '单页分页' }}</span>
          </div>
          <div class="reading-menu__group">
            <ReadingToggle
              v-model="scrollMode"
              label="连续滚动"
              description="上下滑动，无缝衔接章节"
              :disabled="!viewSettings"
            />
            <ReadingToggle
              v-model="twoColumn"
              label="双列显示"
              description="并排阅读两页，开启后关闭连续滚动"
              :disabled="!viewSettings"
            />
          </div>
        </section>

        <section aria-label="字体与交互">
          <div class="reading-menu__section-heading">
            <h3>字体与交互</h3>
          </div>
          <div class="reading-menu__group">
            <ReadingToggle
              v-model="overrideFont"
              label="覆盖字体"
              description="使用所选字体替代书籍原字体"
              :disabled="!viewSettings"
            />
            <v-menu location="bottom end" max-height="300" :disabled="!overrideFont">
              <template #activator="{ props }">
                <button
                  v-bind="props"
                  type="button"
                  class="reading-menu__font-button"
                  aria-label="选择字体"
                  :disabled="!overrideFont || !viewSettings"
                >
                  <span>选择字体</span>
                  <span class="reading-menu__font-value">
                    <span>{{ defaultCJKFont }}</span>
                    <v-icon :icon="mdiChevronDown" size="18" />
                  </span>
                </button>
              </template>
              <v-list class="reading-menu__font-list" density="compact" rounded="xl">
                <v-list-item
                  v-for="font in CJKFonts"
                  :key="font"
                  :value="font"
                  :active="font === defaultCJKFont"
                  color="primary"
                  @click="defaultCJKFont = font"
                >
                  <v-list-item-title>{{ font }}</v-list-item-title>
                  <template v-if="font === defaultCJKFont" #append>
                    <v-icon :icon="mdiCheck" size="18" />
                  </template>
                </v-list-item>
              </v-list>
            </v-menu>
            <ReadingToggle
              v-model="settingStore.copyParagraphOnClick"
              label="三击复制段落"
              description="三击正文选中一段，静默复制到剪贴板"
            />
          </div>
        </section>
      </div>

      <footer class="reading-menu__footer">
        <span>设置即时生效</span>
        <v-btn
          class="reading-menu__done"
          color="primary"
          variant="flat"
          rounded="pill"
          @click="showMenu = false"
        >
          返回阅读
        </v-btn>
      </footer>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { mdiCheck, mdiChevronDown, mdiClose, mdiTuneVariant } from '@mdi/js';
import { computed, ref, useId } from 'vue';

import { useViewSettings } from '@/hooks/useViewSettings';
import {
  ANDROID_FONTS,
  CJK_EXCLUDE_PATTENS,
  CJK_FONTS_PATTENS,
  CJK_NAMES_PATTENS,
  CJK_SANS_SERIF_FONTS,
  CJK_SERIF_FONTS,
  DEFAULT_BOOK_FONT,
  IOS_FONTS,
  LINUX_FONTS,
  MACOS_FONTS,
  WINDOWS_FONTS,
} from '@/services/constants';
import { isTauriAppPlatform } from '@/services/environment';
import { useSettingStore } from '@/store/setting';
import { getSysFontsList } from '@/utils/bridge';
import { getOSPlatform } from '@/utils/misc';

import FontSizeSlider from './FontSizeSlider.vue';
import FontWeightSlider from './FontWeightSlider.vue';
import ReadingToggle from './ReadingToggle.vue';
import ReadingWidthSlider from './ReadingWidthSlider.vue';

const showMenu = defineModel<boolean>('showMenu', { required: true });
const titleId = useId();
const settingStore = useSettingStore();
const { viewSettings, updateSetting } = useViewSettings();

// 直接读写 store，避免 watchEffect 回填本地 ref 又触发保存，造成模式切换互相覆盖。
const scrollMode = computed({
  get: () => viewSettings.value?.scrolled ?? false,
  set: (value: boolean) => void updateSetting('scrolled', value),
});
const twoColumn = computed({
  get: () => !scrollMode.value && viewSettings.value?.maxColumnCount === 2,
  set: (value: boolean) => void updateSetting('maxColumnCount', value ? 2 : 1),
});
const overrideFont = computed({
  get: () => viewSettings.value?.overrideFont ?? false,
  set: (value: boolean) => void updateSetting('overrideFont', value),
});
const defaultCJKFont = computed({
  get: () => viewSettings.value?.defaultCJKFont || DEFAULT_BOOK_FONT.defaultCJKFont,
  set: (value: string) => void updateSetting('defaultCJKFont', value),
});

const platformFonts: Record<string, string[]> = {
  macos: MACOS_FONTS,
  windows: WINDOWS_FONTS,
  linux: LINUX_FONTS,
  ios: IOS_FONTS,
  android: ANDROID_FONTS,
};
const sysFonts = ref<string[]>(platformFonts[getOSPlatform()] ?? []);
const CJKFonts = computed(() =>
  Array.from(
    new Set([...sysFonts.value, defaultCJKFont.value, ...CJK_SERIF_FONTS, ...CJK_SANS_SERIF_FONTS])
  )
    .filter((font) => CJK_FONTS_PATTENS.test(font) || CJK_NAMES_PATTENS.test(font))
    .filter((font) => !CJK_EXCLUDE_PATTENS.test(font))
    .sort((a, b) => a.localeCompare(b))
);

if (isTauriAppPlatform()) {
  getSysFontsList()
    .then((res) => {
      if (res.error || res.fonts.length === 0) {
        console.error('Failed to get system fonts list:', res.error);
        return;
      }
      sysFonts.value = res.fonts.filter(
        (font) =>
          font && !/emoji|icons|symbol|dingbats|ornaments|webdings|wingdings|miuiex/i.test(font)
      );
    })
    .catch((error) => console.error('Failed to get system fonts list:', error));
}
</script>

<style scoped>
.reading-menu {
  width: 100%;
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-outline) 22%, transparent);
  border-radius: 26px;
  background: var(--color-surface);
  color: var(--color-on-surface);
}

.reading-menu__header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 18px 24px 16px;
}

.reading-menu__emblem {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 15px;
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
}

.reading-menu__title-group {
  flex: 1;
  min-width: 0;
}

.reading-menu__title-group h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.03em;
}

.reading-menu__title-group p {
  margin: 3px 0 0;
  color: var(--color-on-surface-variant);
  font-size: 11px;
}

.reading-menu__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
}

.reading-menu__close:hover {
  background: var(--color-surface-variant);
}

.reading-menu__close:focus-visible,
.reading-menu__font-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -3px;
}

.reading-menu__body {
  min-height: 0;
  overflow-y: auto;
  padding: 0 24px 16px;
}

.reading-menu__sliders {
  display: grid;
  gap: 14px;
  padding: 4px 2px 0;
}

.reading-menu__body > section + section {
  margin-top: 18px;
}

.reading-menu__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 3px 9px;
  color: var(--color-on-surface-variant);
}

.reading-menu__section-heading h3 {
  margin: 0;
  line-height: 1.5;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.reading-menu__section-heading > span {
  font-size: 10px;
  color: var(--color-primary);
}

.reading-menu__group {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-outline) 20%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-surface-variant) 26%, var(--color-surface));
}

.reading-menu__group > :not(:first-child) {
  border-top: 1px solid color-mix(in srgb, var(--color-outline) 15%, transparent);
}

.reading-menu__font-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 50px;
  padding: 10px 16px;
  border: 0;
  background: transparent;
  font-family: inherit;
  color: var(--color-on-surface);
  text-align: left;
  font-size: 14px;
  cursor: pointer;
}

.reading-menu__font-button > span:first-child {
  flex-shrink: 0;
}

.reading-menu__font-value {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--color-primary);
  font-size: 12px;
}

.reading-menu__font-value > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.reading-menu__font-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.reading-menu__font-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
}

.reading-menu__font-list {
  border: 1px solid color-mix(in srgb, var(--color-outline) 20%, transparent);
  background: var(--color-surface);
}

.reading-menu__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  padding: 12px 24px 14px;
  border-top: 1px solid color-mix(in srgb, var(--color-outline) 15%, transparent);
}

.reading-menu__footer > span {
  color: var(--color-on-surface-variant);
  font-size: 11px;
}

.reading-menu__done {
  color: var(--color-on-primary);
  min-width: 110px;
  height: 40px;
  letter-spacing: 0.03em;
}

@media (max-width: 480px) {
  .reading-menu {
    border-radius: 22px;
  }

  .reading-menu__header {
    padding: 16px 18px 14px;
  }

  .reading-menu__body {
    padding-right: 18px;
    padding-left: 18px;
  }

  .reading-menu__footer {
    padding-right: 18px;
    padding-left: 18px;
  }
}
</style>
