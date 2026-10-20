import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  CORPUS_CLAIM,
  INFLUENCE,
  INFLUENCE_BANDS,
  SOURCES,
  SPLIT,
  type LabelSource,
} from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import './c5-palette.css';
import './supervision.css';

export interface Supervision {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const count = (value: number): string => value.toLocaleString('en-GB');

const percent = (value: number, places = 0): string => `${(value * 100).toFixed(places)}%`;

/* ---- The corpus, and what it is worth -------------------------------------------- */

const RIBBON = { width: 1420, height: 114 } as const;
const BAND_HEIGHT = 24;
const SEGMENT_GAP = 3;

interface Span {
  readonly start: number;
  readonly extent: number;
}

/** Segment spans across the board, with gaps subtracted from segment widths. */
const spansOf = (shares: readonly number[]): readonly Span[] => {
  const usable = RIBBON.width - SEGMENT_GAP * (shares.length - 1);
  let cursor = 0;
  return shares.map((share) => {
    const extent = usable * share;
    const span = { start: cursor, extent };
    cursor += extent + SEGMENT_GAP;
    return span;
  });
};

const ribbonBetween = (from: Span, to: Span): string => {
  const top = BAND_HEIGHT;
  const bottom = RIBBON.height - BAND_HEIGHT;
  const bend = (bottom - top) * 0.5;

  return (
    `M ${from.start.toFixed(2)} ${top} ` +
    `C ${from.start.toFixed(2)} ${top + bend}, ${to.start.toFixed(2)} ${bottom - bend}, ` +
    `${to.start.toFixed(2)} ${bottom} ` +
    `L ${(to.start + to.extent).toFixed(2)} ${bottom} ` +
    `C ${(to.start + to.extent).toFixed(2)} ${bottom - bend}, ` +
    `${(from.start + from.extent).toFixed(2)} ${top + bend}, ` +
    `${(from.start + from.extent).toFixed(2)} ${top} Z`
  );
};

/* ---- The three sources ------------------------------------------------------------- */

const sourceCard = (source: LabelSource): HTMLElement => {
  return el('div', {
    className: 'sv-source',
    attrs: { 'data-key': source.key },
    children: [
      el('div', {
        className: 'sv-source-head',
        children: [
          el('p', { className: 'sv-source-label', text: source.label }),
          el('span', { className: 'c5-figure sv-source-count', text: count(source.count) }),
        ],
      }),
      el('p', { className: 'sv-source-produced', text: source.produced }),
      ...(source.fact ? [el('p', { className: 'sv-detail', text: source.fact })] : []),
      el('p', { className: 'sv-source-gives', text: source.contributes }),
    ],
  });
};

/**
 * Beat 2: the three label sources and their weight. The ribbon maps each source's share of the corpus (top band) to its
 * share of the training objective (bottom band).
 */
export function createSupervision(): Supervision {
  const cards = SOURCES.map(sourceCard);

  const board = svg('svg', {
    class: 'sv-ribbon-board',
    viewBox: `0 0 ${RIBBON.width} ${RIBBON.height}`,
    preserveAspectRatio: 'none',
  });

  const volume = spansOf(INFLUENCE.map((entry) => entry.volume));
  const objective = spansOf(INFLUENCE.map((entry) => entry.objective));

  const ribbons = INFLUENCE.map((entry, index) => {
    const from = volume[index];
    const to = objective[index];
    if (!from || !to) throw new Error('C5: the supervision bands disagree on their groups.');
    return svg('path', {
      class: 'sv-ribbon',
      'data-key': entry.key,
      d: ribbonBetween(from, to),
    });
  });
  for (const ribbon of ribbons) board.appendChild(ribbon);

  const segments: SVGRectElement[] = [];
  for (const [index, entry] of INFLUENCE.entries()) {
    for (const [spans, y] of [
      [volume, 0],
      [objective, RIBBON.height - BAND_HEIGHT],
    ] as const) {
      const span = spans[index];
      if (!span) continue;
      const rect = svg('rect', {
        class: 'sv-segment',
        'data-key': entry.key,
        x: span.start.toFixed(2),
        y: String(y),
        width: span.extent.toFixed(2),
        height: String(BAND_HEIGHT),
        rx: '3',
      });
      segments.push(rect);
      board.appendChild(rect);
    }
  }

  const legendFor = (kind: 'volume' | 'objective'): HTMLElement =>
    el('div', {
      className: 'sv-legend',
      attrs: { 'data-kind': kind },
      children: INFLUENCE.map((entry) => {
        const spans = kind === 'volume' ? volume : objective;
        const index = INFLUENCE.indexOf(entry);
        const span = spans[index];
        const share = kind === 'volume' ? entry.volume : entry.objective;
        // Segments under 5% are too narrow for a centred label, so it anchors
        // to the segment's left edge.
        const tiny = share < 0.05;
        const anchor = tiny ? (span?.start ?? 0) : (span?.start ?? 0) + (span?.extent ?? 0) / 2;
        return el('p', {
          className: 'sv-legend-entry',
          attrs: {
            'data-key': entry.key,
            'data-kind': kind,
            'data-tiny': String(tiny),
            style: `left: ${(anchor / RIBBON.width) * 100}%`,
          },
          text: percent(share, tiny ? 2 : 0),
        });
      }),
    });

  const expert = INFLUENCE.find((entry) => entry.key === 'expert');
  const amplified = el('div', {
    className: 'sv-amplified',
    children: [
      el('span', {
        className: 'c5-figure sv-amplified-figure',
        text: `${(expert?.amplification ?? 0).toFixed(1)}×`,
      }),
      el('p', {
        className: 'sv-amplified-note',
        text: 'the influence its share of the corpus would carry',
      }),
    ],
  });

  const figure = el('div', {
    className: 'sv-influence',
    children: [
      el('div', {
        className: 'sv-influence-body',
        children: [
          el('div', {
            className: 'sv-band-labels',
            children: [
              el('p', { className: 'sv-band-label', text: INFLUENCE_BANDS.volume }),
              el('p', {
                className: 'sv-band-label',
                attrs: { 'data-kind': 'objective' },
                text: INFLUENCE_BANDS.objective,
              }),
            ],
          }),
          el('div', {
            className: 'sv-ribbon-frame',
            children: [board, legendFor('volume'), legendFor('objective')],
          }),
        ],
      }),
      amplified,
    ],
  });

  const split = el('div', {
    className: 'sv-split',
    children: [
      el('p', {
        className: 'sv-split-figure',
        text: `${percent(SPLIT.train)} training, ${percent(1 - SPLIT.train)} test`,
      }),
      el('p', {
        className: 'sv-split-note',
        text: `${SPLIT.note} Same proportions across ${SPLIT.folds} folds.`,
      }),
    ],
  });

  const claim = el('p', { className: 'sv-claim', text: CORPUS_CLAIM });

  const element = el('div', {
    className: 'c5 sv',
    children: [claim, el('div', { className: 'sv-sources', children: cards }), figure, split],
  });

  const parts = [claim, ...cards, figure, split];

  return {
    element,
    beats: 1,

    play(_step, settle) {
      gsap.set(element, { opacity: 1 });

      if (settle) {
        gsap.set(parts, { opacity: 1, x: 0, y: 0 });
        return null;
      }

      return gsap.timeline().from(parts, {
        opacity: 0,
        y: 16,
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        stagger: seconds(STAGGER * 2.2),
      });
    },
  };
}
