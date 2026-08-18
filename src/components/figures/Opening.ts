import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CORPUS, DEMANDS, INTERIM, TIMELINE } from '@/content/c2';
import { el } from '@/utilities/dom';
import { countUp, formatCount } from '@/utilities/count';
import './c2-palette.css';
import './opening.css';

const SPAN = { from: 2018, to: 2031 } as const;

const at = (year: number): number => ((year - SPAN.from) / (SPAN.to - SPAN.from)) * 100;

export interface Opening {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * Why the contribution exists.
 *
 * The objective is decision support for product selection, and the decision has
 * to be made now. Digital product passports would supply structured data
 * directly; construction products are last in that queue. What exists in the
 * meantime is a published, verified body of declarations in a format nothing
 * can read at scale.
 */
export function createOpening(): Opening {
  const marks = TIMELINE.map((entry) =>
    el('div', {
      className: 'op-mark',
      attrs: {
        'data-inside': String(entry.year >= INTERIM.from),
        style: `left: ${at(entry.year)}%`,
      },
      children: [
        el('span', { className: 'op-mark-stem' }),
        el('span', { className: 'op-mark-year', text: String(entry.year) }),
        el('span', { className: 'op-mark-label', text: entry.label }),
        el('span', { className: 'op-mark-note', text: entry.note }),
      ],
    }),
  );

  const band = el('span', {
    className: 'op-band',
    attrs: {
      style: `left: ${at(INTERIM.from)}%; width: ${at(INTERIM.to) - at(INTERIM.from)}%`,
    },
  });

  const bandLabel = el('span', {
    className: 'op-band-label',
    attrs: {
      style: `left: ${at(INTERIM.from)}%; width: ${at(INTERIM.to) - at(INTERIM.from)}%`,
    },
    text: 'Interim period',
  });

  const axis = el('div', {
    className: 'op-axis',
    children: [el('span', { className: 'op-rail' }), band, bandLabel, ...marks],
  });

  const timeline = el('div', {
    className: 'op-timeline',
    children: [
      el('p', {
        className: 'op-index',
        text: 'When structured product data becomes available',
      }),
      axis,
    ],
  });

  const demandChips = DEMANDS.map((demand) =>
    el('span', { className: 'op-chip', text: demand }),
  );

  const demand = el('div', {
    className: 'op-card',
    attrs: { 'data-tone': 'demand' },
    children: [
      el('p', { className: 'op-card-index', text: 'Data required for product selection' }),
      el('p', {
        className: 'op-card-lede',
        text: 'The evaluation framework requires the same indicators of every candidate under consideration.',
      }),
      el('div', { className: 'op-chips', children: demandChips }),
    ],
  });

  const supply = el('span', { className: 'op-figure', text: '0' });

  const resource = el('div', {
    className: 'op-card',
    attrs: { 'data-tone': 'resource' },
    children: [
      el('p', { className: 'op-card-index', text: 'Available today' }),
      el('div', {
        className: 'op-supply',
        children: [
          supply,
          el('p', {
            className: 'op-supply-label',
            text: 'Type III Environmental Product Declarations, third-party verified and publicly available, alongside Declarations of Performance for technical characteristics.',
          }),
        ],
      }),
      el('p', { className: 'op-source', text: CORPUS.source }),
    ],
  });

  const blocker = el('div', {
    className: 'op-card',
    attrs: { 'data-tone': 'blocker' },
    children: [
      el('p', { className: 'op-card-index', text: 'Limitation' }),
      el('p', {
        className: 'op-card-lede',
        text: 'Each declaration is a PDF written for human reading. Indicators sit in tables, footnotes and narrative text, with terminology and notation varying between manufacturers.',
      }),
    ],
  });

  const cards = el('div', { className: 'op-cards', children: [demand, resource, blocker] });
  const element = el('div', { className: 'op', children: [timeline, cards] });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([timeline, ...marks, band, bandLabel], { opacity: 1, y: 0 });
    gsap.set([demand, resource, blocker], { opacity: 1, y: 0 });
    gsap.set(demandChips, { opacity: 1, y: 0 });
    supply.textContent = formatCount(CORPUS.products, { grouped: true });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      settleTo();
      if (settle) return null;

      const line = gsap.timeline();

      // The dates first and the interim after them, because the shaded span
      // means nothing until the two years bounding it are on screen.
      line
        .from(element, { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
        .from(
          axis.querySelector('.op-rail'),
          {
            scaleX: 0,
            duration: seconds(DURATION.cinematic * 0.7),
            ease: EASE.standard,
            transformOrigin: 'left center',
          },
          0,
        )
        .from(
          marks,
          {
            opacity: 0,
            y: 14,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 2.2),
          },
          seconds(DURATION.quick),
        )
        .from(
          [band, bandLabel],
          {
            opacity: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
          },
          seconds(DURATION.cinematic * 0.75),
        )
        .from(
          [demand, resource, blocker],
          {
            opacity: 0,
            y: 26,
            duration: seconds(DURATION.cinematic * 0.7),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 3),
          },
          seconds(DURATION.cinematic * 0.6),
        )
        .from(
          demandChips,
          {
            opacity: 0,
            y: 8,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.8),
          },
          seconds(DURATION.cinematic * 0.8),
        )
        .add(
          countUp(supply, CORPUS.products, seconds(DURATION.cinematic * 0.8), { grouped: true }),
          seconds(DURATION.cinematic * 0.9),
        );

      return line;
    },
  };
}
