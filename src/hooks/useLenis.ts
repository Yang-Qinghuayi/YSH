import Lenis from 'lenis';

/**
 * 初始化 Lenis 平滑滚动
 * @param getEl - 返回滚动容器 DOM 元素的 getter
 */
export function useLenis(getEl: Ref<HTMLElement | null>) {
  let lenisInstance: Lenis | null = null;
  let rafId: number | null = null;

  function init(wrapper: HTMLElement) {
    destroy();

    const content =
      wrapper.querySelector<HTMLElement>('.v-main__wrap') ??
      (wrapper.firstElementChild as HTMLElement);

    lenisInstance = new Lenis({
      wrapper,
      content,
      lerp: 0.1,
      smoothWheel: true,
      touchMultiplier: 1.5,
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

  watchEffect(() => {
    const el = getEl.value;
    if (el) {
      nextTick(() => init(el));
    }
  });

  onUnmounted(destroy);

  return {
    /** 在不需要平滑滚动的页面（如阅读页）暂停 Lenis，避免与内容滚动冲突 */
    pause: () => lenisInstance?.stop(),
    resume: () => lenisInstance?.start(),
  };
}
