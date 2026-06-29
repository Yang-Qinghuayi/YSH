import { useReaderStore } from '@/store/readerStore';
import { useTTSStore } from '@/store/ttsStore';
import { isTauriAppPlatform } from '@/services/environment';
import useShortcuts from '@/hooks/useShortcuts';
import { useSidebarStore } from '@/store/sidebarStore';
import { useSettingsStore } from '@/store/settingsStore';
import { saveViewSettings } from '@/utils/viewSettingsHelper';
import { tauriHandleToggleFullScreen, tauriQuitApp } from '@/utils/window';
import { eventDispatcher } from '@/utils/event';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_STEP } from '@/services/constants';

const useBookShortcuts = (sideBarBookKey: string) => {
  const { getView, getViewSettings } = useReaderStore();
  const { toggleSideBar } = useSidebarStore();
  const { setFontLayoutSettingsDialogOpen } = useSettingsStore();
  const viewSettings = getViewSettings(sideBarBookKey ?? '');
  const fontSize = viewSettings?.defaultFontSize ?? 16;
  const lineHeight = viewSettings?.lineHeight ?? 1.6;
  const distance = fontSize * lineHeight * 3;

  /**
   * 切换滚动/分页模式，并持久化到磁盘。
   * 使用 saveViewSettings 替代直接 setViewSettings，
   * 确保重新打开书籍后模式设置不丢失。
   */
  const toggleScrollMode = () => {
    const viewSettings = getViewSettings(sideBarBookKey ?? '');
    if (viewSettings && sideBarBookKey) {
      saveViewSettings(sideBarBookKey, 'scrolled', !viewSettings.scrolled);
    }
  };

  const switchSideBar = () => {
  };

  const goLeft = () => {
    getView(sideBarBookKey)?.goLeft();
  };

  const goRight = () => {
    getView(sideBarBookKey)?.goRight();
  };

  const goPrev = () => {
    getView(sideBarBookKey)?.prev(distance);
  };

  const goNext = () => {
    getView(sideBarBookKey)?.next(distance);
  };

  const goBack = () => {
    getView(sideBarBookKey)?.history.back();
  };

  const goHalfPageDown = () => {
    const view = getView(sideBarBookKey);
    const viewSettings = getViewSettings(sideBarBookKey ?? '');
    if (view && viewSettings && viewSettings.scrolled) {
      view.next(view.renderer.size / 2);
    }
  };

  const goHalfPageUp = () => {
    const view = getView(sideBarBookKey);
    const viewSettings = getViewSettings(sideBarBookKey ?? '');
    if (view && viewSettings && viewSettings.scrolled) {
      view.prev(view.renderer.size / 2);
    }
  };

  const goForward = () => {
    getView(sideBarBookKey)?.history.forward();
  };

  const reloadPage = () => {
    window.location.reload();
  };

  const toggleFullscreen = async () => {
    if (isTauriAppPlatform()) {
      await tauriHandleToggleFullScreen();
    }
  };

  const quitApp = async () => {
    // on web platform use browser's default shortcut to close the tab
    if (isTauriAppPlatform()) {
      await tauriQuitApp();
    }
  };

  const showSearchBar = () => {
    eventDispatcher.dispatch('search', { term: '' });
  };

  /**
   * 以下 zoom 操作通过 saveViewSettings 持久化，
   * 重新打开书籍后缩放级别得以保留。
   */
  const zoomIn = () => {
    if (!sideBarBookKey) return;
    const view = getView(sideBarBookKey);
    if (!view?.renderer?.setStyles) return;
    const viewSettings = getViewSettings(sideBarBookKey)!;
    const newZoom = Math.min(viewSettings.zoomLevel + ZOOM_STEP, MAX_ZOOM_LEVEL);
    saveViewSettings(sideBarBookKey, 'zoomLevel', newZoom);
  };

  const zoomOut = () => {
    if (!sideBarBookKey) return;
    const view = getView(sideBarBookKey);
    if (!view?.renderer?.setStyles) return;
    const viewSettings = getViewSettings(sideBarBookKey)!;
    const newZoom = Math.max(viewSettings.zoomLevel - ZOOM_STEP, MIN_ZOOM_LEVEL);
    saveViewSettings(sideBarBookKey, 'zoomLevel', newZoom);
  };

  const resetZoom = () => {
    if (!sideBarBookKey) return;
    const view = getView(sideBarBookKey);
    if (!view?.renderer?.setStyles) return;
    saveViewSettings(sideBarBookKey, 'zoomLevel', 100);
  };

  const ttsStore = useTTSStore();
  const ensureTTSInit = async () => {
    const view = getView(sideBarBookKey);
    if (!view) return false;
    if (!ttsStore.getController(sideBarBookKey)) {
      await ttsStore.init(sideBarBookKey, view);
    }
    return true;
  };
  const ttsPlay = async () => {
    if (await ensureTTSInit()) await ttsStore.play(sideBarBookKey);
  };
  const ttsStop = async () => {
    await ttsStore.stop(sideBarBookKey);
  };
  const ttsForward = async () => {
    if (await ensureTTSInit()) await ttsStore.forward(sideBarBookKey);
  };
  const ttsBackward = async () => {
    if (await ensureTTSInit()) await ttsStore.backward(sideBarBookKey);
  };

  useShortcuts(
    {
      onSwitchSideBar: switchSideBar,
      onToggleSideBar: toggleSideBar,
      onToggleScrollMode: toggleScrollMode,
      onOpenFontLayoutSettings: () => setFontLayoutSettingsDialogOpen(true),
      onToggleSearchBar: showSearchBar,
      onReloadPage: reloadPage,
      onToggleFullscreen: toggleFullscreen,
      onQuitApp: quitApp,
      onGoLeft: goLeft,
      onGoRight: goRight,
      onGoPrev: goPrev,
      onGoNext: goNext,
      onGoHalfPageDown: goHalfPageDown,
      onGoHalfPageUp: goHalfPageUp,
      onGoBack: goBack,
      onGoForward: goForward,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      onResetZoom: resetZoom,
      onTTSPlay: ttsPlay,
      onTTSStop: ttsStop,
      onTTSForward: ttsForward,
      onTTSBackward: ttsBackward,
    },
  );
};

export default useBookShortcuts;
