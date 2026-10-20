import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  INDICATOR_FAMILIES,
  INDICATORS,
  SALIENCE,
  SALIENCE_MAX,
  SALIENCE_REMAINING,
  SALIENCE_WEIGHTS,
  type Salience as Context,
} from '@/content/c5';
import { el } from '@/utilities/dom';
import './c5-palette.css';
import './family-palette.css';
import './salience.css';

export interface Salience {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** Bars sweep out fast and settle slowly, so the ranking reads as it lands. */
const SWEEP = { duration: 1.25, ease: 'expo.out', step: 0.08 } as const;

/** Each column starts this long after the previous one. */
const COLUMN_STEP = 0.16;

const extent = (weight: number): string => `${((weight / SALIENCE_MAX) * 100).toFixed(2)}%`;

interface Column {
  readonly element: HTMLElement;
  readonly names: HTMLElement[];
  readonly fills: HTMLElement[];
  readonly note: HTMLElement;
}

const columnFor = (context: Context): Column => {
  const names: HTMLElement[] = [];
  const fills: HTMLElement[] = [];

  const row = (rank: string, label: string, weight: number, family: string | null): HTMLElement => {
    const fill = el('span', { className: 'wt-fill', attrs: { style: `--extent: ${extent(weight)}` } });
    const name = el('div', {
      className: 'wt-name',
      children: [
        el('span', { className: 'wt-rank', text: rank }),
        el('span', { className: 'wt-label', text: label }),
      ],
    });
    names.push(name);
    fills.push(fill);

    return el('div', {
      className: 'wt-row',
      attrs: family ? { 'data-family': family } : { 'data-kind': 'remaining' },
      children: [name, el('span', { className: 'wt-track', children: [fill] })],
    });
  };

  const ranked = (SALIENCE_WEIGHTS[context.key] ?? []).map((entry, index) => {
    const indicator = INDICATORS[entry.key];
    return row(String(index + 1).padStart(2, '0'), indicator.label, entry.weight, indicator.family);
  });
  const remaining = row('', 'Remaining seven', SALIENCE_REMAINING[context.key] ?? 0, null);
  ranked[0]?.setAttribute('data-lead', 'true');

  const note = el('p', { className: 'wt-note', text: context.concentration });

  const element = el('section', {
    className: 'wt-column',
    children: [
      el('p', { className: 'wt-context', text: context.label }),
      el('div', { className: 'wt-rows', children: [...ranked, remaining] }),
      note,
    ],
  });

  return { element, names, fills, note };
};

/**
 * Feature importance by application (Fig. 10). Three columns on one shared
 * scale, each bar coloured by its indicator family, so the change in what
 * leads is visible before any label is read.
 */
export function createSalience(): Salience {
  const legend = INDICATOR_FAMILIES.map((family) =>
    el('span', {
      className: 'wt-key',
      attrs: { 'data-family': family.key },
      children: [el('span', { className: 'wt-swatch' }), el('span', { text: family.label })],
    }),
  );

  const columns = SALIENCE.map(columnFor);

  const element = el('div', {
    className: 'c5 wt',
    children: [
      el('div', {
        className: 'wt-head',
        children: [
          el('p', { className: 'c5-index', text: 'Mean absolute SHAP value, by application' }),
          el('div', { className: 'wt-legend', children: legend }),
        ],
      }),
      el('div', { className: 'wt-columns', children: columns.map((column) => column.element) }),
    ],
  });

  const head = element.querySelector('.wt-head') as HTMLElement;
  const fills = columns.flatMap((column) => column.fills);
  const names = columns.flatMap((column) => column.names);
  const notes = columns.map((column) => column.note);

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([head, ...legend, ...columns.map((column) => column.element), ...names, ...notes], {
      opacity: 1,
      x: 0,
      y: 0,
    });
    gsap.set(fills, { scaleX: 1 });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      if (settle) {
        settleTo();
        return null;
      }

      gsap.set(element, { opacity: 1 });
      const line = gsap
        .timeline()
        .from(head, { opacity: 0, y: 8, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
        .from(
          legend,
          {
            opacity: 0,
            y: 6,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.8),
          },
          seconds(DURATION.quick * 0.6),
        );

      columns.forEach((column, index) => {
        const at = DURATION.quick + index * COLUMN_STEP;
        line
          .from(
            column.element,
            { opacity: 0, y: 24, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(at),
          )
          .from(
            column.names,
            {
              opacity: 0,
              x: -10,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(SWEEP.step),
            },
            seconds(at + DURATION.quick),
          )
          .fromTo(
            column.fills,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(SWEEP.duration),
              ease: SWEEP.ease,
              stagger: seconds(SWEEP.step),
            },
            seconds(at + DURATION.quick * 1.4),
          )
          .from(
            column.note,
            { opacity: 0, y: 8, duration: seconds(DURATION.normal), ease: EASE.enter },
            seconds(at + DURATION.slow + SWEEP.step * column.fills.length),
          );
      });

      return line;
    },
  };
}
