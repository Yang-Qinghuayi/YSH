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
  // 连续滚动：scrolled 开启且 continuousScroll 为真时，移除 no-continuous-scroll，
  // 让新版 paginator 内置的多视图预加载生效（信息流式无缝跨章）；
  // 否则置上 no-continuous-scroll，退化为单章滚动/分页。
  applyContinuousScroll(view, viewSettings);
  view.renderer.setStyles?.(getStyles(viewSettings));
};

/** 同步 paginator 的 no-continuous-scroll 属性（语义取反：continuousScroll=true → 移除该属性） */
export const applyContinuousScroll = (view: FoliateView, viewSettings: ViewSettings) => {
  if (viewSettings.scrolled && viewSettings.continuousScroll) {
    view.renderer.removeAttribute('no-continuous-scroll');
  } else {
    view.renderer.setAttribute('no-continuous-scroll', '');
  }
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
      // scrolled 或 continuousScroll 任一变化都需重新同步 no-continuous-scroll
      if (key === 'scrolled' || key === 'continuousScroll') {
        view && applyContinuousScroll(view, viewSettings);
      }
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
