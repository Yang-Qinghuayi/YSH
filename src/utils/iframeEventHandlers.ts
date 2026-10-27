import {
  DISABLE_DOUBLE_CLICK_ON_MOBILE,
  DOUBLE_CLICK_INTERVAL_THRESHOLD_MS,
  LONG_HOLD_THRESHOLD,
} from '@/services/constants';
import { useSettingStore } from '@/store/setting';
import { eventDispatcher } from '@/utils/event';
import { getOSPlatform } from '@/utils/misc';
import { findParagraphElement, getParagraphText } from '@/utils/paragraph';

const doubleClickEnabled =
  !DISABLE_DOUBLE_CLICK_ON_MOBILE || !['android', 'ios'].includes(getOSPlatform());

/** 按下与松开之间的位移超过该值视为拖拽/划词，不复制段落 */
const DRAG_THRESHOLD_PX = 10;

let lastClickTime = 0;
let longHoldTimeout: ReturnType<typeof setTimeout> | null = null;
let pointerDown: { x: number; y: number } | null = null;
let dragDetected = false;

/** 最近一次可复制点击命中的段落元素，用于复制成功后的短暂高亮 */
let lastClickedParagraph: HTMLElement | null = null;

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
  pointerDown = { x: event.clientX, y: event.clientY };
  dragDetected = false;

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
  if (
    pointerDown &&
    Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > DRAG_THRESHOLD_PX
  ) {
    // 拖拽（滚动页面或划词）之后的 click 不应触发复制
    dragDetected = true;
  }
  pointerDown = null;

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

/** 存在非空选区说明用户正在划词，此时不复制 */
const hasTextSelection = (target: EventTarget | null): boolean => {
  const doc = (target as Element | null)?.ownerDocument;
  const selection = doc?.getSelection?.();
  return !!selection && !selection.isCollapsed && !!selection.toString().trim();
};

export const handleClick = (bookKey: string, event: MouseEvent) => {
  const now = Date.now();

  if (doubleClickEnabled && now - lastClickTime < DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
    lastClickTime = now;
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
    return;
  }

  lastClickTime = now;

  const postSingleClick = () => {
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

    // 仅在「开关打开、非拖拽、无选区」时附带段落文本；父窗口据此判断是否复制。
    // 不附带文本时单击事件照常发出，翻页行为完全不受影响。
    // 开关关闭时跳过整段 DOM 遍历：读取 innerText 会触发布局，默认关闭时应零开销。
    const canCopy =
      useSettingStore().copyParagraphOnClick && !dragDetected && !hasTextSelection(event.target);
    lastClickedParagraph = canCopy ? findParagraphElement(event.target) : null;
    const paragraphText = getParagraphText(lastClickedParagraph);

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
        paragraphText,
      },
      '*'
    );
  };
  if (doubleClickEnabled) {
    setTimeout(() => {
      if (Date.now() - lastClickTime >= DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
        postSingleClick();
      }
    }, DOUBLE_CLICK_INTERVAL_THRESHOLD_MS);
  } else {
    postSingleClick();
  }
};

/**
 * 复制成功后短暂高亮被复制的段落。
 * 事件处理器运行在父 realm，但 event.target 来自 iframe realm；
 * 因为 iframe 是 allow-same-origin，父 realm 可以直接操作它的节点。
 */
export const flashLastClickedParagraph = () => {
  const element = lastClickedParagraph;
  if (!element) return;

  const flashColor = 'rgba(255, 193, 7, 0.55)';
  try {
    if (typeof element.animate === 'function') {
      element.animate(
        [{ backgroundColor: flashColor }, { backgroundColor: 'rgba(255, 193, 7, 0)' }],
        { duration: 900, easing: 'ease-out' }
      );
      return;
    }
  } catch {
    // 老版本 webview 不支持 WAAPI，走下面的内联样式兜底
  }

  try {
    element.style?.setProperty('background-color', flashColor, 'important');
    setTimeout(() => element.style?.removeProperty('background-color'), 800);
  } catch {
    // 忽略样式写入失败，复制本身已经成功
  }
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
