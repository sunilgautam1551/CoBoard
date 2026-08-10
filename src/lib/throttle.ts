/**
 * Trailing-edge throttle: calls `fn` at most once per `intervalMs`,
 * always flushing the most recent args once the window elapses.
 */
export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  function invoke() {
    lastCall = Date.now();
    timeout = null;
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  }

  function throttled(...args: Args) {
    lastArgs = args;
    const remaining = intervalMs - (Date.now() - lastCall);
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke();
    } else if (!timeout) {
      timeout = setTimeout(invoke, remaining);
    }
  }

  throttled.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    lastArgs = null;
  };

  return throttled;
}
