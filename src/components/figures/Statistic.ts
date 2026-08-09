import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './statistic.css';

export type Accent = 'circular' | 'ai' | 'emphasis' | 'neutral';

export interface StatisticSpec {
  readonly value: number;
  readonly unit?: string;
  readonly decimals?: number;
  /** What the number is *of*. One line, sentence case, no full stop. */
  readonly label: string;
  readonly accent?: Accent;
}

export interface Statistic {
  readonly element: HTMLElement;
  /** `settle` writes the end state without animating — see `SceneInstance.beat`. */
  play(settle?: boolean): gsap.core.Timeline;
}

/** A single quantity, counted up, with its qualification underneath. */
export function createStatistic(spec: StatisticSpec): Statistic {
  const decimals = spec.decimals ?? 0;
  const format = (value: number): string => value.toFixed(decimals);

  const number = el('span', { className: 'stat-number', text: format(0) });
  const unit = spec.unit ? el('span', { className: 'stat-unit', text: spec.unit }) : null;

  const value = el('div', {
    className: 'stat-value',
    children: unit ? [number, unit] : [number],
  });
  const label = el('p', { className: 'stat-label', text: spec.label });

  const element = el('div', {
    className: 'stat',
    attrs: { 'data-accent': spec.accent ?? 'neutral' },
    children: [value, label],
  });

  return {
    element,
    play(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        number.textContent = format(spec.value);
        gsap.set(element, { opacity: 1, y: 0 });
        gsap.set(label, { opacity: 1, y: 0 });
        return timeline;
      }

      const counter = { value: 0 };

      timeline
        .from(element, {
          opacity: 0,
          y: 28,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
        })
        .to(
          counter,
          {
            value: spec.value,
            duration: seconds(DURATION.cinematic * 0.75),
            ease: 'power2.out',
            onUpdate: () => {
              number.textContent = format(counter.value);
            },
          },
          0,
        )
        .from(
          label,
          { opacity: 0, y: 12, duration: seconds(DURATION.normal), ease: EASE.enter },
          seconds(DURATION.quick),
        );

      return timeline;
    },
  };
}
