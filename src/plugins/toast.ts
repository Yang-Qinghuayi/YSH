/**
 * 轻量 Toast 全局提示
 *
 * 取代 vue-toastification（2021 年后无新版本，且只为两处调用引入 15 KB CSS）。
 * 对外 API 保持 `toast.success/error/info`，UI 由 <ToastHost /> 用 v-snackbar 渲染，
 * 自动跟随 Material You 主题与深浅色。
 */
import type { App } from 'vue';
import { computed, reactive } from 'vue';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

const MAX_VISIBLE = 3;
const DEFAULT_TIMEOUT = 2400;

const state = reactive<{ items: ToastItem[] }>({ items: [] });
let seq = 0;

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const idx = state.items.findIndex((item) => item.id === id);
  if (idx >= 0) state.items.splice(idx, 1);
}

function push(kind: ToastKind, text: string, timeout = DEFAULT_TIMEOUT) {
  if (!text) return -1;
  const id = ++seq;
  state.items.push({ id, kind, text });
  // 超出上限时丢掉最早的
  while (state.items.length > MAX_VISIBLE) {
    dismiss(state.items[0]!.id);
  }
  timers.set(
    id,
    setTimeout(() => dismiss(id), timeout)
  );
  return id;
}

export const toast = {
  success: (text: string, timeout?: number) => push('success', text, timeout),
  error: (text: string, timeout?: number) => push('error', text, timeout),
  info: (text: string, timeout?: number) => push('info', text, timeout),
  dismiss,
};

/** ToastHost 用：当前可见队列（只读快照） */
export function useToastQueue() {
  return {
    items: computed(() => state.items.slice()),
    dismiss,
  };
}

/** 插件安装：保留 main.ts 里 `useToast(app)` 的调用形式 */
export function useToast(app: App) {
  app.config.globalProperties.$toast = toast;
  app.provide('toast', toast);
}

/** 当前是否有一条成功消息（供测试/宿主判断） */
export const toastCount = computed(() => state.items.length);
