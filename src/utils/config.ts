import type { ViewSettings } from '@/types/book';

export const MIN_CONTENT_WIDTH = 50;
export const MAX_CONTENT_WIDTH = 100;
export const DEFAULT_CONTENT_WIDTH = 100;

export const getColumnCount = (viewSettings: ViewSettings) =>
  viewSettings.scrolled ? 1 : Math.max(1, viewSettings.maxColumnCount || 1);

/**
 * 用阅读器实际可用尺寸（不含导航、目录）换算每列宽度，而不是用 window 的尺寸。
 * 原来的单列 / 滚动模式会强制覆盖为 700px，导致宽度设置被忽略。
 * 隐藏或尚未挂载的阅读器先沿用像素设置，ResizeObserver 会在显示后重新应用比例。
 */
export const getMaxInlineSize = (
  viewSettings: ViewSettings,
  viewport?: { width: number; height: number }
) => {
  const availableSize = viewSettings.vertical ? viewport?.height : viewport?.width;
  if (!availableSize || availableSize <= 0) return viewSettings.maxInlineSize || 720;

  const width = Number.isFinite(viewSettings.contentWidth)
    ? Math.min(MAX_CONTENT_WIDTH, Math.max(MIN_CONTENT_WIDTH, viewSettings.contentWidth))
    : DEFAULT_CONTENT_WIDTH;
  return Math.max(1, Math.round((availableSize * width) / 100 / getColumnCount(viewSettings)));
};

export const getDefaultMaxInlineSize = () => {
  if (typeof window === 'undefined') return 720;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  return screenWidth < screenHeight ? Math.max(screenWidth, 720) : 720;
};

export const getDefaultMaxBlockSize = () => {
  if (typeof window === 'undefined') return 1440;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  return Math.max(screenWidth, screenHeight, 1440);
};
