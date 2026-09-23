export interface PresenterHandlers {
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  toggleFullscreen(): void;
  toggleDiagnostics(): void;
}

const POINTER_IDLE_MS = 2500;

/** Presenter keys. PageUp/PageDown are what presenter clickers send. */
export function bindPresenterInput(handlers: PresenterHandlers, signal: AbortSignal): void {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          handlers.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          handlers.previous();
          break;
        case 'Home':
          event.preventDefault();
          handlers.first();
          break;
        case 'End':
          event.preventDefault();
          handlers.last();
          break;
        case 'f':
          event.preventDefault();
          handlers.toggleFullscreen();
          break;
        case 'd':
          event.preventDefault();
          handlers.toggleDiagnostics();
          break;
        default:
          break;
      }
    },
    { signal },
  );
}

/** Minimum travel in px for a swipe. Shorter gestures count as taps. */
const SWIPE_MIN_PX = 40;

/**
 * Touch navigation for phones. A tap advances. Swipe left advances and swipe
 * right goes back.
 */
export function bindTouchNavigation(
  handlers: Pick<PresenterHandlers, 'next' | 'previous'>,
  signal: AbortSignal,
): void {
  let originX = 0;
  let originY = 0;
  let tracking = false;

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch') return;
      tracking = true;
      originX = event.clientX;
      originY = event.clientY;
    },
    { passive: true, signal },
  );

  window.addEventListener(
    'pointerup',
    (event) => {
      if (!tracking || event.pointerType !== 'touch') return;
      tracking = false;

      const dx = event.clientX - originX;
      const dy = event.clientY - originY;

      // Ignore mostly vertical drags, which are scroll attempts.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_MIN_PX) return;

      if (dx <= -SWIPE_MIN_PX) handlers.next();
      else if (dx >= SWIPE_MIN_PX) handlers.previous();
      else handlers.next();
    },
    { passive: true, signal },
  );
}

/** Hides the cursor after `POINTER_IDLE_MS` without pointer movement. */
export function bindPointerIdle(signal: AbortSignal): void {
  let timer = 0;

  const wake = (): void => {
    document.body.dataset['pointer'] = 'active';
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.body.dataset['pointer'] = 'idle';
    }, POINTER_IDLE_MS);
  };

  window.addEventListener('pointermove', wake, { passive: true, signal });
  window.addEventListener('pointerdown', wake, { passive: true, signal });
  wake();
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Ignore denial. Fullscreen is optional.
  }
}
