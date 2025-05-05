import { onMounted, onUnmounted, toRefs, Ref } from 'vue';

import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';
import { isTauriAppPlatform } from '@/services/environment';
import { tauriGetWindowLogicalPosition } from '@/utils/window';
import type { FoliateView } from '@/types/view';
import { AppService } from '@/types/system';

export function usePageFlip(
  bookKey: string,
  viewRef: Ref<FoliateView | null>,
  containerRef: Ref<HTMLElement | null>,
  appService: Ref<AppService | null>,
) {
  const readerStore = useReaderStore();

  const handlePageFlip = async (
    msg: MessageEvent | CustomEvent | MouseEvent
  ) => {
    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookKey === bookKey) {
        const viewSettings = readerStore.getViewSettings(bookKey)!;
        if (msg.data.type === 'iframe-single-click') {
          const viewElement = containerRef.value;
          if (viewElement) {
            const { screenX } = msg.data;
            const viewRect = viewElement.getBoundingClientRect();
            let windowStartX = 0;

            if (isTauriAppPlatform()) {
              if (appService.value?.isMobile) {
                windowStartX = 0;
              } else {
                const windowPosition = await tauriGetWindowLogicalPosition() as { x: number, y: number };
                windowStartX = windowPosition.x;
              }
            } else {
              windowStartX = window.screenX;
            }

            const viewStartX = windowStartX + viewRect.left;
            const viewCenterX = viewStartX + viewRect.width / 2;

            const consumed = eventDispatcher.dispatchSync('iframe-single-click');
            if (!consumed) {
              const centerStartX = viewStartX + viewRect.width * 0.375;
              const centerEndX = viewStartX + viewRect.width * 0.625;

              if (
                viewSettings.disableClick ||
                (screenX >= centerStartX && screenX <= centerEndX)
              ) {
                readerStore.switchShowMenu()
              } else {
                if (readerStore.hoveredBookKey) {
                  readerStore.setHoveredBookKey(null);
                  return;
                }
                if (!viewSettings.disableClick && screenX >= viewCenterX) {
                  viewSettings.swapClickArea
                    ? viewRef.value?.goLeft()
                    : viewRef.value?.goRight();
                } else if (!viewSettings.disableClick && screenX < viewCenterX) {
                  viewSettings.swapClickArea
                    ? viewRef.value?.goRight()
                    : viewRef.value?.goLeft();
                }
              }
            }
          }
        } else if (msg.data.type === 'iframe-wheel' && !viewSettings.scrolled) {
          const { deltaY } = msg.data;
          deltaY > 0
            ? viewRef.value?.next(1)
            : viewRef.value?.prev(1);
        } else if (msg.data.type === 'iframe-mouseup') {
          if (msg.data.button === 3) {
            viewRef.value?.history.back();
          } else if (msg.data.button === 4) {
            viewRef.value?.history.forward();
          }
        }
      }
    } else {
      const { clientX } = msg as MouseEvent;
      const width = window.innerWidth;
      if (clientX < width / 2) {
        viewRef.value?.goLeft();
      } else if (clientX > width / 2) {
        viewRef.value?.goRight();
      }
    }
  };


  return {
    handlePageFlip,
  };
}
