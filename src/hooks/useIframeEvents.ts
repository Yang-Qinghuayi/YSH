import { FoliateView } from '@/types/view';
import { eventDispatcher } from '@/utils/event';
import { isTauriAppPlatform } from '@/services/environment';
import { tauriGetWindowLogicalPosition } from '@/utils/window';
import { AppService } from '@/types/system';

export const useClickEvent = (
  viewRef: Ref<FoliateView | null>,
  containerRef: Ref<HTMLDivElement | null>,
  appService: Ref<AppService | null>
) => {
  const handleTurnPage = async (
    msg: MessageEvent | MouseEvent
  ) => {
    if (msg instanceof MessageEvent) {
      if (msg.data.type === 'iframe-single-click') {
        const viewElement = containerRef.value;
        if (viewElement) {
          const { screenX } = msg.data;
          const viewRect = viewElement.getBoundingClientRect();
          let windowStartX;
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
            const centerStartX = viewStartX + viewRect.width * 0.375;
            const centerEndX = viewStartX + viewRect.width * 0.625;

            if (screenX >= viewCenterX) {
              viewRef.value?.goRight();
            } else if (screenX < viewCenterX) {
              viewRef.value?.goLeft();
            }
          }
        }
      } else if (msg.data.type === 'iframe-wheel') {
        // The wheel event is handled by the iframe itself in scrolled mode.
        const { deltaY } = msg.data;
        if (deltaY > 0) {
          viewRef.value?.next(1);
        } else if (deltaY < 0) {
          viewRef.value?.prev(1);
        }
      } else if (msg.data.type === 'iframe-mouseup') {
        if (msg.data.button === 3) {
          viewRef.value?.history.back();
        } else if (msg.data.button === 4) {
          viewRef.value?.history.forward();
        }
      }
    } else {
      const { clientX } = msg;
      const width = window.innerWidth;
      const leftThreshold = width * 0.5;
      const rightThreshold = width * 0.5;
      if (clientX < leftThreshold) {
        viewRef.value?.goLeft();
      } else if (clientX > rightThreshold) {
        viewRef.value?.goRight();
      }
    }
  };

  function addListener() {
    window.addEventListener('message', handleTurnPage);
  }

  function removeListener() {
    window.removeEventListener('message', handleTurnPage);
  }

  onMounted(() => {
    addListener();
  });

  onUnmounted(() => {
    removeListener();
  });

  watch([viewRef], () => {
    removeListener();
    addListener();
  });

  return {
    handleTurnPage,
  };
};

interface IframeTouch {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

interface IframeTouchEvent {
  targetTouches: IframeTouch[];
}

export const useTouchEvent = (
  viewRef: Ref<FoliateView | null>,
) => {

  let touchStart: IframeTouch | null = null;
  let touchEnd: IframeTouch | null = null;

  const onTouchStart = (e: IframeTouchEvent) => {
    touchEnd = null;
    const touch = e.targetTouches[0];
    if (!touch) return;
    touchStart = touch;
  };

  const onTouchMove = (e: IframeTouchEvent) => {
    if (!touchStart) return;
    const touch = e.targetTouches[0];
    if (touch) {
      touchEnd = touch;
    }
  };

  const onTouchEnd = (e: IframeTouchEvent) => {
    if (!touchStart) return;

    const touch = e.targetTouches[0];
    if (touch) {
      touchEnd = touch;
    }

    touchStart = null;
    touchEnd = null;
  };

  const handleTouch = (msg: MessageEvent) => {
    if (msg.data.type === 'iframe-touchstart') {
      onTouchStart(msg.data);
    } else if (msg.data.type === 'iframe-touchmove') {
      onTouchMove(msg.data);
    } else if (msg.data.type === 'iframe-touchend') {
      onTouchEnd(msg.data);
    }
  };

  function addListener() {
    window.addEventListener('message', handleTouch);
  }

  function removeListener() {
    window.removeEventListener('message', handleTouch);
  }

  onMounted(() => {
    addListener();
  });

  onUnmounted(() => {
    removeListener();
  });

  watch([viewRef], () => {
    removeListener();
    addListener();
  });
};
