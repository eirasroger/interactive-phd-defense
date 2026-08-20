import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { APPLICATIONS, ARCHETYPES, CROSSING, PRODUCTS, TIERS, type ProductId } from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import { createWipe, hidden, shown, type Wipe } from './wipeMask';
import './c5-palette.css';
import './adapt.css';

export interface Adapt {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** The slope board's units. Columns sit at the centres of four equal bands. */
const SLOPE = { width: 400, height: 100 } as const;

const columnX = (index: number): number => ((index + 0.5) / APPLICATIONS.length) * SLOPE.width;

const scoreY = (score: number): number => (1 - score) * SLOPE.height;

const percentX = (index: number): string =>
  `${(((index + 0.5) / APPLICATIONS.length) * 100).toFixed(3)}%`;

const percentY = (score: number): string => `${((1 - score) * 100).toFixed(3)}%`;

/** Which of the three roles a product plays in the application comparison. */
const roleOf = (id: ProductId): string => {
  if (CROSSING.pair.includes(id as (typeof CROSSING.pair)[number])) return 'crossing';
  if (id === 'D') return 'held';
  return 'quiet';
};

interface State {
  readonly element: HTMLElement;
  readonly parts: readonly HTMLElement[];
  /** Present only on the state that draws lines. */
  readonly wipe: Wipe | null;
}

/* ---- Who is deciding --------------------------------------------------------- */

/**
 * The stakeholder beat, drawn without a number on it.
 *
 * Fig. 7's values are legible only off the chart, and the claim needs none of
 * them: three tiers hold across all eight archetypes, and the only thing that
 * moves is the distance between the two candidates inside the middle one. Two
 * archetypes are shown because those are the two the paper reads out.
 */
function stakeholder(): State {
  const tiers = TIERS.map((tier) =>
    el('div', {
      className: 'ad-tier',
      attrs: { 'data-key': tier.key },
      children: [
        el('div', {
          className: 'ad-tier-members',
          children: tier.members.map((id) =>
            el('span', {
              className: 'c5-token',
              text: id,
              attrs: {
                'data-standing':
                  tier.key === 'upper' ? 'lead' : tier.key === 'middle' ? 'contested' : 'trailing',
              },
            }),
          ),
        }),
        el('div', {
          className: 'ad-tier-text',
          children: [
            el('p', { className: 'ad-tier-label', text: tier.label }),
            el('p', { className: 'ad-tier-note', text: tier.note }),
          ],
        }),
      ],
    }),
  );

  const cards = ARCHETYPES.map((archetype) =>
    el('div', {
      className: 'ad-archetype',
      attrs: { 'data-gap': archetype.gap },
      children: [
        el('div', {
          className: 'ad-archetype-head',
          children: [
            el('span', { className: 'ad-archetype-code', text: archetype.code }),
            el('p', { className: 'ad-archetype-label', text: archetype.label }),
          ],
        }),
        el('div', {
          className: 'ad-gap',
          children: [
            el('span', { className: 'ad-gap-rule' }),
            el('span', { className: 'ad-gap-mark', text: 'A', attrs: { 'data-id': 'A' } }),
            el('span', { className: 'ad-gap-mark', text: 'B', attrs: { 'data-id': 'B' } }),
          ],
        }),
        el('p', { className: 'ad-archetype-reading', text: archetype.reading }),
      ],
    }),
  );

  return {
    wipe: null,
    parts: [...tiers, ...cards],
    element: el('div', {
      className: 'ad-state',
      attrs: { 'data-state': 'who' },
      children: [
        el('p', { className: 'c5-index', text: 'The same five, under eight priorities' }),
        el('div', {
          className: 'ad-who',
          children: [
            el('div', { className: 'ad-tiers', children: tiers }),
            el('div', { className: 'ad-archetypes', children: cards }),
          ],
        }),
      ],
    }),
  };
}

/* ---- What it is for ------------------------------------------------------------ */

/**
 * The application beat, drawn with every published value.
 *
 * A slope chart, because all four columns carry the same quantity measured the
 * same way, so a line between them compares within one axis and asserts nothing
 * across. The two lines that cross are the beat; the rest are drawn quietly so
 * the crossing is the thing the eye finds.
 */
function application(): State {
  const headers = APPLICATIONS.map((entry) =>
    el('p', { className: 'ad-column', text: entry.label }),
  );

  const board = svg('svg', {
    class: 'ad-board',
    viewBox: `0 0 ${SLOPE.width} ${SLOPE.height}`,
    preserveAspectRatio: 'none',
  });

  const wipe = createWipe(board, SLOPE.width, SLOPE.height, 'x');
  const lines = svg('g', { 'clip-path': wipe.clip });
  board.appendChild(lines);

  for (const id of PRODUCTS) {
    const d = APPLICATIONS.map((entry, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${columnX(index).toFixed(2)} ${scoreY(entry.scores[id]).toFixed(2)}`;
    }).join(' ');

    lines.appendChild(
      svg('path', {
        class: 'ad-slope-line',
        'data-role': roleOf(id),
        'vector-effect': 'non-scaling-stroke',
        d,
      }),
    );
  }

  // Every point gets a node; only the two whose crossing is the beat, and the
  // one that holds the lead through it, get a value printed. Twenty readouts
  // collide at 0.78 against 0.76, which is the pair the beat exists to show.
  const READ_OUT: readonly ProductId[] = [...CROSSING.pair, 'D'];
  const SIDE: Readonly<Record<string, string>> = { A: 'above', C: 'below', D: 'above' };

  const nodes: HTMLElement[] = [];
  const readouts: HTMLElement[] = [];

  for (const id of PRODUCTS) {
    for (const [index, entry] of APPLICATIONS.entries()) {
      const place = `left: ${percentX(index)}; top: ${percentY(entry.scores[id])}`;
      nodes.push(
        el('span', {
          className: 'ad-node',
          attrs: { 'data-id': id, 'data-role': roleOf(id), style: place },
        }),
      );

      if (!READ_OUT.includes(id) || !(entry.key === CROSSING.from || entry.key === CROSSING.to)) {
        continue;
      }
      readouts.push(
        el('span', {
          className: 'ad-point',
          attrs: {
            'data-id': id,
            'data-role': roleOf(id),
            'data-side': SIDE[id] ?? 'above',
            style: place,
          },
          text: entry.scores[id].toFixed(2),
        }),
      );
    }
  }

  const points = [...nodes, ...readouts];

  const labels = PRODUCTS.map((id) => {
    const last = APPLICATIONS[APPLICATIONS.length - 1];
    return el('span', {
      className: 'c5-token ad-end',
      text: id,
      attrs: {
        'data-role': roleOf(id),
        'data-standing': id === 'D' ? 'lead' : id === 'E' ? 'trailing' : 'contested',
        style: `top: ${percentY(last ? last.scores[id] : 0)}`,
      },
    });
  });

  const ticks = [1, 0.75, 0.5, 0.25, 0].map((value) =>
    el('span', {
      className: 'ad-tick',
      attrs: { style: `top: ${percentY(value)}` },
      text: value.toFixed(2),
    }),
  );

  const reading = el('div', {
    className: 'ad-reading',
    children: [
      el('p', { className: 'ad-reading-line', text: CROSSING.reading }),
      el('p', { className: 'ad-reading-held', text: CROSSING.held }),
    ],
  });

  gsap.set(points, { xPercent: -50, yPercent: -50 });
  gsap.set(labels, { yPercent: -50 });

  return {
    wipe,
    parts: [...headers, ...points, ...labels, reading],
    element: el('div', {
      className: 'ad-state',
      attrs: { 'data-state': 'what' },
      children: [
        el('p', { className: 'c5-index', text: 'The same five, under four applications' }),
        el('div', {
          className: 'ad-what',
          children: [
            el('div', { className: 'ad-axis', children: ticks }),
            el('div', {
              className: 'ad-plot',
              children: [
                el('div', { className: 'ad-columns', children: headers }),
                el('div', {
                  className: 'ad-canvas',
                  children: [board, ...nodes, ...readouts],
                }),
              ],
            }),
            el('div', { className: 'ad-ends', children: labels }),
          ],
        }),
        el('div', { className: 'ad-foot', children: [reading] }),
      ],
    }),
  };
}

/**
 * Beats 9 and 10. Who is deciding, and what the product is for.
 *
 * One panel across both, because the argument is a comparison between the two
 * inputs: one settles a margin, and the other changes which attributes count.
 * Two separate panels would let the audience read them as two facts.
 */
export function createAdapt(): Adapt {
  const states = [stakeholder(), application()];
  const element = el('div', {
    className: 'c5 ad',
    children: states.map((state) => state.element),
  });
  gsap.set(states[1]?.element ?? null, { opacity: 0 });

  const settleTo = (step: number): void => {
    gsap.set(element, { opacity: 1 });
    for (const [index, state] of states.entries()) {
      gsap.set(state.element, { opacity: index === step ? 1 : 0 });
      gsap.set(state.parts, { opacity: 1, x: 0, y: 0, scale: 1 });
      if (state.wipe) gsap.set(state.wipe.rect, shown(state.wipe));
    }
  };

  return {
    element,
    beats: states.length,

    play(step, settle) {
      const state = states[step];
      if (!state) return null;

      if (settle) {
        settleTo(step);
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });
      for (const [index, other] of states.entries()) {
        if (index === step) continue;
        line.to(
          other.element,
          { opacity: 0, duration: seconds(DURATION.quick), ease: 'power2.out' },
          0,
        );
      }
      line.set(state.element, { opacity: 1 }, 0);

      // The lines are drawn left to right, so the crossing happens in front of
      // the audience instead of being on the wall when the beat arrives.
      if (state.wipe) {
        line.fromTo(
          state.wipe.rect,
          hidden(state.wipe),
          {
            ...shown(state.wipe),
            duration: seconds(DURATION.cinematic * 1.05),
            ease: EASE.standard,
          },
          seconds(DURATION.quick * 0.8),
        );
      }

      line.from(
        state.parts,
        {
          opacity: 0,
          y: 14,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 0.55),
        },
        seconds(DURATION.quick * 0.6),
      );

      return line;
    },
  };
}
