import { EnvConfigType } from '@/services/environment';
import env from '@/services/environment';
import { AppService } from '@/types/system';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from "@/store/libraryStore"

let appService: AppService | null
export const envConfig = reactive(env) as EnvConfigType;
let cachedPromise: Promise<void> | null = null;

const initAppService = async () => {
  appService = await envConfig.getAppService()
}

export const useAppService = async () => {
  if (appService) {
    return appService
  }
  if (!cachedPromise) {
    cachedPromise = initAppService()
  }
  await cachedPromise;
  if (!appService) throw new Error("AppService not initialized");
  return appService;
}

let cachedLibraryPromise: Promise<void> | null = null;

export const libraryLoaded = ref(false)

export const initLibrary = async () => {
  if (cachedLibraryPromise) return cachedLibraryPromise;

  cachedLibraryPromise = (async () => {
    await initAppService()
    if (!appService) throw new Error("AppService not initialized");

    const [settingsData, libraryBooks] = await Promise.all([
      appService.loadSettings(),
      appService.loadLibraryBooks(),
    ]);

    const { setSettings } = useSettingsStore();
    const { setLibrary, setCheckOpenWithBooks } = useLibraryStore();

    if (settingsData) setSettings(settingsData);
    if (libraryBooks) setLibrary(libraryBooks);
    setCheckOpenWithBooks(false);
    libraryLoaded.value = true;
  })();

  return cachedLibraryPromise;
};
