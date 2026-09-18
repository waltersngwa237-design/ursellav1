/**
 * Fast offline utilities providing instant (sub-millisecond) local caching,
 * fast-fail network racing, and reliable offline-first execution.
 */

export function isDeviceOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Execute a network operation with an immediate offline shortcut and a fast-fail race timeout.
 * - If offline: executes fallbackFn immediately (0ms latency).
 * - If online: races network operation against timeoutMs (default: 2500ms). If the network is slow or hangs,
 *   it seamlessly returns the local fallback without blocking the UI.
 */
export async function fastRaceWithFallback<T>(
  networkFn: () => Promise<T>,
  fallbackFn: () => T | Promise<T>,
  timeoutMs = 2500
): Promise<T> {
  if (!isDeviceOnline()) {
    return await fallbackFn();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Network timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([networkFn(), timeoutPromise]);
    if (timer) clearTimeout(timer);
    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    return await fallbackFn();
  }
}
