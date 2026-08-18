import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { BLOCKERS, DECOUPLED } from '@/content/c2';
import { el, svg } from '@/utilities/dom';
import { formatCount } from '@/utilities/count';
import './c2-palette.css';
import './paradox.css';

const PLOT = { width: 420, height: 300, left: 30, right: 356, top: 26, bottom: 262 } as const;
const MAX = 50;

const y = (value: number): number => PLOT.bottom - (value / MAX) * (PLOT.bottom - PLOT.top);

const percent = (value: number): string => formatCount(value, { decimals: 1, suffix: '%' });

export interface Paradox {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * Circular origin against end-of-life recovery, one category at a time.
 *
 * A loop diagram was drawn here first and taken out. Circular origin is a mean
 * over the products that declare an origin and the end-of-life shares are means
 * over the products that declare a pathway, so a single flow between them
 * asserts arithmetic the tables cannot carry. A slope reads each axis against
 * itself, which is a comparison the data supports.
 */
export function createParadox(): Paradox {
  const axes = ['left', 'right'].map((side) =>
    svg('line', {
      class: 'pd-axis',
      x1: String(side === 'left' ? PLOT.left : PLOT.right),
      y1: String(PLOT.top - 12),
      x2: String(side === 'left' ? PLOT.left : PLOT.right),
      y2: String(PLOT.bottom + 12),
    }),
  );

  const lines = DECOUPLED.map((entry) =>
    svg('line', {
      class: 'pd-line',
      'data-key': entry.key,
      x1: String(PLOT.left),
      y1: String(y(entry.origin)),
      x2: String(PLOT.right),
      y2: String(y(entry.recycling)),
    }),
  );

  const dots = DECOUPLED.flatMap((entry) => [
    svg('circle', {
      class: 'pd-dot',
      'data-key': entry.key,
      cx: String(PLOT.left),
      cy: String(y(entry.origin)),
      r: '5',
    }),
    svg('circle', {
      class: 'pd-dot',
      'data-key': entry.key,
      cx: String(PLOT.right),
      cy: String(y(entry.recycling)),
      r: '5',
    }),
  ]);

  const canvas = svg('svg', {
    class: 'pd-canvas',
    viewBox: `0 0 ${PLOT.width} ${PLOT.height}`,
    'aria-hidden': 'true',
  });
  for (const part of [...axes, ...lines, ...dots]) canvas.appendChild(part);

  const label = (entry: (typeof DECOUPLED)[number], side: 'origin' | 'recycling'): HTMLElement => {
    const value = side === 'origin' ? entry.origin : entry.recycling;
    return el('div', {
      className: 'pd-label',
      attrs: {
        'data-side': side,
        'data-key': entry.key,
        style: `top: ${(y(value) / PLOT.height) * 100}%`,
      },
      children: [
        el('span', { className: 'pd-label-value', text: percent(value) }),
        ...(side === 'origin'
          ? [el('span', { className: 'pd-label-name', text: entry.label })]
          : []),
      ],
    });
  };

  const labels = DECOUPLED.flatMap((entry) => [label(entry, 'origin'), label(entry, 'recycling')]);

  const plot = el('div', { className: 'pd-plot', children: labels });
  plot.insertBefore(canvas, plot.firstChild);

  const heads = el('div', {
    className: 'pd-heads',
    children: [
      el('span', { className: 'pd-head', text: 'Circular origin' }),
      el('span', { className: 'pd-head', text: 'Recycled at end of life' }),
    ],
  });

  const chart = el('div', {
    className: 'pd-chart',
    children: [
      el('p', { className: 'pd-index', text: 'Mean share of the product, by category' }),
      heads,
      plot,
    ],
  });

  const blockerNodes = BLOCKERS.map((blocker) =>
    el('div', {
      className: 'pd-blocker',
      children: [
        el('p', { className: 'pd-blocker-label', text: blocker.label }),
        el('p', { className: 'pd-blocker-body', text: blocker.body }),
      ],
    }),
  );

  const why = el('div', {
    className: 'pd-why',
    children: [
      el('p', {
        className: 'pd-index',
        text: 'Why circular input does not carry through to recovery',
      }),
      ...blockerNodes,
    ],
  });

  const element = el('div', { className: 'pd', children: [chart, why] });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(chart.children, { opacity: 1, y: 0 });
    gsap.set(why.children, { opacity: 1, y: 0 });
    gsap.set([...axes, ...lines, ...dots], { opacity: 1 });
    for (const stroke of lines) {
      stroke.style.strokeDasharray = 'none';
      stroke.style.strokeDashoffset = '0';
    }
    gsap.set(labels, { opacity: 1, x: 0 });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      settleTo();
      if (settle) return null;

      const line = gsap.timeline();

      line
        .from(element, { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
        .from(
          chart.children,
          {
            opacity: 0,
            y: 18,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.6),
          },
          0,
        )
        .from(
          axes,
          { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
          seconds(DURATION.quick),
        );

      // Each line drawn from its origin end, so the fall is watched happening.
      // Insulation is first because it is the one the argument turns on.
      for (const [index, stroke] of lines.entries()) {
        const at = seconds(DURATION.normal + STAGGER * 3.5 * index);
        const length = Math.hypot(
          PLOT.right - PLOT.left,
          Number(stroke.getAttribute('y2')) - Number(stroke.getAttribute('y1')),
        );

        line
          .fromTo(
            stroke,
            { strokeDasharray: length, strokeDashoffset: length },
            {
              strokeDashoffset: 0,
              duration: seconds(DURATION.cinematic * 0.6),
              ease: EASE.standard,
              overwrite: true,
            },
            at,
          )
          .from(
            [dots[index * 2], dots[index * 2 + 1]] as Element[],
            {
              opacity: 0,
              duration: seconds(DURATION.quick),
              ease: EASE.enter,
              stagger: seconds(DURATION.cinematic * 0.5),
            },
            at,
          )
          .from(
            [labels[index * 2], labels[index * 2 + 1]] as HTMLElement[],
            {
              opacity: 0,
              x: (position: number) => (position === 0 ? 12 : -12),
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(DURATION.cinematic * 0.5),
            },
            at,
          );
      }

      // The explanation arrives after the divergence it explains.
      line.from(
        why.children,
        {
          opacity: 0,
          y: 20,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 2.5),
        },
        seconds(DURATION.cinematic * 0.9),
      );

      return line;
    },
  };
}
