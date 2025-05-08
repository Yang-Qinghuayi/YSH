import { loadShortcuts, ShortcutConfig } from '@/utils/shortcuts';

export type KeyActionHandlers = {
  [K in keyof ShortcutConfig]?: () => void;
};

// Vue 3 Composable
export default function useShortcuts(
  actions: Ref<KeyActionHandlers> | KeyActionHandlers, // 可以是 ref 或普通对象
  // Vue 中，依赖通常通过 watch unref(actions) 或直接 watch actions (如果它是 ref) 来处理
  // 为了更接近原始 hook 的 dependencies 参数，我们可以保留它，但其用法会略有不同
  // 或者，让调用者确保 actions 是响应式的，或在 actions 改变时重新调用 useShortcuts
  // dependencies: any[] = [] // 如果需要显式观察其他外部响应式依赖
) {
  const shortcuts = ref<ShortcutConfig>(loadShortcuts());

  const handleShortcutUpdate = () => {
    shortcuts.value = loadShortcuts();
  };

  onMounted(() => {
    window.addEventListener('shortcutUpdate', handleShortcutUpdate);
  });

  onUnmounted(() => {
    window.removeEventListener('shortcutUpdate', handleShortcutUpdate);
  });

  const parseShortcut = (shortcut: string) => {
    const keys = shortcut.toLowerCase().split('+');
    return {
      ctrlKey: keys.includes('ctrl'),
      altKey: keys.includes('alt') || keys.includes('opt'),
      metaKey: keys.includes('meta') || keys.includes('cmd'),
      shiftKey: keys.includes('shift'),
      key: keys.find((k) => !['ctrl', 'alt', 'opt', 'meta', 'cmd', 'shift'].includes(k)),
    };
  };

  const isShortcutMatch = (
    shortcut: string,
    key: string,
    ctrlKey: boolean,
    altKey: boolean,
    metaKey: boolean,
    shiftKey: boolean,
  ): boolean => {
    const parsedShortcut = parseShortcut(shortcut);
    return (
      parsedShortcut.key === key.toLowerCase() &&
      parsedShortcut.ctrlKey === ctrlKey &&
      parsedShortcut.altKey === altKey &&
      parsedShortcut.metaKey === metaKey &&
      parsedShortcut.shiftKey === shiftKey
    );
  };

  const processKeyEvent = (
    key: string,
    ctrlKey: boolean,
    altKey: boolean,
    metaKey: boolean,
    shiftKey: boolean,
  ): boolean => {
    // FIXME: This is a temporary fix to disable Back button navigation
    if (key === 'backspace') return true;

    const currentActions = unref(actions); // 获取 actions 的实际值 (如果是 ref)

    for (const [actionName, actionHandler] of Object.entries(currentActions)) {
      const shortcutKey = actionName as keyof ShortcutConfig;
      const handler = actionHandler as (() => void) | undefined;
      // 使用 shortcuts.value 来访问 ref 的当前值
      const shortcutList = shortcuts.value[shortcutKey as keyof ShortcutConfig];
      if (
        handler &&
        shortcutList?.some((shortcutStr) =>
          isShortcutMatch(shortcutStr, key, ctrlKey, altKey, metaKey, shiftKey),
        )
      ) {
        handler();
        return true;
      }
    }
    return false;
  };

  const unifiedHandleKeyDown = (event: KeyboardEvent | MessageEvent) => {
    const activeElement = document.activeElement as HTMLElement;
    const isInteractiveElement =
      activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

    const isNoteEditor =
      activeElement &&
      activeElement.tagName === 'TEXTAREA' &&
      activeElement.classList.contains('note-editor');

    if (isInteractiveElement && !isNoteEditor) {
      return;
    }

    if (event instanceof KeyboardEvent) {
      const { key, ctrlKey, altKey, metaKey, shiftKey } = event;

      if (isNoteEditor && !((key === 'Enter' && ctrlKey) || key === 'Escape')) {
        return;
      }

      const handled = processKeyEvent(key.toLowerCase(), ctrlKey, altKey, metaKey, shiftKey);
      if (handled) {
        event.preventDefault();
      }
    } else if (
      event instanceof MessageEvent &&
      event.data &&
      event.data.type === 'iframe-keydown'
    ) {
      const { key, ctrlKey, altKey, metaKey, shiftKey } = event.data;
      processKeyEvent(key.toLowerCase(), ctrlKey, altKey, metaKey, shiftKey);
      // 注意：对于 MessageEvent，我们不能直接 preventDefault，因为事件源在 iframe 内部。
      // iframe 内部的快捷键处理应该在 iframe 自身脚本中 preventDefault，然后通过 postMessage 通知父级。
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', unifiedHandleKeyDown);
    window.addEventListener('message', unifiedHandleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', unifiedHandleKeyDown);
    window.removeEventListener('message', unifiedHandleKeyDown);
  });

  // 在 Vue 中，由于 `shortcuts` 是一个 ref，`processKeyEvent` 函数
  // 在执行时总是会通过 `shortcuts.value` 读取到最新的快捷键配置。
  // 同样，如果 `actions` 作为 ref 传入，`unref(actions)` 也会获取到最新的动作。
  // 因此，不像 React 中那样，通常不需要因为 `shortcuts` 或 `actions` 的变化而显式地重新注册事件监听器。
  // 监听器内的函数会自然地使用最新的响应式数据。

  // 如果 `actions` 本身不是 ref，而是可能被替换的普通对象，
  // 并且你希望 composable 在 `actions` 引用改变时做出反应，
  // 组件通常会销毁并重新创建这个 composable 实例，或者你可以添加一个 `watch`：
  // watch(() => unref(actions), (newActions, oldActions) => {
  //   // 如果需要，可以在这里做些什么，但通常 processKeyEvent 内部的 unref(actions) 就够了
  // }, { deep: true }); // deep: true 如果 actions 是复杂对象且其内部属性会改变

  // 这个 Composable 主要用于设置全局监听器，通常不需要返回值给组件，
  // 但如果需要，可以返回 shortcuts ref
  // return { shortcuts };
}
