/**
 * Comprehensive zoom prevention utility for Ursella OS
 * Disables pinch-to-zoom, gesture zoom, double-tap zoom, wheel zoom, and zoom hotkeys.
 */
export function initZoomPrevention(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Prevent Safari iOS gesture pinch zoom
  const preventGesture = (e: Event) => {
    e.preventDefault();
  };
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  // 2. Prevent multi-touch pinch zoom
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // 3. Prevent rapid double-tap zoom on non-input elements
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        const isInteractiveInput = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        );
        if (!isInteractiveInput) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // 4. Prevent Ctrl/Cmd + Wheel zoom on desktop
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // 5. Prevent keyboard zoom shortcuts (Ctrl/Cmd + Plus, Minus, Equal, 0)
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '0' || e.keyCode === 187 || e.keyCode === 189)
      ) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}
