import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { MARGIN, SETS, type Scored } from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import './c5-palette.css';
import './relational.css';

export interface Relational {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** Every candidate the beat will ever draw, in the order it draws them. */
const ROWS = ['A', 'B', 'C', 'D'] as const;
type RowId = (typeof ROWS)[number];

const FLARE = { width: 100, height: 100 } as const;

const rowY = (id: RowId): number => ((ROWS.indexOf(id) + 0.5) / ROWS.length) * FLARE.height;

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;

const scoreIn = (step: number, id: RowId): Scored | undefined =>
  SETS[step]?.products.find((product) => product.id === id);

interface Margin {
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly height: number;
}

/**
 * Where the margin bracket sits, given the two candidates it closes over.
 *
 * The width is the model's own mean absolute error, so the bracket is a
 * published quantity drawn to scale rather than an illustration of closeness.
 * The height covers the rows it encloses and no more; run over the whole plot
 * it reached down through candidates it says nothing about.
 */
const marginSpan = (step: number): Margin | null => {
  const a = scoreIn(step, 'A');
  const b = scoreIn(step, 'B');
  if (!a || !b || Math.abs(a.score - b.score) > MARGIN) return null;

  const rows = [ROWS.indexOf('A'), ROWS.indexOf('B')];
  const first = Math.min(...rows);
  const last = Math.max(...rows);
  const centre = (a.score + b.score) / 2;

  return {
    left: centre - MARGIN / 2,
    width: MARGIN,
    top: first / ROWS.length,
    height: (last - first + 1) / ROWS.length,
  };
};

interface Row {
  readonly id: RowId;
  readonly element: HTMLElement;
  readonly puck: HTMLElement;
  readonly readout: HTMLElement;
  /** The parts that carry a value. The rail under them is always drawn. */
  readonly ink: readonly HTMLElement[];
}

/**
 * A candidate's score, and the set it was computed in.
 *
 * All four rails are drawn from the first beat and a rail with no candidate on
 * it is left empty, so the wall says up front that the set can grow and nothing
 * reflows when it does. The pucks then have one job across the three beats,
 * which is to travel; a layout that moved underneath them would hide the only
 * thing worth watching.
 */
export function createRelational(): Relational {
  const rows: Row[] = ROWS.map((id) => {
    const readout = el('span', { className: 'rl-readout c5-figure' });
    const puck = el('span', {
      className: 'rl-puck',
      children: [el('span', { className: 'rl-halo' }), readout],
    });

    const token = el('span', {
      className: 'c5-token',
      text: id,
      attrs: { 'data-standing': 'trailing' },
    });

    return {
      id,
      puck,
      readout,
      ink: [token, puck],
      element: el('div', {
        className: 'rl-row',
        attrs: { 'data-id': id, 'data-present': 'false' },
        children: [
          token,
          el('div', { className: 'rl-track', children: [el('span', { className: 'rl-rule' }), puck] }),
        ],
      }),
    };
  });

  const flare = svg('svg', {
    class: 'rl-flare',
    viewBox: `0 0 ${FLARE.width} ${FLARE.height}`,
    preserveAspectRatio: 'none',
  });

  const bracket = el('div', {
    className: 'rl-margin',
    children: [
      el('span', { className: 'rl-margin-band' }),
      el('span', { className: 'rl-margin-label', text: `Margin of error, ${MARGIN.toFixed(2)}` }),
    ],
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((value) =>
    el('span', {
      className: 'rl-tick',
      attrs: { style: `left: ${percent(value)}` },
      text: value.toFixed(2),
    }),
  );

  const axis = el('div', {
    className: 'rl-axis',
    children: [
      el('p', { className: 'rl-axis-label', text: 'Preference score' }),
      el('div', { className: 'rl-ticks', children: ticks }),
    ],
  });

  const plot = el('div', {
    className: 'rl-plot',
    children: [
      el('div', { className: 'rl-rows', children: rows.map((row) => row.element) }),
      el('div', { className: 'rl-overlay', children: [flare] }),
      bracket,
    ],
  });

  const element = el('div', {
    className: 'c5 c5-field rl',
    children: [
      el('p', { className: 'c5-index', text: 'One candidate, scored in three different sets' }),
      plot,
      axis,
      el('p', {
        className: 'rl-note',
        text: 'A wider halo marks a candidate whose score moves under ±10% on its inputs.',
      }),
    ],
  });

  gsap.set(
    rows.flatMap((row) => [...row.ink]),
    { opacity: 0 },
  );
  gsap.set(
    rows.map((row) => row.puck),
    { xPercent: -50, yPercent: -50 },
  );

  /** The flare paths for one step, rebuilt because the geometry changes. */
  const flaresFor = (step: number): readonly SVGPathElement[] => {
    const set = SETS[step];
    if (!set?.entering) return [];
    const source = scoreIn(step, set.entering as RowId);
    if (!source) return [];

    const sourceY = rowY(set.entering as RowId);
    const sourceX = source.score * FLARE.width;

    return set.products
      .filter((product) => product.id !== set.entering)
      .map((product) => {
        const targetY = rowY(product.id as RowId);
        const targetX = product.score * FLARE.width;
        const mid = (sourceX + targetX) / 2;
        return svg('path', {
          class: 'rl-link',
          'vector-effect': 'non-scaling-stroke',
          d:
            `M ${sourceX.toFixed(2)} ${sourceY.toFixed(2)} ` +
            `C ${mid.toFixed(2)} ${sourceY.toFixed(2)}, ` +
            `${mid.toFixed(2)} ${targetY.toFixed(2)}, ` +
            `${targetX.toFixed(2)} ${targetY.toFixed(2)}`,
        });
      });
  };

  const applyTo = (step: number): void => {
    for (const row of rows) {
      const scored = scoreIn(step, row.id);
      row.element.dataset['present'] = String(scored !== undefined);
      if (!scored) continue;
      row.element.dataset['spread'] = scored.spread;
      row.readout.textContent = scored.score.toFixed(2);
    }
  };

  const placeMargin = (span: Margin): void => {
    bracket.style.left = percent(span.left);
    bracket.style.width = percent(span.width);
    bracket.style.top = percent(span.top);
    bracket.style.height = percent(span.height);
  };

  const settleTo = (step: number): void => {
    gsap.set(element, { opacity: 1 });
    applyTo(step);

    for (const row of rows) {
      const scored = scoreIn(step, row.id);
      gsap.set(row.ink, { opacity: scored ? 1 : 0, y: 0 });
      if (scored) gsap.set(row.puck, { left: percent(scored.score) });
    }

    flare.replaceChildren();
    const span = marginSpan(step);
    gsap.set(bracket, { opacity: span ? 1 : 0 });
    if (span) placeMargin(span);
    gsap.set(axis, { opacity: 1, y: 0 });
  };

  return {
    element,
    beats: SETS.length,

    play(step, settle) {
      if (settle) {
        settleTo(step);
        return null;
      }

      const set = SETS[step];
      if (!set) return null;

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      const entering = set.entering as RowId | null;
      const staying = rows.filter((row) => scoreIn(step, row.id) && row.id !== entering);
      const absent = rows.filter((row) => !scoreIn(step, row.id));

      applyTo(step);

      if (absent.length > 0) {
        line.to(
          absent.flatMap((row) => [...row.ink]),
          { opacity: 0, duration: seconds(DURATION.quick), ease: 'power2.out' },
          0,
        );
      }

      // Entering first, at rest, so the flare has a source before it fires.
      if (entering) {
        const row = rows.find((candidate) => candidate.id === entering);
        const scored = scoreIn(step, entering);
        if (row && scored) {
          gsap.set(row.puck, { left: percent(scored.score) });
          line.fromTo(
            row.ink,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.quick * 0.8),
          );
        }
      } else {
        line.fromTo(
          staying.flatMap((row) => [...row.ink]),
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 2),
          },
          seconds(DURATION.quick * 0.8),
        );
      }

      // The flare is the cause and the travel is the effect, so the links are
      // drawn and released before anything below them moves.
      // A flash rather than a drawing: the links fan out from one candidate to
      // every other, so there is no direction a wipe could sweep that matches
      // what attention does.
      const links = flaresFor(step);
      if (links.length > 0) {
        flare.replaceChildren(...links);
        line
          .fromTo(
            links,
            { opacity: 0 },
            {
              opacity: 1,
              duration: seconds(DURATION.normal),
              ease: 'power2.out',
              stagger: seconds(STAGGER),
            },
            seconds(DURATION.slow * 0.75),
          )
          .to(
            links,
            { opacity: 0, duration: seconds(DURATION.slow), ease: 'power2.in' },
            seconds(DURATION.cinematic * 0.95),
          );
      } else {
        flare.replaceChildren();
      }

      // Every puck already on the axis travels to the score it has in the new
      // set, which is the whole claim of the station drawn as one movement.
      for (const row of staying) {
        const scored = scoreIn(step, row.id);
        if (!scored) continue;
        if (!entering) {
          gsap.set(row.puck, { left: percent(scored.score) });
          continue;
        }
        line.to(
          row.puck,
          {
            left: percent(scored.score),
            duration: seconds(DURATION.cinematic * 0.8),
            ease: EASE.standard,
          },
          seconds(DURATION.cinematic * 0.85),
        );
      }

      const span = marginSpan(step);
      if (span) {
        placeMargin(span);
        line.fromTo(
          bracket,
          { opacity: 0, scaleY: 0.6 },
          {
            opacity: 1,
            scaleY: 1,
            transformOrigin: 'center center',
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
          },
          seconds(DURATION.cinematic * 1.5),
        );
      } else {
        line.to(bracket, { opacity: 0, duration: seconds(DURATION.quick) }, 0);
      }

      if (step === 0) {
        line.from(
          axis,
          { opacity: 0, y: 10, duration: seconds(DURATION.slow), ease: EASE.enter },
          seconds(DURATION.normal),
        );
      }

      return line;
    },
  };
}
