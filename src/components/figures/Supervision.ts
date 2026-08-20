import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  CORPUS_CLAIM,
  GENERATION,
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

/* ---- Deterministic scatter --------------------------------------------------- */

/**
 * A repeatable pseudo-random offset.
 *
 * The control diagram has to show a range that was *randomised*, which a set of
 * identical bands cannot say. Nothing about the positions is a measurement, so
 * they are a function of the row index: the same drawing every reload, and no
 * number invented that a reader could take for one.
 */
const jitter = (seed: number): number => {
  const mixed = Math.imul(seed + 1, 2654435761) >>> 8;
  return (mixed % 1000) / 1000;
};

/* ---- How a control case is designed ------------------------------------------- */

const CONTROL_BOARD = { width: 380, height: 100 } as const;

/**
 * Four indicators the control set covers, named so the rows are readable.
 *
 * Short forms of the published indicator names. Which one is swept varies
 * across the 24,000 cases; density under the insulation applications is drawn
 * because it is the sweep the application beat later depends on.
 */
const CONTROL_ROWS = [
  'Global warming potential',
  'Life cycle cost',
  'Density',
  'Recycling',
] as const;
const CONTROL_VARIED = 0;

/**
 * A control case, drawn as the case itself.
 *
 * Three alternatives are identical on every indicator but one, so the preferred
 * alternative follows from that row alone and no judgement enters. The marks are
 * lettered on the swept row because without knowing they are the same three
 * products throughout, the clustering says nothing.
 */
const controlDiagram = (): SVGSVGElement => {
  const board = svg('svg', {
    class: 'sv-diagram',
    viewBox: `0 0 ${CONTROL_BOARD.width} ${CONTROL_BOARD.height}`,
  });

  const nameRight = 118;
  const trackLeft = 126;
  const trackRight = 372;
  const rowTop = 22;
  const rowStep = 22;
  const mark = 9;

  const mark_ = (x: number, y: number, accent: boolean): SVGRectElement =>
    svg('rect', {
      class: 'sv-alt',
      'data-varied': String(accent),
      x: (x - mark / 2).toFixed(1),
      y: (y - mark / 2).toFixed(1),
      width: String(mark),
      height: String(mark),
      rx: '2.5',
    });

  for (const [row, indicator] of CONTROL_ROWS.entries()) {
    const y = rowTop + row * rowStep;

    const name = svg('text', { class: 'sv-row-name', x: String(nameRight), y: (y + 3.2).toFixed(1) });
    name.textContent = indicator;
    board.appendChild(name);

    board.appendChild(
      svg('line', {
        class: 'sv-track',
        'vector-effect': 'non-scaling-stroke',
        x1: String(trackLeft),
        y1: y.toFixed(1),
        x2: String(trackRight),
        y2: y.toFixed(1),
      }),
    );

    if (row === CONTROL_VARIED) {
      const spread = [trackLeft + 28, (trackLeft + trackRight) / 2, trackRight - 26];
      for (const [index, x] of spread.entries()) {
        board.appendChild(mark_(x, y, true));
        const letter = svg('text', {
          class: 'sv-alt-letter',
          x: x.toFixed(1),
          y: (y - mark / 2 - 3).toFixed(1),
        });
        letter.textContent = String.fromCharCode(65 + index);
        board.appendChild(letter);
      }
      continue;
    }

    // Held inside a narrow randomised window, which is why the three marks
    // overlap and why the window is not in the same place on every row.
    const centre = (trackLeft + trackRight) / 2 + (jitter(row) - 0.5) * 26;
    for (const offset of [-7, 0, 7]) board.appendChild(mark_(centre + offset, y, false));
  }

  return board;
};

/* ---- How a generated case is labelled ------------------------------------------ */

const GENERATED_BOARD = { width: 564, height: 100 } as const;

/** What the system prompt fixes, §3.2.2. The six are named rather than counted. */
const PROMPT_FACETS = [
  'Assessment role',
  'Indicator set',
  'How each is read',
  'Stakeholder archetypes',
  'Applications',
  'Output format',
] as const;

/**
 * The labelling pipeline, end to end.
 *
 * This is the part of the corpus a committee presses on, so the whole of it is
 * drawn: what the prompt constrains, what comes back, and what happens to a
 * label the model could not resolve. Neither field carries a value, because the
 * beat is about the mechanism and the values belong to the samples.
 */
