export interface PresenterHandlers {
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  toggleFullscreen(): void;
  toggleDiagnostics(): void;
}

const POINTER_IDLE_MS = 2500;

/**
 * Presenter input.
 *
 * PageUp/PageDown are included because that is what physical presenter remotes
 * emit; without them the deck cannot be driven from a clicker.
 */
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

/** Below this a gesture is a tap; above it, a deliberate swipe. */
const SWIPE_MIN_PX = 40;

/**
 * Touch navigation.
 *
 * The deck is driven by a clicker in the hall, which emits key events; on a
 * phone there is no keyboard, so without this the first scene is the only one
 * reachable. A tap means the same thing the clicker does, and a swipe is added
 * because a deck being read rather than presented needs to go backwards.
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

      // A mostly-vertical drag was aimed at the page, not at the deck. Treating
      // it as a tap would advance the talk every time someone tried to scroll.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_MIN_PX) return;

      if (dx <= -SWIPE_MIN_PX) handlers.next();
      else if (dx >= SWIPE_MIN_PX) handlers.previous();
      else handlers.next();
    },
    { passive: true, signal },
  );
}

/** Hides the cursor while the presenter is talking rather than pointing. */
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
    // Fullscreen is a convenience; denial must never interrupt the talk.
  }
}
