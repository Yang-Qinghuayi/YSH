import {
  DISABLE_DOUBLE_CLICK_ON_MOBILE,
  DOUBLE_CLICK_INTERVAL_THRESHOLD_MS,
  LONG_HOLD_THRESHOLD,
} from '@/services/constants';
import { useSettingStore } from '@/store/setting';
import { eventDispatcher } from '@/utils/event';
import { getOSPlatform } from '@/utils/misc';

const doubleClickEnabled =
  !DISABLE_DOUBLE_CLICK_ON_MOBILE || !['android', 'ios'].includes(getOSPlatform());

/** 连续点击判定：位置偏移超过该值视为新的一次点击序列 */
const CLICK_POSITION_TOLERANCE_PX = 24;
/** 触发复制所需的连续点击次数 */
export const TRIPLE_CLICK_COUNT = 3;

let lastClickTime = 0;
let clickCount = 0;
let clickX = 0;
let clickY = 0;
let singleClickTimer: ReturnType<typeof setTimeout> | null = null;
let longHoldTimeout: ReturnType<typeof setTimeout> | null = null;

export const handleKeydown = (bookKey: string, event: KeyboardEvent) => {
  if (['Backspace', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
  }
  window.postMessage(
    {
      type: 'iframe-keydown',
      bookKey,
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    },
    '*'
  );
};

export const handleMousedown = (bookKey: string, event: MouseEvent) => {
  // 清掉上一次的长按计时器，避免残留定时器把当前这次的句柄置空
  // （否则快速连续点击时单击事件会被误判为长按而丢失）
  if (longHoldTimeout) clearTimeout(longHoldTimeout);
  longHoldTimeout = setTimeout(() => {
    longHoldTimeout = null;
  }, LONG_HOLD_THRESHOLD);

  window.postMessage(
    {
      type: 'iframe-mousedown',
      bookKey,
      button: event.button,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    },
    '*'
  );
};

export const handleMouseup = (bookKey: string, event: MouseEvent) => {
  // we will handle mouse back and forward buttons ourselves
  if ([3, 4].includes(event.button)) {
    event.preventDefault();
  }
  window.postMessage(
    {
      type: 'iframe-mouseup',
      bookKey,
      button: event.button,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    },
    '*'
  );
};

export const handleWheel = (bookKey: string, event: WheelEvent) => {
  window.postMessage(
    {
      type: 'iframe-wheel',
      bookKey,
      deltaMode: event.deltaMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    },
    '*'
  );
};

/**
 * 三击时浏览器已经把整段文字选中，直接复制选区文本即可：
 * 选中多少就复制多少，不从 DOM 里猜「哪一段」，也不做截断。
 *
 * 点击处理器运行在父 realm，但 event.target.ownerDocument 是 iframe 的文档；
 * iframe 是 allow-same-origin，因此 getSelection() 可以直接读取。
 * 延迟一个 tick 读取，兼容在 click 之后才完成选段的浏览器。
 * 选区为空（点在图片 / 空白上）时什么都不复制。
 * 开关关闭时也什么都不做，只保留浏览器原生的选段行为。
 */
const postTripleClick = (bookKey: string, event: MouseEvent) => {
  if (!useSettingStore().copyParagraphOnClick) return;

  setTimeout(() => {
    const doc = (event.target as Element | null)?.ownerDocument;
    const text = doc?.getSelection?.()?.toString().trim() ?? '';
    if (!text) return;
    window.postMessage({ type: 'iframe-triple-click', bookKey, text }, '*');
  }, 0);
};

const postSingleClick = (bookKey: string, event: MouseEvent) => {
  let element: HTMLElement | null = event.target as HTMLElement;
  while (element) {
    if (['sup', 'a', 'audio', 'video'].includes(element.tagName.toLowerCase())) {
      return;
    }
    if (element.classList.contains('js_readerFooterNote')) {
      eventDispatcher.dispatch('footnote-popup', {
        bookKey,
        element,
        footnote: element.getAttribute('data-wr-footernote') || '',
      });
      return;
    }
    element = element.parentElement;
  }

  // if long hold is detected, we don't want to send single click event
  if (!longHoldTimeout) {
    return;
  }

  window.postMessage(
    {
      type: 'iframe-single-click',
      bookKey,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    },
    '*'
  );
};

/**
 * 点击序列状态机。
 *
 * event.detail 由浏览器维护（1/2/3），部分移动 webview 的合成 click 不带
 * detail，所以用本地点击计数兜底。三击序列里的每一次点击都不会发出单击事件，
 * 因此不会误触发左右翻页。
 */
export const handleClick = (bookKey: string, event: MouseEvent) => {
  const now = Date.now();
  const nearLastClick =
    now - lastClickTime < DOUBLE_CLICK_INTERVAL_THRESHOLD_MS &&
    Math.hypot(event.clientX - clickX, event.clientY - clickY) < CLICK_POSITION_TOLERANCE_PX;
  clickCount = nearLastClick ? clickCount + 1 : 1;
  const count = Math.max(event.detail || 1, clickCount);

  lastClickTime = now;
  clickX = event.clientX;
  clickY = event.clientY;

  if (singleClickTimer) {
    clearTimeout(singleClickTimer);
    singleClickTimer = null;
  }

  if (count >= TRIPLE_CLICK_COUNT) {
    clickCount = 0;
    postTripleClick(bookKey, event);
    return;
  }

  if (count >= 2) {
    if (doubleClickEnabled) {
      window.postMessage(
        {
          type: 'iframe-double-click',
          bookKey,
          screenX: event.screenX,
          screenY: event.screenY,
          clientX: event.clientX,
          clientY: event.clientY,
          offsetX: event.offsetX,
          offsetY: event.offsetY,
        },
        '*'
      );
    }
    return;
  }

  // 单击延迟发送：确认没有后续点击后再翻页，这样三击序列也不会误翻页。
  singleClickTimer = setTimeout(() => {
    singleClickTimer = null;
    if (Date.now() - lastClickTime < DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) return;
    postSingleClick(bookKey, event);
  }, DOUBLE_CLICK_INTERVAL_THRESHOLD_MS);
};

const handleTouchEv = (bookKey: string, event: TouchEvent, type: string) => {
  const touch = event.targetTouches[0];
  const touches = [];
  if (touch) {
    touches.push({
      clientX: touch.clientX,
      clientY: touch.clientY,
      screenX: touch.screenX,
      screenY: touch.screenY,
    });
  }
  window.postMessage(
    {
      type: type,
      bookKey,
      targetTouches: touches,
    },
    '*'
  );
};

export const handleTouchStart = (bookKey: string, event: TouchEvent) => {
  handleTouchEv(bookKey, event, 'iframe-touchstart');
};

export const handleTouchMove = (bookKey: string, event: TouchEvent) => {
  handleTouchEv(bookKey, event, 'iframe-touchmove');
};

export const handleTouchEnd = (bookKey: string, event: TouchEvent) => {
  handleTouchEv(bookKey, event, 'iframe-touchend');
};
