import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  INDICATORS,
  SALIENCE,
  SALIENCE_CLAIM,
  SHOWN_RANKS,
  type IndicatorKey,
} from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import { createWipe, shown, type Wipe } from './wipeMask';
import './c5-palette.css';
import './salience.css';

export interface Salience {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** One lane per shown rank. The connector board is scaled to the same ladder. */
const LANE = 100;

/** Every connector board carries the same geometry, so the wipes share it. */
const CONNECTOR = { width: 100, height: SHOWN_RANKS * LANE } as const;

const laneCentre = (rank: number): number => (rank - 0.5) * LANE;

/** Where an indicator sits in one context, or nothing when it is outside. */
const rankIn = (column: (typeof SALIENCE)[number], key: string): number | null => {
  const position = column.order.indexOf(key);
  return position >= 0 && position < SHOWN_RANKS ? position + 1 : null;
};

/**
 * What the model reads, and how far that changes with the context.
 *
 * Three columns of the same quantity, so a line between them compares within
 * one axis. A line is drawn only where an indicator is in the top five on both
 * sides of a gap; an indicator that arrives with no line into it has entered
 * the top five at that context, which is the strongest single reading on the
 * board and belongs to density under thermal insulation.
 */
export function createSalience(): Salience {
  const heads = SALIENCE.map((column) =>
    el('div', {
      className: 'sl-head',
      attrs: { 'data-key': column.key },
      children: [
        el('p', { className: 'sl-head-label', text: column.label }),
        el('p', { className: 'sl-head-note', text: column.concentration }),
      ],
    }),
  );

  const cells: HTMLElement[] = [];

  const columns = SALIENCE.map((column, columnIndex) => {
    const previous = SALIENCE[columnIndex - 1];

    const rows = column.order.slice(0, SHOWN_RANKS).map((key, index) => {
      const entered = previous !== undefined && rankIn(previous, key) === null;
      const cell = el('div', {
        className: 'sl-cell',
        attrs: {
          'data-key': key,
          'data-rank': String(index + 1),
          'data-entered': String(entered),
        },
        children: [
          el('span', { className: 'sl-rank', text: String(index + 1) }),
          el('p', { className: 'sl-name', text: INDICATORS[key as IndicatorKey] }),
        ],
      });
      cells.push(cell);
      return cell;
    });

    return el('div', {
      className: 'sl-column',
      attrs: { 'data-key': column.key },
      children: rows,
    });
  });

  const wipes: Wipe[] = [];

  const connectors = SALIENCE.slice(0, -1).map((column, index) => {
    const next = SALIENCE[index + 1];
    const board = svg('svg', {
      class: 'sl-connector',
      viewBox: `0 0 ${CONNECTOR.width} ${CONNECTOR.height}`,
      preserveAspectRatio: 'none',
    });
    const wipe = createWipe(board, CONNECTOR.width, CONNECTOR.height, 'x');
    wipes.push(wipe);
    const group = svg('g', { 'clip-path': wipe.clip });
    board.appendChild(group);
    if (!next) return board;

    for (const key of column.order.slice(0, SHOWN_RANKS)) {
      const from = rankIn(column, key);
      const to = rankIn(next, key);
      if (from === null || to === null) continue;

      const start = laneCentre(from);
      const end = laneCentre(to);
      const link = svg('path', {
        class: 'sl-link',
        'data-move': to === from ? 'held' : to < from ? 'up' : 'down',
        'vector-effect': 'non-scaling-stroke',
        d: `M 0 ${start.toFixed(1)} C 40 ${start.toFixed(1)}, 60 ${end.toFixed(1)}, 100 ${end.toFixed(1)}`,
      });
      group.appendChild(link);
    }

    return board;
  });

  const legend = el('div', {
    className: 'sl-legend',
    children: [
      el('span', { className: 'sl-legend-key sl-legend-entered', text: 'Enters the top five here' }),
    ],
  });

  const claim = el('p', { className: 'sl-claim', text: SALIENCE_CLAIM });

  // Every child is placed explicitly by `salience.css`, so the board reads the
  // same whatever order they are appended in.
  const gaps = connectors.map((connector, index) =>
    el('div', {
      className: 'sl-gap',
      attrs: { 'data-gap': String(index + 1) },
      children: [connector],
    }),
  );

  const board = el('div', {
    className: 'sl-board',
    children: [...heads, ...columns, ...gaps],
  });

  const element = el('div', {
    className: 'c5 sl',
    children: [
      el('div', {
        className: 'sl-top',
        children: [
          el('p', { className: 'c5-index', text: 'Mean absolute SHAP value, in order' }),
          legend,
        ],
      }),
      board,
      claim,
    ],
  });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([...heads, ...cells, legend, claim], { opacity: 1, x: 0, y: 0 });
    for (const wipe of wipes) gsap.set(wipe.rect, shown(wipe));
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      if (settle) {
        settleTo();
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      return line
        .from(
          heads,
          {
            opacity: 0,
            y: 12,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 2.2),
          },
          0,
        )
        // Column by column, so the ordering of the first is read before the
        // second arrives to disagree with it.
        .from(
          cells,
          {
            opacity: 0,
            x: -14,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.7),
          },
          seconds(DURATION.normal * 0.7),
        )
        // Gap by gap, left to right, so each reordering is read where it
        // happens instead of the whole board arriving at once.
        .fromTo(
          wipes.map((wipe) => wipe.rect),
          { attr: { width: 0 } },
          {
            attr: { width: CONNECTOR.width },
            duration: seconds(DURATION.slow),
            ease: EASE.standard,
            stagger: seconds(STAGGER * 2.5),
          },
          seconds(DURATION.cinematic * 0.85),
        )
        .from(
          [legend, claim],
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 2),
          },
          seconds(DURATION.cinematic * 1.15),
        );
    },
  };
}
