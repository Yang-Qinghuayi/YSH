/**
 * 阅读区的点击分区。
 *
 * 沿用阅读器原本「点中间弹菜单」的区域定义：
 * 中间 25%（37.5% ~ 62.5%）是独立区域，左右两侧各自负责翻页。
 * 现在中间区域改为触发「复制该段」，因此两者天然不会冲突。
 */
export const CENTER_REGION_START_RATIO = 0.375;
export const CENTER_REGION_END_RATIO = 0.625;

export type ClickRegion = 'left' | 'center' | 'right';

/**
 * @param screenX    点击处的屏幕 X 坐标（与 iframe 上报的 screenX 同一坐标系）
 * @param viewStartX 阅读区左边界的屏幕 X 坐标
 * @param viewWidth  阅读区宽度
 */
export const getClickRegion = (
  screenX: number,
  viewStartX: number,
  viewWidth: number
): ClickRegion => {
  const centerStartX = viewStartX + viewWidth * CENTER_REGION_START_RATIO;
  const centerEndX = viewStartX + viewWidth * CENTER_REGION_END_RATIO;
  if (screenX >= centerStartX && screenX <= centerEndX) return 'center';
  return screenX >= viewStartX + viewWidth / 2 ? 'right' : 'left';
};
