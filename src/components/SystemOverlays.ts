import { el } from '@/utilities/dom';
import './system-overlays.css';

export interface LoadingScreen {
  readonly element: HTMLElement;
  set(loading: boolean, progress: number): void;
}

/** Shown only when assets are still loading. Neighbouring scenes are prefetched, so it is rare. */
export function createLoadingScreen(): LoadingScreen {
  const bar = el('span', { className: 'loading-fill' });
  const track = el('div', { className: 'loading-track', children: [bar] });
  const label = el('p', { className: 'loading-label', text: 'Preparing scene' });

  const element = el('div', {
    className: 'loading-screen',
    attrs: { role: 'status', 'aria-live': 'polite', hidden: '' },
    children: [label, track],
  });

  return {
    element,
    set(loading, progress) {
      element.toggleAttribute('hidden', !loading);
      element.classList.toggle('is-visible', loading);
      bar.style.transform = `scaleX(${Math.max(0, Math.min(progress, 1))})`;
    },
  };
}

export interface DiagnosticsOverlay {
  readonly element: HTMLElement;
  set(fps: number, visible: boolean): void;
}

/** FPS readout, toggled with `d`. */
export function createDiagnosticsOverlay(): DiagnosticsOverlay {
  const element = el('div', { className: 'diagnostics', attrs: { hidden: '' } });

  return {
    element,
    set(fps, visible) {
      element.toggleAttribute('hidden', !visible);
      if (visible) element.textContent = `${fps.toFixed(0)} fps`;
    },
  };
}

/**
 * Asks portrait phones to rotate. The fixed 16:9 stage is unreadable in
 * portrait. Visibility is handled by a CSS media query.
 */
export function createOrientationNotice(): HTMLElement {
  return el('div', {
    className: 'orientation-notice',
    attrs: { role: 'status' },
    text: 'Rotate your device to view this presentation.',
  });
}

export interface ContextNotice {
  readonly element: HTMLElement;
  set(lost: boolean): void;
}

/** Shown while the WebGL context is lost. The browser usually restores it within seconds. */
export function createContextNotice(): ContextNotice {
  const element = el('div', {
    className: 'context-notice',
    attrs: { role: 'alert', hidden: '' },
    text: 'Restoring graphics…',
  });

  return {
    element,
    set(lost) {
      element.toggleAttribute('hidden', !lost);
    },
  };
}
