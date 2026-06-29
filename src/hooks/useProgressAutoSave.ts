import { type Ref, watch, onMounted } from 'vue';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { throttle } from '@/utils/throttle';


export function useProgressAutoSave(bookKeyRef: Ref<string>) {
  const bookDataStore = useBookDataStore();
  const readerStore = useReaderStore();
  const settingsStore = useSettingsStore();

  const saveBookConfig = throttle(async () => {
    const bookKey = bookKeyRef.value; // 每次执行时读取最新值，支持书籍切换
    if (!bookKey) return;
    const config = bookDataStore.getConfig(bookKey);
    const settings = settingsStore.settings;
    if (config) {
      try {
        await bookDataStore.saveConfig(bookKey, config, settings);
      } catch (e) {
        console.error('[useProgressAutoSave] Failed to save config:', e);
      }
    }
  }, 1000);

  // 初次挂载时保存一次
  onMounted(() => {
    saveBookConfig();
  });

  // 监听阅读进度变化（progress 每次是整体替换，不需要 deep 监听）
  watch(
    () => readerStore.getProgress(bookKeyRef.value),
    () => {
      saveBookConfig();
    },
  );
}
