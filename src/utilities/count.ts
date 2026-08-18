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
 * A quantity arriving at its value.
 *
 * Counting is the only way a number reads as *measured* rather than typeset,
 * and it is why every readout in the deck writes through here: one formatter
 * for the tween and for `settle`, so a beat reached backwards shows the same
 * string to the character.
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
