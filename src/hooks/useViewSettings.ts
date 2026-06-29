import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { type ViewSettings } from '@/types/book';
import { useBookIdStore } from '@/store/bookIdStore';
import { useReaderStore } from '@/store/readerStore';
import { saveViewSettings } from '@/utils/viewSettingsHelper';

/**
 * 提供响应式的 viewSettings 访问与更新能力。
 *
 * 相比在组件内直接调用 `getViewSettings(bookId.value)`（返回非响应式快照），
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
