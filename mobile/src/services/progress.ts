/** Trailing save, serialized writes, and explicit flush for blur/background/unmount. */
export function createProgressWriter<T>(
  save: (value: T) => Promise<void>,
  onError: (e: unknown) => void,
  delay = 800
) {
  let latest: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (latest !== undefined) {
      const value = latest;
      latest = undefined;
      chain = chain
        .then(() => save(value))
        .catch((e) => {
          onError(e);
        });
    }
    return chain;
  }
  return {
    push(value: T) {
      latest = value;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void flush();
      }, delay);
    },
    flush,
  };
}
