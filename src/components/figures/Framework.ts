import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { FAMILIES, METRICS } from '@/content/c1';
import { el } from '@/utilities/dom';
import { offsetBetween, stageScale } from '@/utilities/flip';
import './family-palette.css';
import './framework.css';

const SOURCES = [
  'Environmental Product Declaration',
  'Declaration of Performance',
  'Manufacturer technical sheet',
  'Material passport',
  'BIM model',
  'Bill of quantities',
];

const LEDE: Readonly<Record<string, string>> = {
  circularity: 'Where the material came from, how it comes apart, and where it goes after use.',
  environmental: 'Carbon over the whole life, freshwater, and pressure on ecosystems.',
  economic: 'Product, construction, maintenance and end of life, across the expected lifespan.',
  performance: 'Material health and composition. Technical classes as declared in the DoP.',
};

const OUTCOME = [
  { family: 'circularity', width: 26 },
  { family: 'environmental', width: 22 },
  { family: 'economic', width: 24 },
  { family: 'performance', width: 18 },
] as const;

const surface = (): HTMLElement => el('span', { className: 'fw-card-surface' });

/**
 * `expo.out` leaves at full speed from a standstill, which on a travelling
 * object reads as a snap however long it runs. The move eases in and out at
 * both ends instead, and the card follows the row rather than racing it.
 */
const MOVE = {
  travel: DURATION.cinematic * 0.62,
  open: DURATION.slow,
  shed: DURATION.slow,
  lag: DURATION.normal * 0.5,
  apart: STAGGER * 1.3,
  drift: 28,
} as const;

interface Leg {
  readonly row: HTMLElement;
  readonly label: HTMLElement;
  readonly head: HTMLElement;
  readonly name: HTMLElement;
  readonly card: HTMLElement;
}

