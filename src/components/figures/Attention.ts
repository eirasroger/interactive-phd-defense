import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  APPLICATIONS,
  ATTRIBUTE_FAMILIES,
  CASE_STUDY,
  FEATURES,
  MODEL,
  PRODUCTS,
  type ProductId,
} from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import './c5-palette.css';
import './attention.css';

export interface Attention {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/* ---- The network board ------------------------------------------------------- */

/** SVG board for the model pass. All stage coordinates below are in its units. */
const BOARD = { width: 732, height: 316 } as const;

const RAILS = MODEL.maxAlternatives;
const RAIL_TOP = 92;
const RAIL_STEP = 40;
const railY = (index: number): number => RAIL_TOP + index * RAIL_STEP;
const AXIS = railY((RAILS - 1) / 2);

/** Horizontal extent of each stage, left to right. */
const TOKEN_X = 20;
const INPUT = { start: 34, end: 100 } as const;
const ENCODER = { start: 116, end: 168 } as const;
const ATTEND = { start: 186, end: 352 } as const;
const CONTEXT = { start: 372, end: 478 } as const;
const HEAD = { start: 500, end: 556 } as const;
const SCORE = { start: 574, end: 716 } as const;

/** Vertical bounds shared by the two set-level stage boxes. */
const BOX_TOP = 64;
const BOX_BOTTOM = 292;
const MEAN_X = (CONTEXT.start + CONTEXT.end) / 2;

const CELL_HEIGHT = 26;
const CELL_GAP = 9;

const HEADER_Y = 30;

/** The three bands of the input vector, sized by feature count. */
const INPUT_BANDS = [
  { key: 'attributes', units: FEATURES.attributes * FEATURES.perAttribute },
  { key: 'stakeholder', units: FEATURES.stakeholder },
  { key: 'application', units: FEATURES.application },
] as const;

/**
 * Standard structural scores in arrival order (rails A to E). Kept unsorted
 * because the model is order-invariant.
 */
const arrivalScores = (): readonly { readonly id: ProductId; readonly score: number }[] => {
  const standard = APPLICATIONS.find((entry) => entry.key === 'standard');
  if (!standard) throw new Error('C5: the architecture beat needs the standard structural scores.');
  return PRODUCTS.map((id) => ({ id, score: standard.scores[id] }));
};

const text = (
  content: string,
  className: string,
  attrs: Record<string, string>,
): SVGTextElement => {
  const node = svg('text', { class: className, ...attrs });
  node.textContent = content;
  return node;
};

/* ---- The panel ---------------------------------------------------------------- */

/**
 * Beat 3. Left: the case-study inputs (18 attributes in five families, each a
 * triplet, plus two context vectors, 66 features in total). Right: the model
 * pass that turns a set of those vectors into scores, with the global context
 * drawn as a mean pooled from every rail and fed back into each.
 */
export function createAttention(): Attention {
  /* -- Left: what a concrete alternative carries -- */

  const attributeRows: HTMLElement[] = [];

  const familyBlock = (family: (typeof ATTRIBUTE_FAMILIES)[number]): HTMLElement =>
    el('div', {
      className: 'at-family',
      attrs: { 'data-key': family.key },
      children: [
        el('div', {
          className: 'at-family-head',
          children: [
            el('p', { className: 'at-family-label', text: family.label }),
            el('span', {
              className: 'c5-figure at-family-count',
              text: String(family.attributes.length),
            }),
          ],
        }),
        ...family.attributes.map((attribute) => {
          const row = el('div', {
            className: 'at-attribute',
            children: [
              el('p', { className: 'at-attribute-label', text: attribute }),
              el('span', {
                className: 'at-triplet',
                children: FEATURES.triplet.map((slot) =>
                  el('span', { className: 'at-cell', attrs: { 'data-slot': slot.toLowerCase() } }),
                ),
              }),
            ],
          });
          attributeRows.push(row);
          return row;
        }),
      ],
    });

  /* Two columns filled top to bottom, with no family split across them. */
  const halfway = ATTRIBUTE_FAMILIES.reduce(
    (sum, family) => sum + family.attributes.length + 1,
    0,
  ) / 2;

  let filled = 0;
  const leftFamilies: (typeof ATTRIBUTE_FAMILIES)[number][] = [];
  const rightFamilies: (typeof ATTRIBUTE_FAMILIES)[number][] = [];
  for (const family of ATTRIBUTE_FAMILIES) {
    const rows = family.attributes.length + 1;
    if (filled + rows <= halfway) {
      leftFamilies.push(family);
      filled += rows;
    } else {
      rightFamilies.push(family);
    }
  }

  const families = [leftFamilies, rightFamilies].map((column) =>
    el('div', { className: 'at-column', children: column.map(familyBlock) }),
  );

  const contextBand = (
    key: 'who' | 'what',
    label: string,
    units: number,
  ): HTMLElement =>
    el('div', {
      className: 'at-context-band',
      attrs: { 'data-input': key },
      children: [
        el('div', {
          className: 'at-context-cells',
          children: Array.from({ length: units }, () => el('span', { className: 'at-cell' })),
        }),
        el('p', { className: 'at-context-label', text: label }),
      ],
    });

  const contextRow = el('div', {
    className: 'at-context-row',
    children: [
      contextBand('who', 'Stakeholder archetype', FEATURES.stakeholder),
      contextBand('what', 'Application context', FEATURES.application),
    ],
  });

  const sum = el('div', {
    className: 'at-sum',
    children: [
      el('span', { className: 'c5-figure at-sum-figure', text: String(FEATURES.total) }),
      el('p', { className: 'at-sum-label', text: 'features per alternative' }),
    ],
  });

  const inputs = el('div', {
    className: 'at-inputs',
    children: [
      el('p', { className: 'c5-index', text: CASE_STUDY.label }),
      el('div', {
        className: 'at-ledger',
        children: [el('div', { className: 'at-families', children: families })],
      }),
      contextRow,
      sum,
    ],
  });

  /* -- Right: the model, following Fig. 2 -- */

  const board = svg('svg', {
    class: 'at-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
  });

  const stageMarks: SVGElement[] = [];
  const stageHead = (label: string, centre: number): void => {
    const head = text(label, 'at-stage', { x: String(centre), y: String(HEADER_Y) });
    stageMarks.push(head);
    board.appendChild(head);
  };

  const midOf = (span: { start: number; end: number }): number => (span.start + span.end) / 2;

  stageHead('Input', (TOKEN_X + INPUT.end) / 2);
  stageHead('Encoder', midOf(ENCODER));
  stageHead('Set Transformer', midOf(ATTEND));
  stageHead('Context', midOf(CONTEXT));
  stageHead('Head', midOf(HEAD));
  stageHead('Score', midOf(SCORE));

  /* Set-level stages are boxes enclosing all rails, as in Fig. 2. */
  const attendBox = svg('rect', {
    class: 'at-stage-box',
    x: String(ATTEND.start),
    y: String(BOX_TOP),
    width: String(ATTEND.end - ATTEND.start),
    height: String(BOX_BOTTOM - BOX_TOP),
    rx: '8',
  });
  board.appendChild(attendBox);

  const contextBox = svg('rect', {
    class: 'at-stage-box',
    x: String(CONTEXT.start),
    y: String(BOX_TOP),
    width: String(CONTEXT.end - CONTEXT.start),
    height: String(BOX_BOTTOM - BOX_TOP),
    rx: '8',
  });
  board.appendChild(contextBox);

  const railLines: SVGElement[] = [];
  const inputStrips: SVGElement[] = [];
  const encoders: SVGElement[] = [];
  const heads: SVGElement[] = [];
  const tokens: SVGElement[] = [];
  const scoreBars: SVGRectElement[] = [];

  const scores = arrivalScores();

  const segment = (from: number, to: number, y: number): SVGLineElement =>
    svg('line', {
      class: 'at-rail',
      'vector-effect': 'non-scaling-stroke',
      x1: String(from),
      y1: String(y),
      x2: String(to),
      y2: String(y),
    });

  for (let index = 0; index < RAILS; index += 1) {
    const y = railY(index);

    for (const [from, to] of [
      [INPUT.end, ENCODER.start],
      [ENCODER.end, ATTEND.start],
      [ATTEND.end, CONTEXT.start],
      [CONTEXT.end, HEAD.start],
      [HEAD.end, SCORE.start],
    ] as const) {
      const rail = segment(from, to, y);
      railLines.push(rail);
      board.appendChild(rail);
    }

    const token = svg('g', { class: 'at-token' });
    token.appendChild(
      svg('circle', { class: 'at-token-ring', cx: String(TOKEN_X), cy: String(y), r: '10' }),
    );
    token.appendChild(
      text(scores[index]?.id ?? '', 'at-token-letter', { x: String(TOKEN_X), y: String(y + 3.8) }),
    );
    tokens.push(token);
    board.appendChild(token);

    /* Bands sized by feature count, so the context features line up across rails. */
    const strip = svg('g', { class: 'at-strip' });
    const span = INPUT.end - INPUT.start;
    let cursor = INPUT.start;
    for (const band of INPUT_BANDS) {
      const width = (span - 4) * (band.units / FEATURES.total);
      strip.appendChild(
        svg('rect', {
          class: 'at-band',
          'data-key': band.key,
          x: cursor.toFixed(2),
          y: String(y - 5),
          width: width.toFixed(2),
          height: '10',
          rx: '2.5',
        }),
      );
      cursor += width + 2;
    }
    inputStrips.push(strip);
    board.appendChild(strip);

    const encoder = svg('path', {
      class: 'at-block',
      d:
        `M ${ENCODER.start} ${y - 12} L ${ENCODER.end} ${y - 6.5} ` +
        `L ${ENCODER.end} ${y + 6.5} L ${ENCODER.start} ${y + 12} Z`,
    });
    encoders.push(encoder);
    board.appendChild(encoder);

    const head = svg('rect', {
      class: 'at-block',
      x: String(HEAD.start),
      y: String(y - 8),
      width: String(HEAD.end - HEAD.start),
      height: '16',
      rx: '3.5',
    });
    heads.push(head);
    board.appendChild(head);
  }

  /*
   * Self-attention as a full matrix: one row per attending alternative, one
   * column per attended one. Cells carry no weights since none are measured.
   */
  const matrixCells: SVGRectElement[] = [];
  const cellWidth = (ATTEND.end - ATTEND.start - 16 - CELL_GAP * (RAILS - 1)) / RAILS;
  for (let row = 0; row < RAILS; row += 1) {
    for (let column = 0; column < RAILS; column += 1) {
      const cell = svg('rect', {
        class: 'at-cell-mark',
        'data-self': String(row === column),
        x: (ATTEND.start + 8 + column * (cellWidth + CELL_GAP)).toFixed(2),
        y: String(railY(row) - CELL_HEIGHT / 2),
        width: cellWidth.toFixed(2),
        height: String(CELL_HEIGHT),
        rx: '2',
      });
      matrixCells.push(cell);
      board.appendChild(cell);
    }
  }

  /*
   * Global context: rails converge to one mean vector on the central axis,
   * then diverge back to every rail.
   */
  const converge: SVGPathElement[] = [];
  const diverge: SVGPathElement[] = [];

  for (let index = 0; index < RAILS; index += 1) {
    const y = railY(index);
    converge.push(
      svg('path', {
        class: 'at-pool',
        'vector-effect': 'non-scaling-stroke',
        d:
          `M ${CONTEXT.start} ${y} C ${CONTEXT.start + 22} ${y}, ` +
          `${MEAN_X - 26} ${AXIS}, ${MEAN_X - 11} ${AXIS}`,
      }),
    );
    diverge.push(
      svg('path', {
        class: 'at-pool at-pool-out',
        'vector-effect': 'non-scaling-stroke',
        d:
          `M ${MEAN_X + 11} ${AXIS} C ${MEAN_X + 26} ${AXIS}, ` +
          `${CONTEXT.end - 22} ${y}, ${CONTEXT.end} ${y}`,
      }),
    );
  }

  const poolGroup = svg('g', { class: 'at-pools' });
  for (const path of [...converge, ...diverge]) poolGroup.appendChild(path);
  board.appendChild(poolGroup);

  const meanNode = svg('g', { class: 'at-mean' });
  meanNode.appendChild(
    svg('circle', { class: 'at-mean-halo', cx: String(MEAN_X), cy: String(AXIS), r: '19' }),
  );
  meanNode.appendChild(
    svg('circle', { class: 'at-mean-core', cx: String(MEAN_X), cy: String(AXIS), r: '11' }),
  );
  board.appendChild(meanNode);

  /* Output scores, in arrival order. */
  for (const [index, entry] of scores.entries()) {
    const y = railY(index);
    board.appendChild(
      svg('rect', {
        class: 'at-score-track',
        x: String(SCORE.start),
        y: String(y - 5),
        width: String(SCORE.end - SCORE.start),
        height: '10',
        rx: '5',
      }),
    );
    const best = Math.max(...scores.map((other) => other.score));
    const bar = svg('rect', {
      class: 'at-score-fill',
      'data-lead': String(entry.score === best),
      x: String(SCORE.start),
      y: String(y - 5),
      width: ((SCORE.end - SCORE.start) * entry.score).toFixed(2),
      height: '10',
      rx: '5',
    });
    scoreBars.push(bar);
    board.appendChild(bar);
  }

  const field = el('div', {
    className: 'c5-field at-field',
    children: [el('div', { className: 'at-board-frame', children: [board] })],
  });

  const properties = [
    { figure: MODEL.invariance, label: MODEL.invarianceNote },
    {
      figure: `${MODEL.minAlternatives} to ${MODEL.maxAlternatives}`,
      label: 'Alternatives per set',
    },
    { figure: MODEL.parameters.toLocaleString('en-GB'), label: 'Trainable parameters' },
  ].map((property) =>
    el('div', {
      className: 'at-property',
      children: [
        el('p', { className: 'at-property-figure', text: property.figure }),
        el('p', { className: 'at-property-label', text: property.label }),
      ],
    }),
  );

  const network = el('div', {
    className: 'at-network',
    children: [
      el('p', { className: 'c5-index', text: 'Model architecture' }),
      field,
      el('div', { className: 'at-properties', children: properties }),
    ],
  });

  const element = el('div', {
    className: 'c5 at',
    children: [inputs, network],
  });

  const parts = [inputs, network];
  const meanCore = meanNode.querySelector('.at-mean-core') as SVGCircleElement;
  const meanHalo = meanNode.querySelector('.at-mean-halo') as SVGCircleElement;

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([...parts, ...attributeRows, ...properties], { opacity: 1, x: 0, y: 0 });
    gsap.set([...railLines, ...inputStrips, ...encoders, ...heads, ...tokens], { opacity: 1 });
    gsap.set([attendBox, contextBox, ...stageMarks], { opacity: 1, y: 0 });
    gsap.set(matrixCells, { opacity: 1, scale: 1, transformOrigin: 'center center' });
    gsap.set([...converge, ...diverge, meanNode], { opacity: 1 });
    gsap.set([meanCore, meanHalo], { scale: 1 });
    gsap.set(scoreBars, { scaleX: 1 });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      gsap.set(element, { opacity: 1 });

      if (settle) {
        settleTo();
        return null;
      }

      const line = gsap.timeline();

      return (
        line
          .from(
            inputs,
            { opacity: 0, x: -20, duration: seconds(DURATION.slow), ease: EASE.enter },
            0,
          )
          .from(
            attributeRows,
            {
              opacity: 0,
              y: 8,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.35),
            },
            seconds(DURATION.quick),
          )
          .from(
            field,
            {
              opacity: 0,
              scale: 0.97,
              transformOrigin: 'center center',
              duration: seconds(DURATION.cinematic),
              ease: EASE.enter,
            },
            seconds(DURATION.quick * 1.4),
          )
          .from(
            stageMarks,
            {
              opacity: 0,
              y: 6,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.9),
            },
            seconds(DURATION.slow * 0.9),
          )
          // Animated in pass order: inputs, encoding, then attention.
          .from(
            [...tokens, ...inputStrips],
            {
              opacity: 0,
              x: -12,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.7),
            },
            seconds(DURATION.slow),
          )
          .from(
            railLines,
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.standard,
              stagger: seconds(STAGGER * 0.7),
            },
            seconds(DURATION.slow * 1.1),
          )
          .from(
            encoders,
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.7),
            },
            seconds(DURATION.cinematic * 0.85),
          )
          .from(
            [attendBox, contextBox],
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 2),
            },
            seconds(DURATION.cinematic * 0.95),
          )
          // The matrix fills row by row.
          .from(
            matrixCells,
            {
              opacity: 0,
              scale: 0.4,
              transformOrigin: 'center center',
              duration: seconds(DURATION.normal),
              ease: 'back.out(1.6)',
              stagger: { each: seconds(STAGGER * 0.28), from: 'start' },
            },
            seconds(DURATION.cinematic * 1.15),
          )
          /* Pool to the mean vector, then feed it back to every rail. */
          .from(
            converge,
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.8),
            },
            seconds(DURATION.cinematic * 1.6),
          )
          .fromTo(
            [meanHalo, meanCore],
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: seconds(DURATION.slow),
              ease: 'back.out(2)',
              stagger: seconds(STAGGER),
            },
            seconds(DURATION.cinematic * 1.85),
          )
          .from(
            diverge,
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.8),
            },
            seconds(DURATION.cinematic * 2.1),
          )
          .from(
            heads,
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.7),
            },
            seconds(DURATION.cinematic * 2.3),
          )
          .fromTo(
            scoreBars,
            { scaleX: 0 },
            {
              scaleX: 1,
              transformOrigin: 'left center',
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.9),
            },
            seconds(DURATION.cinematic * 2.4),
          )
          .from(
            properties,
            {
              opacity: 0,
              y: 10,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.4),
            },
            seconds(DURATION.cinematic * 2.6),
          )
      );
    },
  };
}
