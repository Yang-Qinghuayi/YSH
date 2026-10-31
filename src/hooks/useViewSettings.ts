import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useBookIdStore } from '@/store/bookIdStore';
import { useReaderStore } from '@/store/readerStore';
import { type ViewSettings } from '@/types/book';
import { saveViewSettings } from '@/utils/viewSettingsHelper';

/**
 * 提供响应式的 viewSettings 访问与更新能力。
 *
 * 相比在组件内只调用一次 `getViewSettings(bookId.value)`（会保留被替换的旧对象），
 * 此 composable 使用 computed 追踪 store 变化，
 * 确保任何路径（快捷键、其他组件）修改 viewSettings 后 UI 自动同步。
 */
export function useViewSettings() {
  const { bookId } = storeToRefs(useBookIdStore());
  const readerStore = useReaderStore();

  const viewSettings = computed(() => readerStore.getViewSettings(bookId.value));

  const updateSetting = <K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) =>
    saveViewSettings(bookId.value, key, value);

  return { bookId, viewSettings, updateSetting };
}
