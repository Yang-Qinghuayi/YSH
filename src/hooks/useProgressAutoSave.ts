import { watch, onMounted } from 'vue';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { throttle } from '@/utils/throttle';


export function useProgressAutoSave(bookKey: string) {
  const bookDataStore = useBookDataStore();
  const readerStore = useReaderStore();
  const settingsStore = useSettingsStore();

  const saveBookConfig = throttle(async () => {
    const config = bookDataStore.getConfig(bookKey);
    const settings = settingsStore.settings;
    if (config) {
      await bookDataStore.saveConfig( bookKey, config, settings);
    }
  },1000);

  // 初次挂载时保存一次
  onMounted(() => {
    saveBookConfig();
  });

  // 监听阅读进度变化
  watch(
    () => readerStore.getProgress(bookKey),
    () => {
      saveBookConfig();
    },
    { deep: true },
  );
}
