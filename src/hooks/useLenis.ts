import Lenis from 'lenis';

/**
 * 初始化 Lenis 平滑滚动
 * @param getEl - 返回滚动容器 DOM 元素的 getter
 */
export function useLenis(getEl: Ref<HTMLElement | null>) {
  let lenisInstance: Lenis | null = null;
  let rafId: number | null = null;
  // 在 lenisInstance 创建之前就可能被调用 pause()，用此标志记住状态
  let shouldBePaused = false;

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

    // 初始化完成后立即应用挂起的暂停状态（如路由守卫在 init 之前调用了 pause()）
    if (shouldBePaused) lenisInstance.stop();

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
    pause: () => { shouldBePaused = true; lenisInstance?.stop(); },
    resume: () => { shouldBePaused = false; lenisInstance?.start(); },
  };
}
