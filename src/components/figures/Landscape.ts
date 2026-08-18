import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  BEYOND_RECYCLING,
  CORPUS,
  ORIGIN,
  PATHWAYS,
  RECOVERED,
  type Pathway,
} from '@/content/c2';
import { el } from '@/utilities/dom';
import { formatCount } from '@/utilities/count';
import './c2-palette.css';
import './landscape.css';

const MOVE = { open: DURATION.cinematic * 0.8, apart: STAGGER * 1.1 } as const;

interface Row {
  readonly pathway: Pathway;
  readonly element: HTMLElement;
  readonly mean: HTMLElement;
  readonly reach: HTMLElement | null;
}

export interface Landscape {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const buildRow = (pathway: Pathway): Row => {
  const mean = el('span', { className: 'ls-mean', attrs: { style: `width: ${pathway.mean}%` } });
  const median = el('span', {
    className: 'ls-median',
    attrs: { style: `left: ${pathway.median}%` },
  });
  const reach =
    pathway.max > pathway.mean
      ? el('span', {
          className: 'ls-reach',
          attrs: { style: `left: ${pathway.mean}%; width: ${pathway.max - pathway.mean}%` },
        })
      : null;

  const element = el('div', {
    className: 'ls-row',
    attrs: {
      'data-worth': pathway.worth,
      'data-beyond': String(pathway.beyondRecycling ?? false),
      'data-key': pathway.key,
    },
    children: [
      el('span', { className: 'ls-label', text: pathway.label }),
      el('div', {
        className: 'ls-track',
        children: [el('span', { className: 'ls-rail' }), ...(reach ? [reach] : []), mean, median],
      }),
      el('span', {
        className: 'ls-figure',
        text: formatCount(pathway.mean, { decimals: 1, suffix: '%' }),
      }),
      el('span', { className: 'ls-count', text: formatCount(pathway.n, { grouped: true }) }),
    ],
  });

  return { pathway, element, mean, reach };
};

/**
 * Circular origin and declared end-of-life pathways across the corpus.
 *
 * Ten tracks on one scale. Bars are means, hard ticks are medians, and the
 * hairline past each bar is the range the declared values reach. Recycling is
 * counted as recovery: the material does get a second use.
 */
export function createLandscape(): Landscape {
  const originRow = buildRow(ORIGIN);
  const pathwayRows = PATHWAYS.map(buildRow);

  const head = (text: string, note: string): HTMLElement =>
    el('div', {
      className: 'ls-head',
      children: [
        el('span', { className: 'ls-head-label', text }),
        el('span', { className: 'ls-head-note', text: note }),
      ],
    });

  const originHead = head(
    'Origin',
    `Share of the product from already-cycled sources. Declared by ${formatCount(ORIGIN.n, { grouped: true })} of ${formatCount(CORPUS.products, { grouped: true })} products`,
  );
  const futureHead = head(
    'Future use',
    'Declared end-of-life pathways, as a share of the product. A product may declare more than one',
  );

  /** The scale, laid out on the row grid so its rail is the rows' rail. */
  const axis = el('div', {
    className: 'ls-axis',
    children: [
      el('span'),
      el('div', {
        className: 'ls-axis-scale',
        children: [0, 25, 50, 75, 100].map((mark) =>
          el('span', {
            className: 'ls-axis-tick',
            attrs: { style: `left: ${mark}%` },
            text: `${mark}%`,
          }),
        ),
      }),
    ],
  });

  const reading = (value: string, label: string, tone: string): HTMLElement =>
    el('div', {
      className: 'ls-reading',
      attrs: { 'data-tone': tone },
      children: [
        el('span', { className: 'ls-reading-value', text: value }),
        el('span', { className: 'ls-reading-label', text: label }),
      ],
    });

  const verdict = el('div', {
    className: 'ls-verdict',
    children: [
      reading(
        formatCount(RECOVERED, { decimals: 1, suffix: '%' }),
        'recovered: recycling, valorisation, reuse, reconditioning and composting combined',
        'recovery',
      ),
      reading(
        formatCount(BEYOND_RECYCLING, { decimals: 1, suffix: '%' }),
        'recovered by pathways other than recycling',
        'beyond',
      ),
    ],
  });

  const rows = el('div', {
    className: 'ls-rows',
    children: [
      originHead,
      originRow.element,
      axis,
      futureHead,
      ...pathwayRows.map((row) => row.element),
      verdict,
    ],
  });

  const element = el('div', { className: 'ls', children: [rows] });
  const bars = [originRow, ...pathwayRows];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([originHead, futureHead, axis, verdict], { opacity: 1, y: 0 });
    for (const row of bars) {
      gsap.set(row.element, { opacity: 1, y: 0 });
      row.mean.style.width = `${row.pathway.mean}%`;
      if (row.reach) gsap.set(row.reach, { scaleX: 1 });
    }
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
          [originHead, futureHead, axis],
          {
            opacity: 0,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER),
          },
          0,
        );

      // Origin first, then the nine in the order the corpus ranks them, so the
      // eye reaches landfill early and arrives at the four minor pathways last,
      // by which point they are hairlines against everything already drawn.
      for (const [index, row] of bars.entries()) {
        const at = seconds(DURATION.quick + MOVE.apart * index);

        line
          .fromTo(
            row.element,
            { opacity: 0, y: 14 },
            {
              opacity: 1,
              y: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              overwrite: true,
            },
            at,
          )
          .fromTo(
            row.mean,
            { width: '0%' },
            {
              width: `${row.pathway.mean}%`,
              duration: seconds(MOVE.open),
              ease: 'power2.out',
              overwrite: true,
            },
            at,
          );

        if (row.reach) {
          line.fromTo(
            row.reach,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              transformOrigin: 'left center',
              overwrite: true,
            },
            at + seconds(DURATION.quick),
          );
        }
      }

      line.from(
        verdict.children,
        {
          opacity: 0,
          y: 16,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 3),
        },
        '>-0.5',
      );

      return line;
    },
  };
}
