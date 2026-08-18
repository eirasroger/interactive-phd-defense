import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './takeaway.css';

export interface TakeawayCard {
  /** Any CSS colour. The card's rule, its accents and its figure all read it. */
  readonly tint: string;
  readonly name: string;
  readonly body: string;
  /** Whatever carries the card's evidence. The builders below cover most of it. */
  readonly figure: readonly HTMLElement[];
}

export interface Takeaway {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** A pair of readings, the second overturning or qualifying the first. */
export const verdict = (from: string, to: string, lead: boolean): HTMLElement =>
  el('div', {
    className: 'take-verdict',
    attrs: { 'data-lead': String(lead) },
    children: [
      el('span', { className: 'take-verdict-from', text: from }),
      el('span', { className: 'take-verdict-to', text: to }),
    ],
  });

/** Bars whose lengths are the argument, usually because they are nearly equal. */
export const pair = (rows: readonly (readonly [string, number])[]): HTMLElement =>
  el('div', {
    className: 'take-pair',
    children: rows.map(([label, width]) =>
      el('div', {
        className: 'take-pair-row',
        children: [
          el('span', { text: label }),
          el('span', { className: 'take-pair-bar', attrs: { style: `width: ${width}%` } }),
        ],
      }),
    ),
  });

/** What this contribution passes to a later one. */
export const handoff = (mark: string, text: string): HTMLElement =>
  el('div', {
    className: 'take-handoff',
    children: [
      el('span', { className: 'take-handoff-mark', text: mark }),
      el('span', { className: 'take-handoff-text', text }),
    ],
  });

/** A short enumeration, where the items are the evidence and need no chart. */
export const stack = (items: readonly string[]): HTMLElement =>
  el('div', {
    className: 'take-stack',
    children: items.map((item) =>
      el('div', {
        className: 'take-stack-item',
        children: [
          el('span', { className: 'take-stack-mark' }),
          el('span', { className: 'take-stack-text', text: item }),
        ],
      }),
    ),
  });

/**
 * One input resolving into two independent outputs.
 *
 * Drawn as a fork because the claim is that the branches do not track each
 * other: a single arrow would say the opposite.
 */
export const fork = (
  source: string,
  branches: readonly string[],
): HTMLElement =>
  el('div', {
    className: 'take-fork',
    children: [
      el('span', { className: 'take-fork-source', text: source }),
      el('div', {
        className: 'take-fork-branches',
        children: branches.map((branch) =>
          el('span', { className: 'take-fork-branch', text: branch }),
        ),
      }),
    ],
  });

/**
 * Several declared wordings collapsing into the one label they have to become.
 *
 * The left column is what manufacturers write and the right is what the schema
 * has to store. The convergence is the point: it is a modelling decision, taken
 * here, that everything downstream then depends on.
 */
export const aggregate = (
  rows: readonly { readonly text: string; readonly label: string }[],
): HTMLElement => {
  const labels = [...new Set(rows.map((row) => row.label))];

  return el('div', {
    className: 'take-aggregate',
    children: rows.map((row) =>
      el('div', {
        className: 'take-aggregate-row',
        attrs: { 'data-slot': String(labels.indexOf(row.label)) },
        children: [
          el('span', { className: 'take-aggregate-text', text: row.text }),
          el('span', { className: 'take-aggregate-arrow' }),
          el('span', { className: 'take-aggregate-label', text: row.label }),
        ],
      }),
    ),
  });
};

/**
 * Two quantities that should track each other and do not.
 *
 * Drawn as a fall rather than as two bars: the reading is the drop between
 * them, and two bars make the eye compare lengths instead of following one.
 */
export const slope = (
  from: readonly [string, number],
  to: readonly [string, number],
  max: number,
): HTMLElement => {
  const end = (entry: readonly [string, number], side: string): HTMLElement =>
    el('div', {
      className: 'take-slope-end',
      attrs: {
        'data-side': side,
        style: `--height: ${(entry[1] / max) * 100}%`,
      },
      children: [
        el('span', { className: 'take-slope-bar' }),
        el('div', {
          className: 'take-slope-text',
          children: [
            el('span', { className: 'take-slope-value', text: `${entry[1].toFixed(1)}%` }),
            el('span', { className: 'take-slope-label', text: entry[0] }),
          ],
        }),
      ],
    });

  return el('div', {
    className: 'take-slope',
    children: [end(from, 'from'), el('span', { className: 'take-slope-fall' }), end(to, 'to')],
  });
};

/** A median against its own mean, so the spread inside a group is visible. */
export const spread = (
  rows: readonly { readonly label: string; readonly median: number; readonly mean: number }[],
  max: number,
): HTMLElement =>
  el('div', {
    className: 'take-spread',
    children: [
      ...rows.map((row) =>
        el('div', {
          className: 'take-spread-row',
          children: [
            el('span', { className: 'take-spread-label', text: row.label }),
            el('span', {
              className: 'take-spread-rail',
              children: [
                el('span', {
                  className: 'take-spread-span',
                  attrs: {
                    style:
                      `left: ${(row.median / max) * 100}%; ` +
                      `width: ${((row.mean - row.median) / max) * 100}%`,
                  },
                }),
                el('span', {
                  className: 'take-spread-median',
                  attrs: { style: `left: ${(row.median / max) * 100}%` },
                }),
                el('span', {
                  className: 'take-spread-mean',
                  attrs: { style: `left: ${(row.mean / max) * 100}%` },
                }),
              ],
            }),
          ],
        }),
      ),
    ],
  });

/**
 * What a contribution settles, in three cards.
 *
 * The closing beat of every station, so it is one component rather than one per
 * paper: the cards, their rhythm and their reveal are the deck's, and only the
 * readings inside them belong to the contribution.
 */
export function createTakeaway(cards: readonly TakeawayCard[]): Takeaway {
  const cardNodes = cards.map((card) =>
    el('div', {
      className: 'take-card',
      attrs: { style: `--tint: ${card.tint}` },
      children: [
        el('p', { className: 'take-name', text: card.name }),
        el('p', { className: 'take-body', text: card.body }),
        el('div', { className: 'take-figure', children: card.figure }),
      ],
    }),
  );

  const element = el('div', {
    className: 'take',
    attrs: { style: `--cards: ${cards.length}` },
    children: cardNodes,
  });
  const figures = [...element.querySelectorAll<HTMLElement>('.take-figure > *')];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(cardNodes, { opacity: 1, y: 0 });
    gsap.set(figures, { opacity: 1, y: 0 });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      settleTo();
      if (settle) return null;

      return gsap
        .timeline()
        .from(element, {
          opacity: 0,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          overwrite: true,
        })
        .from(
          cardNodes,
          {
            opacity: 0,
            y: 30,
            duration: seconds(DURATION.cinematic * 0.8),
            ease: EASE.enter,
            overwrite: true,
            stagger: seconds(STAGGER * 3),
          },
          0,
        )
        .from(
          figures,
          {
            opacity: 0,
            y: 14,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            overwrite: true,
            stagger: seconds(STAGGER * 1.5),
          },
          seconds(DURATION.normal),
        );
    },
  };
}
