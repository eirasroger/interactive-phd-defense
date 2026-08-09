import { STAGE } from '@/config/presentation';

/**
 * Scales the fixed stage to fit the window, letterboxing the remainder.
 *
 * `onChange` fires after the new scale is written, and must be used to
 * re-measure anything that reads painted size: a CSS transform changes what a
 * box looks like without changing its layout box, so `ResizeObserver` on
 * anything inside the stage never fires.
 */
export function bindStageFit(onChange: (scale: number) => void, signal: AbortSignal): void {
  const root = document.documentElement;

  // The surface is defined once, here, rather than restated in CSS.
  root.style.setProperty('--stage-w', `${STAGE.width}px`);
  root.style.setProperty('--stage-h', `${STAGE.height}px`);

  let applied = 0;

  const fit = (): void => {
    const scale = Math.min(
      window.innerWidth / STAGE.width,
      window.innerHeight / STAGE.height,
    );
    if (Math.abs(scale - applied) < 0.0005) return;

    applied = scale;
    root.style.setProperty('--stage-scale', String(scale));
    onChange(scale);
  };

  window.addEventListener('resize', fit, { signal });
  window.addEventListener('orientationchange', fit, { signal });
  fit();
}
