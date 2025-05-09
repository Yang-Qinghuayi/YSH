import { type ViewSettings } from '@/types/book';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getStyles } from '@/utils/style';

export const saveViewSettings = async <K extends keyof ViewSettings>(
  bookKey: string,
  key: K,
  value: ViewSettings[K],
  skipGlobal = false,
  applyStyles = true,
) => {
  const settingsStore = useSettingsStore();
  const readerStore = useReaderStore();
  const bookDataStore = useBookDataStore();

  const { settings, isFontLayoutSettingsGlobal } = settingsStore;
  const viewSettings = readerStore.getViewSettings(bookKey);
  const config = bookDataStore.getConfig(bookKey);

  if (!viewSettings || !config) return;

  if (viewSettings[key] !== value) {
    viewSettings[key] = value;
    if (applyStyles) {
      const view = readerStore.getView(bookKey);
      view?.renderer.setStyles?.(getStyles(viewSettings));
      if (key === "maxColumnCount")
        view?.renderer.setAttribute('max-column-count', value);
    }
  }

  readerStore.setViewSettings(bookKey, viewSettings);

  if (isFontLayoutSettingsGlobal && !skipGlobal) {
    settings.globalViewSettings[key] = value;
    settingsStore.setSettings(settings);
  }

  await bookDataStore.saveConfig(bookKey, config, settings);
  await settingsStore.saveSettings(envConfig, settings);
};
