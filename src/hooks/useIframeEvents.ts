import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue';
import { useReaderStore } from '@/store/readerStore';
import type { FoliateView } from '@/types/view';
import { useBookIdStore } from '@/store/bookIdStore';
import { storeToRefs } from 'pinia';

interface IframeTouch {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

interface IframeTouchEvent {
  targetTouches: IframeTouch[];
}

export function useClickEvent(
  handlePageFlip: (msg: MessageEvent) => void
) {
  const { bookId } = storeToRefs(useBookIdStore())
  const bindEvent = () => {
    window.addEventListener('message', handlePageFlip);
  };

  const unbindEvent = () => {
    window.removeEventListener('message', handlePageFlip);
  };

  onMounted(bindEvent);
  onBeforeUnmount(unbindEvent);

  watch(
    bookId,
    () => {
      unbindEvent();
      bindEvent();
    }
  );
}

// === useTouchEvent: 监听 touch 消息 ===
export function useTouchEvent(
  viewRef: Ref<FoliateView | null>
) {
  const { bookId } = storeToRefs(useBookIdStore())
  const store = useReaderStore();
  const { hoveredBookKey, setHoveredBookKey, getViewSettings } = store;
  const viewSettings = getViewSettings(bookId.value)!;

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
    if (touch) touchEnd = touch;

    if (hoveredBookKey && touchEnd) {
      const deltaY = touchEnd.screenY - touchStart.screenY;
      const deltaX = touchEnd.screenX - touchStart.screenX;

      if (!viewSettings.scrolled && !viewSettings.vertical) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
          setHoveredBookKey(null);
        }
      } else {
        setHoveredBookKey(null);
      }
    }
  };


  const handleTouch = (msg: MessageEvent) => {
    if (msg.data && msg.data.bookKey === bookId.value) {
      if (msg.data.type === 'iframe-touchstart') onTouchStart(msg.data);
      else if (msg.data.type === 'iframe-touchmove') onTouchMove(msg.data);
      // else if (msg.data.type === 'iframe-touchend') onTouchEnd(msg.data);
    }
  };

  const bindTouch = () => {
    window.addEventListener('message', handleTouch);
  };

  const unbindTouch = () => {
    window.removeEventListener('message', handleTouch);
  };

  onMounted(bindTouch);
  onBeforeUnmount(unbindTouch);

  watch(
    () => [viewRef],
    () => {
      unbindTouch();
      bindTouch();
    }
  );
}
