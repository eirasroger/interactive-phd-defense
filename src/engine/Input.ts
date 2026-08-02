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
