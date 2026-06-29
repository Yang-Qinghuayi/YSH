import Lenis from 'lenis';

/**
 * 初始化 Lenis 平滑滚动
 * @param getEl - 返回滚动容器 DOM 元素的 getter（支持 Ref 或 computed）
 */
export function useLenis(getEl: Ref<HTMLElement | null>) {
  let lenisInstance: Lenis | null = null;
  let rafId: number | null = null;

  function init(wrapper: HTMLElement) {
    // 销毁旧实例（路由切换时可能重新初始化）
    destroy();

    // Vuetify v-main 的内容区在 .v-main__wrap 内
    const content =
      wrapper.querySelector<HTMLElement>('.v-main__wrap') ??
      (wrapper.firstElementChild as HTMLElement);

    lenisInstance = new Lenis({
      wrapper,
      content,
      lerp: 0.1,           // 缓动强度：越小越"油"，0.1 是常见美味值
      smoothWheel: true,   // 鼠标滚轮平滑
      touchMultiplier: 1.5, // 触控灵敏度
      infinite: false,
    });

    function raf(time: number) {
      lenisInstance?.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);
  }

  function destroy() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lenisInstance?.destroy();
    lenisInstance = null;
  }

  // 当元素就绪时自动初始化，避免 mounted 时序问题
  watchEffect(() => {
    const el = getEl.value;
    if (el) {
      nextTick(() => init(el));
    }
  });

  onUnmounted(destroy);

  return {
    getLenis: () => lenisInstance,
  };
}