const generatedDiagram = (): SVGSVGElement => {
  const board = svg('svg', {
    class: 'sv-diagram',
    viewBox: `0 0 ${GENERATED_BOARD.width} ${GENERATED_BOARD.height}`,
  });

  const title = (text: string, x: number): SVGTextElement => {
    const node = svg('text', { class: 'sv-diagram-label', 'data-kind': 'faint', x: String(x), y: '9' });
    node.textContent = text;
    return node;
  };

  /* What goes in. */
  board.appendChild(title('The prompt fixes', 0));
  board.appendChild(
    svg('rect', { class: 'sv-panel', x: '0', y: '16', width: '150', height: '80', rx: '5' }),
  );
  for (const [index, facet] of PROMPT_FACETS.entries()) {
    const y = 30 + index * 12;
    board.appendChild(
      svg('rect', { class: 'sv-bullet', x: '10', y: String(y - 3.5), width: '3.5', height: '3.5' }),
    );
    const node = svg('text', { class: 'sv-field', x: '19', y: String(y) });
    node.textContent = facet;
    board.appendChild(node);
  }

  const feed = (from: number, to: number, y: number, kind = ''): SVGPathElement =>
    svg('path', {
      class: `sv-feed ${kind}`.trim(),
      'vector-effect': 'non-scaling-stroke',
      d: `M ${from} ${y} L ${to} ${y}`,
    });

  board.appendChild(feed(154, 182, 56));

  board.appendChild(
    svg('rect', { class: 'sv-node', x: '186', y: '44', width: '66', height: '24', rx: '5' }),
  );
  const model = svg('text', { class: 'sv-node-label', x: '219', y: '59.5' });
  model.textContent = GENERATION.model;
  board.appendChild(model);

  board.appendChild(feed(256, 282, 56));

  /* What comes back. */
  board.appendChild(title('Every label returns', 286));
  board.appendChild(
    svg('rect', { class: 'sv-panel', x: '286', y: '16', width: '124', height: '80', rx: '5' }),
  );
  for (const [index, field] of ['Preference score', 'Self-reported confidence'].entries()) {
    const node = svg('text', { class: 'sv-field', x: '296', y: String(42 + index * 24) });
    node.textContent = field;
    board.appendChild(node);
    board.appendChild(
      svg('rect', {
        class: 'sv-field-mark',
        'data-kind': index === 0 ? 'score' : 'confidence',
        x: '296',
        y: String(48 + index * 24),
        width: '84',
        height: '5',
        rx: '2.5',
      }),
    );
  }

  /* What happens to it. A confident label is weighted in; one the model could
     not resolve never enters the corpus. */
  board.appendChild(
    svg('path', {
      class: 'sv-feed sv-feed-kept',
      'vector-effect': 'non-scaling-stroke',
      d: 'M 414 56 C 428 56, 430 34, 444 34',
    }),
  );
  board.appendChild(
    svg('path', {
      class: 'sv-feed sv-feed-dropped',
      'vector-effect': 'non-scaling-stroke',
      d: 'M 414 56 C 428 56, 430 80, 444 80',
    }),
  );

  const outcome = (text: string, y: number, kind: string): SVGTextElement => {
    const node = svg('text', { class: 'sv-outcome', 'data-kind': kind, x: '450', y: String(y) });
    node.textContent = text;
    return node;
  };
  board.appendChild(outcome('Kept, weighted by', 32, 'kept'));
  board.appendChild(outcome('its own confidence', 43, 'kept'));
  board.appendChild(outcome('No clear ordering:', 78, 'dropped'));
  board.appendChild(outcome('discarded', 89, 'dropped'));

  return board;
};

/* ---- How the expert batches are laid out ---------------------------------------- */

const EXPERT_BOARD = { width: 380, height: 100 } as const;
const EXPERTS = 6;
const CASES_DRAWN = 4;

/**
 * Six batches that share no scenario, each carrying its own judgement.
 *
 * The columns are labelled, because unlabelled they are a barcode. One cell in
 * every column is the alternative that expert preferred, so the drawing says
 * what an expert case actually is: a set of alternatives and a decision over
 * it. Which row that cell falls on is a function of the column index and
 * carries no claim, since the cases are not published per batch.
 */
const expertDiagram = (): SVGSVGElement => {
  const board = svg('svg', {
    class: 'sv-diagram',
    viewBox: `0 0 ${EXPERT_BOARD.width} ${EXPERT_BOARD.height}`,
  });

  const cellWidth = 46;
  const cellHeight = 10;
  const columnStep = 60;
  const rowStep = 14;
  const left = 4;
  const top = 18;
  for (let expert = 0; expert < EXPERTS; expert += 1) {
    const x = left + expert * columnStep;
    const chosen = Math.floor(jitter(expert * 3) * CASES_DRAWN);

    const head = svg('text', {
      class: 'sv-column-name',
      x: (x + cellWidth / 2).toFixed(1),
      y: '11',
    });
    head.textContent = `E${expert + 1}`;
    board.appendChild(head);

    for (let index = 0; index < CASES_DRAWN; index += 1) {
      board.appendChild(
        svg('rect', {
          class: 'sv-case',
          'data-marked': String(index === chosen),
          x: x.toFixed(1),
          y: (top + index * rowStep).toFixed(1),
          width: String(cellWidth),
          height: String(cellHeight),
          rx: '2',
        }),
      );
    }
  }

  return board;
};

const DIAGRAMS: Readonly<Record<string, () => SVGSVGElement>> = {
  control: controlDiagram,
  generated: generatedDiagram,
  expert: expertDiagram,
};

/* ---- The corpus, and what it is worth -------------------------------------------- */

const RIBBON = { width: 1420, height: 114 } as const;
const BAND_HEIGHT = 24;
const SEGMENT_GAP = 3;

interface Span {
  readonly start: number;
  readonly extent: number;
}

/** Segment spans across the board, with the gaps taken out of the segments. */
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
  const diagram = DIAGRAMS[source.key];

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
      el('div', { className: 'sv-source-figure', children: diagram ? [diagram()] : [] }),
      ...(source.fact ? [el('p', { className: 'sv-detail', text: source.fact })] : []),
      el('p', { className: 'sv-source-gives', text: source.contributes }),
    ],
  });
};

/**
 * Beat 2. Where the labels came from, and what each source is worth.
 *
 * Three sources, each drawn as the method it actually is, and then the same
 * three read twice: what they contributed against the share of the objective
 * they carry. Both bands are the same width, so the ribbons between them are
 * the re-weighting itself. The expert group enters as a sliver and leaves as a
 * fifth of the objective, which is the argument for weighting by source at all.
 *
 * Each card's text carries only what its diagram cannot draw. The diagram shows
 * the method; the lines beside it give the coverage, the provenance and what the
 * group puts into the trained model.
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
        // Six-tenths of one percent is seven pixels wide, so that one readout
        // is hung off the left of its segment rather than centred on a block
        // narrower than the numeral.
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
        text: `${SPLIT.note} The same proportions hold across ${SPLIT.folds} cross-validation folds.`,
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