export interface Framework {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * The overview and the indicator set are one panel because they are one move.
 * The four rows listed inside the indicator-set card are the four card headers
 * of the next beat: those rows travel out to their columns, and each card wipes
 * open downward underneath the row that has just landed on it.
 */
export function createFramework(): Framework {
  const chips = el('div', {
    className: 'fw-chips',
    children: SOURCES.map((source) => el('span', { className: 'fw-chip', text: source })),
  });

  const keyRows: HTMLElement[] = [];
  const keyLabels: HTMLElement[] = [];
  const keys = el('div', {
    className: 'fw-keys',
    children: FAMILIES.map(({ key, label }) => {
      const text = el('span', { className: 'fw-key-label', text: label });
      const row = el('div', {
        className: 'fw-key',
        attrs: { 'data-family': key },
        children: [el('span', { className: 'fw-key-swatch' }), text],
      });
      keyRows.push(row);
      keyLabels.push(text);
      return row;
    }),
  });

  const bars = el('div', {
    className: 'fw-bars',
    children: [0.62, 1, 0.78].map((scale) =>
      el('div', {
        className: 'fw-bar',
        children: OUTCOME.map(({ family, width }) =>
          el('span', { attrs: { 'data-family': family, style: `width: ${width * scale}%` } }),
        ),
      }),
    ),
  });

  const card = (index: string, name: string, lede: string, tail: HTMLElement): HTMLElement =>
    el('div', {
      className: 'fw-card',
      children: [
        surface(),
        el('p', { className: 'fw-index', text: index }),
        el('p', { className: 'fw-name', text: name }),
        el('p', { className: 'fw-lede', text: lede }),
        tail,
      ],
    });

  const stageCards = [
    card(
      'What the market already publishes',
      'Declared documents',
      'Every product on the market arrives with published data, and enough of it is consistent across competing products to carry a comparison.',
      chips,
    ),
    card(
      'What C1 defines',
      'One indicator set',
      'Four dimensions, each carrying the metrics that stay informative while the evidence is still partial.',
      keys,
    ),
    card(
      'What it produces',
      'A comparable profile',
      'Each alternative resolves to a profile that can be placed against the others competing for the same slot, while that slot is still open.',
      bars,
    ),
  ];

  const stages = el('div', { className: 'fw-stages', children: stageCards });
  const pivot = stageCards[1] as HTMLElement;
  const outer = stageCards.filter((node) => node !== pivot);
  const pivotShed = [
    pivot.querySelector('.fw-card-surface') as HTMLElement,
    pivot.querySelector('.fw-index') as HTMLElement,
    pivot.querySelector('.fw-name') as HTMLElement,
    pivot.querySelector('.fw-lede') as HTMLElement,
  ];

  const heads: HTMLElement[] = [];
  const names: HTMLElement[] = [];

  const familyCards = FAMILIES.map(({ key, label }) => {
    const metrics = METRICS.filter((metric) => metric.family === key).map((metric) => {
      const head = el('div', {
        className: 'fw-metric-head',
        children: [
          el('span', { className: 'fw-metric-key', text: metric.key }),
          el('span', { className: 'fw-metric-label', text: metric.label }),
        ],
      });

      const extras: HTMLElement[] = [];
      if (metric.unit) extras.push(el('p', { className: 'fw-metric-unit', text: metric.unit }));
      if (metric.parts?.length) {
        extras.push(
          el('div', {
            className: 'fw-parts',
            children: metric.parts.map((part) => el('span', { className: 'fw-part', text: part })),
          }),
        );
      }

      return el('div', { className: 'fw-metric', children: [head, ...extras] });
    });

    const name = el('p', { className: 'fw-name', text: label });
    const head = el('div', {
      className: 'fw-card-head',
      children: [el('span', { className: 'fw-key-swatch' }), name],
    });
    heads.push(head);
    names.push(name);

    return el('div', {
      className: 'fw-card',
      attrs: { 'data-family': key },
      children: [
        surface(),
        head,
        el('p', { className: 'fw-lede', text: LEDE[key] ?? '' }),
        el('div', { className: 'fw-metrics', children: metrics }),
      ],
    });
  });

  const families = el('div', { className: 'fw-families', children: familyCards });
  const element = el('div', { className: 'fw', children: [stages, families] });

  const legs = (): Leg[] =>
    keyRows.map((row, index) => ({
      row,
      label: keyLabels[index] as HTMLElement,
      head: heads[index] as HTMLElement,
      name: names[index] as HTMLElement,
      card: familyCards[index] as HTMLElement,
    }));

  const restore = (): void => {
    gsap.set(pivot, { overflow: 'hidden' });
    gsap.set(keyRows, { x: 0, y: 0, opacity: 1, zIndex: 'auto' });
    gsap.set(keyLabels, { scale: 1 });
  };

  const settleTo = (step: number): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(stages, { opacity: step === 0 ? 1 : 0 });
    gsap.set(families, { opacity: step === 0 ? 0 : 1 });
    gsap.set(stageCards, { opacity: 1, x: 0, y: 0 });
    gsap.set(pivotShed, { opacity: 1 });
    gsap.set(familyCards, { '--reveal': 0 });
    gsap.set(heads, { opacity: 1 });
    restore();
  };

  let shown = -1;

