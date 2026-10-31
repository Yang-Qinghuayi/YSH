import { envConfig } from '@/hooks/useEnv';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { ViewSettings } from '@/types/book';
import type { FoliateView } from '@/types/view';
import { getColumnCount, getMaxInlineSize } from '@/utils/config';
import { getStyles } from '@/utils/style';

const setRendererAttribute = (view: FoliateView, name: string, value: string | number) => {
  // paginator 每次 setAttribute 都会重新分页；相同值不要重复触发布局。
  if (view.renderer.getAttribute(name) !== String(value)) {
    view.renderer.setAttribute(name, String(value));
  }
};

/** 调整正文宽度，也用于窗口缩放、旋转和展开 / 收起目录后的重排。 */
export const applyReaderWidth = (view: FoliateView, viewSettings: ViewSettings) => {
  const viewport = view.renderer.getBoundingClientRect();
  if (viewport.width <= 0 || viewport.height <= 0) return;
  setRendererAttribute(view, 'max-inline-size', `${getMaxInlineSize(viewSettings, viewport)}px`);
};

/** 同步 paginator 的 no-continuous-scroll 属性（与 continuousScroll 语义相反）。 */
export const applyContinuousScroll = (view: FoliateView, viewSettings: ViewSettings) => {
  if (viewSettings.scrolled && viewSettings.continuousScroll) {
    if (view.renderer.getAttribute('no-continuous-scroll') !== null) {
      view.renderer.removeAttribute('no-continuous-scroll');
    }
  } else {
    setRendererAttribute(view, 'no-continuous-scroll', '');
  }
};

/** 初次打开与后续修改走同一条布局更新路径，避免开关、宽度只在重开书籍后生效。 */
const applyRendererLayout = (view: FoliateView, viewSettings: ViewSettings) => {
  if (viewSettings.animated) {
    setRendererAttribute(view, 'animated', '');
  } else if (view.renderer.getAttribute('animated') !== null) {
    view.renderer.removeAttribute('animated');
  }

  // 开启滚动时先允许跨章预加载；退出滚动时先让 flow 刷新当前阅读锚点，再同步跨章属性。
  if (viewSettings.scrolled) applyContinuousScroll(view, viewSettings);
  setRendererAttribute(view, 'flow', viewSettings.scrolled ? 'scrolled' : 'paginated');
  if (!viewSettings.scrolled) applyContinuousScroll(view, viewSettings);

  for (const side of ['top', 'right', 'bottom', 'left']) {
    setRendererAttribute(view, `margin-${side}`, `${viewSettings.marginPx}px`);
  }
  setRendererAttribute(view, 'gap', `${viewSettings.gapPercent}%`);
  const columns = getColumnCount(viewSettings);
  setRendererAttribute(view, 'max-column-count', columns);
  // max-column-count 只是自适应上限；column-count 才是用户明确选定的单双列。
  setRendererAttribute(view, 'column-count', columns);
  applyReaderWidth(view, viewSettings);
  setRendererAttribute(view, 'max-block-size', `${viewSettings.maxBlockSize}px`);
};

export const applyRendererSettings = (view: FoliateView, viewSettings: ViewSettings) => {
  applyRendererLayout(view, viewSettings);
  view.renderer.setStyles?.(getStyles(viewSettings));
};

const layoutKeys = new Set<keyof ViewSettings>([
  'animated',
  'scrolled',
  'continuousScroll',
  'marginPx',
  'gapPercent',
  'maxColumnCount',
  'contentWidth',
  'maxInlineSize',
  'maxBlockSize',
]);

// 拖动滑块会连续触发保存：合并同一本书尚未执行的写入，并串行保存最新配置。
// 不延迟 UI 更新，也不让较慢的旧写入覆盖新值。
let pendingSave = Promise.resolve();
const queuedSaves = new Map<string, Promise<void>>();

export const saveViewSettings = async <K extends keyof ViewSettings>(
  bookKey: string,
  key: K,
  value: ViewSettings[K],
  skipGlobal = false,
  applyStyles = true
) => {
  const settingsStore = useSettingsStore();
  const readerStore = useReaderStore();
  const bookDataStore = useBookDataStore();
  const viewSettings = readerStore.getViewSettings(bookKey);
  if (!viewSettings || !bookDataStore.getConfig(bookKey)) return;

  const patch: Partial<ViewSettings> = { [key]: value };
  // 在 store / renderer / 持久化中原子切换，快捷键也遵循同样的互斥规则。
  if (key === 'scrolled') {
    patch.continuousScroll = Boolean(value);
    if (value) patch.maxColumnCount = 1;
  } else if (key === 'maxColumnCount' && Number(value) > 1) {
    patch.scrolled = false;
    patch.continuousScroll = false;
  }

  const changed = (Object.keys(patch) as (keyof ViewSettings)[]).some(
    (name) => viewSettings[name] !== patch[name]
  );
  if (!changed) return;

  const nextSettings = { ...viewSettings, ...patch };
  readerStore.setViewSettings(bookKey, nextSettings);
  if (applyStyles) {
    const view = readerStore.getView(bookKey);
    if (view?.renderer) {
      if (layoutKeys.has(key)) applyRendererLayout(view, nextSettings);
      else view.renderer.setStyles?.(getStyles(nextSettings));
    }
  }

  if (settingsStore.isFontLayoutSettingsGlobal && !skipGlobal) {
    settingsStore.setSettings({
      ...settingsStore.settings,
      globalViewSettings: { ...settingsStore.settings.globalViewSettings, ...patch },
    });
  }

  const persist = async () => {
    // setViewSettings 会替换 config，不能保存更新前捕获的旧对象。
    const config = bookDataStore.getConfig(bookKey);
    const settings = settingsStore.settings;
    if (config) {
      try {
        await bookDataStore.saveConfig(bookKey, config, settings);
      } catch (e) {
        console.error('[saveViewSettings] Failed to save book config:', e);
      }
    }
    try {
      await settingsStore.saveSettings(envConfig, settings);
    } catch (e) {
      console.error('[saveViewSettings] Failed to save global settings:', e);
    }
  };
  let queuedSave = queuedSaves.get(bookKey);
  if (!queuedSave) {
    const flush = async () => {
      queuedSaves.delete(bookKey);
      await persist();
    };
    queuedSave = pendingSave.then(flush, flush);
    queuedSaves.set(bookKey, queuedSave);
    pendingSave = queuedSave;
  }
  await queuedSave;
};
