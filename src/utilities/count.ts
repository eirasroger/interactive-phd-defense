import gsap from 'gsap';

export interface CountFormat {
  readonly decimals?: number;
  /** Thin-space grouping. On for counts, off for percentages. */
  readonly grouped?: boolean;
  readonly suffix?: string;
}

const THIN = ' ';

export function formatCount(value: number, format: CountFormat = {}): string {
  const decimals = format.decimals ?? 0;
  const fixed = value.toFixed(decimals);
  const [whole = '', fraction] = fixed.split('.');
  const body = format.grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, THIN) : whole;
  return (fraction ? `${body}.${fraction}` : body) + (format.suffix ?? '');
}

/**
 * Tweens a number from 0 to `to` in `node`. Uses `formatCount`, the same
 * formatter as `settle`, so stepping back to a beat shows identical text.
 */
export function countUp(
  node: HTMLElement,
  to: number,
  duration: number,
  format: CountFormat = {},
  ease = 'power2.out',
): gsap.core.Tween {
  const counter = { value: 0 };
  node.textContent = formatCount(0, format);

  return gsap.to(counter, {
    value: to,
    duration,
    ease,
    overwrite: true,
    onUpdate: () => {
      node.textContent = formatCount(counter.value, format);
    },
  });
}
