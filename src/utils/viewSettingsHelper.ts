import { type FoliateView } from '@/types/view';
import { type ViewSettings } from '@/types/book';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getStyles } from '@/utils/style';
import { getMaxInlineSize } from '@/utils/config';

/**
 * 将所有渲染器布局属性一次性应用到 foliate-view。
 * 在打开书籍（initBook）时使用，对应完整的属性刷新。
 */
export const applyRendererSettings = (view: FoliateView, viewSettings: ViewSettings) => {
  const maxInlineSize = getMaxInlineSize(viewSettings);

  if (viewSettings.animated) {
    view.renderer.setAttribute('animated', '');
  } else {
    view.renderer.removeAttribute('animated');
  }
  view.renderer.setAttribute('flow', viewSettings.scrolled ? 'scrolled' : 'paginated');
  view.renderer.setAttribute('margin', `${viewSettings.marginPx}px`);
  view.renderer.setAttribute('gap', `${viewSettings.gapPercent}%`);
  view.renderer.setAttribute('max-column-count', viewSettings.maxColumnCount);
  view.renderer.setAttribute('max-inline-size', `${maxInlineSize}px`);
  view.renderer.setAttribute('max-block-size', `${viewSettings.maxBlockSize}px`);
  view.renderer.setStyles?.(getStyles(viewSettings));
};

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
      // 同步需要单独 setAttribute 的布局属性
      if (key === 'maxColumnCount')
        view?.renderer.setAttribute('max-column-count', value);
      if (key === 'scrolled')
        view?.renderer.setAttribute('flow', value ? 'scrolled' : 'paginated');
    }
  }

  readerStore.setViewSettings(bookKey, viewSettings);

  if (isFontLayoutSettingsGlobal && !skipGlobal) {
    settings.globalViewSettings[key] = value;
    settingsStore.setSettings(settings);
  }

  try {
    await bookDataStore.saveConfig(bookKey, config, settings);
  } catch (e) {
    console.error('[saveViewSettings] Failed to save book config:', e);
  }
  try {
    await settingsStore.saveSettings(envConfig, settings);
  } catch (e) {
    console.error('[saveViewSettings] Failed to save global settings:', e);
  }
};