  return {
    element,
    beats: 2,

    play(step, settle) {
      if (settle) {
        settleTo(step);
        shown = step;
        return null;
      }

      const timeline = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      if (step === 0) {
        const back = shown > 0;

        if (!back) {
          settleTo(0);
          shown = 0;
          return timeline
            .from(
              element,
              {
                opacity: 0,
                duration: seconds(DURATION.normal),
                ease: EASE.enter,
                overwrite: true,
              },
              0,
            )
            .from(
              stageCards,
              {
                opacity: 0,
                y: 30,
                duration: seconds(DURATION.cinematic * 0.7),
                ease: EASE.enter,
                overwrite: true,
                stagger: seconds(STAGGER * 3),
              },
              0,
            );
        }

        const trip = legs();
        const origins = trip.map((leg) => leg.head.getBoundingClientRect());
        const grown = trip.map(
          (leg) =>
            Number.parseFloat(getComputedStyle(leg.name).fontSize) /
            Number.parseFloat(getComputedStyle(leg.label).fontSize),
        );

        settleTo(0);
        shown = 0;
        gsap.set(pivot, { overflow: 'visible' });
        gsap.set(pivotShed, { opacity: 0 });
        gsap.set(heads, { opacity: 0 });
        gsap.set(keyRows, { zIndex: 3 });

        for (const [index, leg] of trip.entries()) {
          const origin = origins[index] as DOMRect;
          const target = leg.row.getBoundingClientRect();
          const at = seconds(STAGGER * index);
          gsap.set(leg.label, { scale: grown[index] as number });

          timeline.fromTo(
            leg.row,
            { x: origin.left - target.left, y: origin.top - target.top },
            { x: 0, y: 0, duration: seconds(MOVE.travel), ease: EASE.standard, overwrite: true },
            at,
          );
          timeline.to(
            leg.label,
            { scale: 1, duration: seconds(MOVE.travel), ease: EASE.standard },
            at,
          );
          timeline.to(
            leg.card,
            { '--reveal': 100, duration: seconds(MOVE.open * 0.7), ease: EASE.standard },
            at,
          );
        }

        timeline.to(
          families,
          { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit },
          seconds(DURATION.normal),
        );
        timeline.to(
          pivotShed,
          { opacity: 1, duration: seconds(DURATION.normal), ease: EASE.enter },
          seconds(DURATION.quick),
        );
        timeline.fromTo(
          outer,
          { opacity: 0, x: (i: number) => (i === 0 ? -MOVE.drift : MOVE.drift) },
          {
            opacity: 1,
            x: 0,
            duration: seconds(MOVE.shed),
            ease: EASE.standard,
            overwrite: true,
          },
          seconds(MOVE.lag),
        );
        timeline.call(restore);

        return timeline;
      }

      const trip = legs();
      const origins = trip.map((leg) => leg.row.getBoundingClientRect());
      const grown = trip.map(
        (leg) =>
          Number.parseFloat(getComputedStyle(leg.name).fontSize) /
          Number.parseFloat(getComputedStyle(leg.label).fontSize),
      );

      settleTo(1);
      shown = 1;
      gsap.set(stages, { opacity: 1 });
      gsap.set(families, { opacity: 1 });
      gsap.set(familyCards, { '--reveal': 100 });
      gsap.set(heads, { opacity: 0 });
      gsap.set(pivot, { overflow: 'visible' });
      gsap.set(keyRows, { zIndex: 3 });

      timeline.to(
        outer,
        {
          opacity: 0,
          x: (i: number) => (i === 0 ? -MOVE.drift : MOVE.drift),
          duration: seconds(MOVE.shed),
          ease: EASE.standard,
          overwrite: true,
        },
        0,
      );
      timeline.to(
        pivotShed,
        { opacity: 0, duration: seconds(MOVE.shed), ease: EASE.standard, overwrite: true },
        0,
      );

      const scale = stageScale(element);

      for (const [index, leg] of trip.entries()) {
        const origin = origins[index] as DOMRect;
        const target = leg.head.getBoundingClientRect();
        const land = offsetBetween(origin, target, scale);
        const at = seconds(DURATION.instant + MOVE.apart * index);

        gsap.set(leg.label, { scale: 1 });

        timeline.fromTo(
          leg.row,
          { x: 0, y: 0 },
          {
            x: land.x,
            y: land.y,
            duration: seconds(MOVE.travel),
            ease: EASE.standard,
            overwrite: true,
          },
          at,
        );
        timeline.to(
          leg.label,
          { scale: grown[index] as number, duration: seconds(MOVE.travel), ease: EASE.standard },
          at,
        );
        timeline.to(
          leg.card,
          { '--reveal': 0, duration: seconds(MOVE.open), ease: EASE.standard },
          at + seconds(MOVE.lag),
        );

        // Identical geometry, so the swap between the two is not visible.
        timeline.to(
          leg.head,
          { opacity: 1, duration: seconds(DURATION.instant), ease: 'none' },
          at + seconds(MOVE.travel),
        );
        timeline.to(
          leg.row,
          { opacity: 0, duration: seconds(DURATION.instant), ease: 'none' },
          at + seconds(MOVE.travel),
        );
      }

      timeline.set(stages, { opacity: 0 });
      timeline.call(restore);

      return timeline;
    },
  };
}
