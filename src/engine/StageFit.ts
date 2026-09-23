import { STAGE } from '@/config/presentation';

/**
 * Scales the fixed stage to fit the window, letterboxing the rest.
 *
 * `onChange` fires after the new scale is set. Use it to re-measure painted
 * sizes: the scale is a CSS transform, so `ResizeObserver` inside the stage
 * never fires.
 */
export function bindStageFit(onChange: (scale: number) => void, signal: AbortSignal): void {
  const root = document.documentElement;

  // Single source for the stage size; CSS reads these variables.
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

  /*
   * iOS updates the viewport size after `orientationchange` fires, so fit again
   * on the next frame. The early-out makes the extra call cheap.
   */
  const refit = (): void => {
    fit();
    requestAnimationFrame(fit);
  };

  window.addEventListener('resize', refit, { signal });
  window.addEventListener('orientationchange', refit, { signal });
  fit();
}
