import { el } from '@/utilities/dom';
import './system-overlays.css';

export interface LoadingScreen {
  readonly element: HTMLElement;
  set(loading: boolean, progress: number): void;
}

/**
 * Shown only when assets are genuinely missing. Neighbouring scenes are
 * prefetched, so during a normal talk this should never appear.
 */
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

/** Toggled with `d`. Present so performance can be checked on the day. */
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
 * Portrait guard.
 *
 * The stage is a fixed 16:9 surface scaled to fit, so a portrait handset scales
 * it by width — about 0.2 — and paints the whole talk into a 390x219 band with
 * body text under 5px. Landscape is the only orientation in which a phone can
 * show this deck at all, so ask for it rather than rendering something illegible
 * and calling it responsive.
 *
 * Visibility is left to CSS: it is a media query, and routing it through JS
 * would mean duplicating the query and keeping the two in step.
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

/**
 * A lost WebGL context would otherwise show a blank canvas with no
 * explanation. The browser usually restores it within a second or two.
 */
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
