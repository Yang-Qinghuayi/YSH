import { isTauriAppPlatform } from '@/services/environment';
import { useBookIdStore } from '@/store/bookIdStore';
import { useReaderStore } from '@/store/readerStore';
import type { ViewSettings } from '@/types/book';
import type { AppService } from '@/types/system';
import type { FoliateView } from '@/types/view';
import { eventDispatcher } from '@/utils/event';
import { tauriGetWindowLogicalPosition } from '@/utils/window';

/**
 * 是否允许「点击左右两侧翻页」。
 *
 * - 连续滚动（上下滑动翻页）模式下，点击翻页与滑动翻页功能冗余，直接关闭：
 *   此时点击正文左右两侧不会有任何反应；
 * - disableClick 是阅读器自带的「禁用点击翻页」开关，同样不响应点击。
 *
 * 注意：菜单不再由正文点击触发，改为在书籍页再次点击「书籍」路由项时弹出。
 * 复制该段也不再占用点击区域，改为三击正文（浏览器原生选段）触发。
 */
const canFlipByClick = (viewSettings: ViewSettings | null) =>
  !!viewSettings && !viewSettings.scrolled && !viewSettings.disableClick;

export function usePageFlip(
  viewRef: Ref<FoliateView | null>,
  containerRef: Ref<HTMLElement | null>,
  appService: Ref<AppService | null>,
  onCopyParagraph?: (text: string) => void
) {
  const handlePageFlip = async (msg: MessageEvent | CustomEvent | MouseEvent) => {
    const { bookId: bookKey } = useBookIdStore();
    const readerStore = useReaderStore();
    const viewSettings = readerStore.getViewSettings(bookKey);

    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookKey === bookKey) {
        if (msg.data.type === 'iframe-triple-click') {
          // 三击正文：静默复制浏览器已选中的那一段（与翻页完全无关）
          onCopyParagraph?.(msg.data.text);
        } else if (msg.data.type === 'iframe-single-click') {
          // 上下滑动模式（或显式禁用点击翻页）下，正文点击一律不响应
          if (!canFlipByClick(viewSettings)) return;

          const viewElement = containerRef.value;
          if (viewElement) {
            const { screenX } = msg.data;
            const viewRect = viewElement.getBoundingClientRect();
            let windowStartX: number;

            if (isTauriAppPlatform()) {
              if (appService.value?.isMobile) {
                windowStartX = 0;
              } else {
                const windowPosition = (await tauriGetWindowLogicalPosition()) as {
                  x: number;
                  y: number;
                };
                windowStartX = windowPosition.x;
              }
            } else {
              windowStartX = window.screenX;
            }

            const viewStartX = windowStartX + viewRect.left;
            const viewCenterX = viewStartX + viewRect.width / 2;

            const consumed = eventDispatcher.dispatchSync('iframe-single-click');
            if (!consumed) {
              if (readerStore.hoveredBookKey) {
                readerStore.setHoveredBookKey(null);
                return;
              }
              // 三击不会走到这里，单击仍按屏幕中线区分上一页 / 下一页
              const isRightSide = screenX >= viewCenterX;
              const goNext = viewSettings!.swapClickArea ? !isRightSide : isRightSide;
              if (goNext) viewRef.value?.goRight();
              else viewRef.value?.goLeft();
            }
          }
        } else if (msg.data.type === 'iframe-wheel' && viewSettings && !viewSettings.scrolled) {
          const { deltaY } = msg.data;
          if (deltaY > 0) viewRef.value?.next(1);
          else viewRef.value?.prev(1);
        } else if (msg.data.type === 'iframe-mouseup') {
          if (msg.data.button === 3) {
            viewRef.value?.history.back();
          } else if (msg.data.button === 4) {
            viewRef.value?.history.forward();
          }
        }
      }
    } else {
      // foliate-view 外层容器上的原生点击，与正文点击保持同一套规则
      if (!canFlipByClick(viewSettings)) return;
      const { clientX } = msg as MouseEvent;
      const width = window.innerWidth;
      if (clientX < width / 2) {
        viewRef.value?.goLeft();
      } else if (clientX > width / 2) {
        viewRef.value?.goRight();
      }
    }
  };

  return { handlePageFlip };
}
