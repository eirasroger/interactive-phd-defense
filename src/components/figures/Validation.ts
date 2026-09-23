import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  AGREEMENT,
  APPLICATIONS,
  BEHAVIOUR_STUDIES,
  BEHAVIOUR_TAKEAWAY,
  INDICATORS,
  MODEL_UNCERTAINTY,
  PANEL,
  PRODUCTS,
  SALIENCE,
  SALIENCE_MAX,
  SALIENCE_REMAINING,
  SALIENCE_WEIGHTS,
  STAKEHOLDER_SCENARIOS,
  VALIDATION_BLOCKS,
  type ProductId,
} from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import './c5-palette.css';
import './validation.css';

export interface Validation {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const text = (content: string, className: string, attrs: Record<string, string>): SVGTextElement => {
  const node = svg('text', { class: className, ...attrs });
  node.textContent = content;
  return node;
};

const decimal = (value: number): string => value.toFixed(2);

/** Per-product colour, shared by every figure on the beat. */
const productTone = (id: ProductId): string => `--product: var(--c5-p${id.toLowerCase()})`;

/* ---- Block one: the panel against the model ----------------------------------- */

const PANEL_BOARD = { width: 880, height: 110 } as const;
const P_AXIS = { start: 40, end: 660 } as const;
const P_ROW_TOP = 24;
const P_ROW_STEP = 16;
const P_AXIS_Y = 94;

const atScore = (value: number, span: { start: number; end: number }): number =>
  span.start + (span.end - span.start) * Math.min(Math.max(value, 0), 1);

/**
 * Table 3 as two intervals per product on one axis. Panel width is δ(1 − c)
 * from its reported confidence. Model width is its mean absolute error.
 */
const panelBoard = (): { readonly board: SVGSVGElement; readonly bands: SVGRectElement[] } => {
  const board = svg('svg', {
    class: 'vl-board',
    viewBox: `0 0 ${PANEL_BOARD.width} ${PANEL_BOARD.height}`,
  });
  const bands: SVGRectElement[] = [];

  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    const x = atScore(tick, P_AXIS);
    board.appendChild(
      svg('line', {
        class: 'vl-grid',
        'vector-effect': 'non-scaling-stroke',
        x1: String(x),
        y1: '14',
        x2: String(x),
        y2: String(P_AXIS_Y),
      }),
    );
    board.appendChild(text(tick.toFixed(2), 'vl-axis-label', { x: String(x), y: String(P_AXIS_Y + 13) }));
  }

  for (const [column, x] of [
    ['Expert panel', 730],
    ['Model', 838],
  ] as const) {
    board.appendChild(text(column, 'vl-column-head', { x: String(x), y: '10' }));
  }

  for (const [index, entry] of PANEL.entries()) {
    const y = P_ROW_TOP + index * P_ROW_STEP;

    board.appendChild(
      text(entry.id, 'vl-row-letter', { x: '18', y: String(y + 4), style: productTone(entry.id as ProductId) }),
    );

    const expert = svg('rect', {
      class: 'vl-band vl-band-expert',
      x: atScore(entry.expert - entry.uncertainty, P_AXIS).toFixed(2),
      y: String(y - 6),
      width: (
        atScore(entry.expert + entry.uncertainty, P_AXIS) -
        atScore(entry.expert - entry.uncertainty, P_AXIS)
      ).toFixed(2),
      height: '12',
      rx: '6',
    });
    const model = svg('rect', {
      class: 'vl-band vl-band-model',
      style: productTone(entry.id as ProductId),
      x: atScore(entry.model - MODEL_UNCERTAINTY, P_AXIS).toFixed(2),
      y: String(y - 3),
      width: (
        atScore(entry.model + MODEL_UNCERTAINTY, P_AXIS) -
        atScore(entry.model - MODEL_UNCERTAINTY, P_AXIS)
      ).toFixed(2),
      height: '6',
      rx: '3',
    });
    bands.push(expert, model);
    board.appendChild(expert);
    board.appendChild(model);

    board.appendChild(
      text(`${decimal(entry.expert)} ± ${decimal(entry.uncertainty)}`, 'vl-readout', {
        x: '730',
        y: String(y + 4),
      }),
    );
    board.appendChild(
      text(`${decimal(entry.model)} ± ${decimal(MODEL_UNCERTAINTY)}`, 'vl-readout', {
        'data-kind': 'model',
        x: '838',
        y: String(y + 4),
      }),
    );
  }

  board.appendChild(
    svg('line', {
      class: 'vl-axis',
      'vector-effect': 'non-scaling-stroke',
      x1: String(P_AXIS.start),
      y1: String(P_AXIS_Y),
      x2: String(P_AXIS.end),
      y2: String(P_AXIS_Y),
    }),
  );

  return { board, bands };
};

/* ---- Block two, left: Fig. 7 --------------------------------------------------- */

const WHO_BOARD = { width: 760, height: 104 } as const;
const W_TOP = 8;
const W_BOTTOM = 78;

/** Fig. 7 redrawn at the paper's scale: eight archetypes, five products each. */
const whoBoard = (): { readonly board: SVGSVGElement; readonly bars: SVGRectElement[] } => {
  const board = svg('svg', {
    class: 'vl-board',
    viewBox: `0 0 ${WHO_BOARD.width} ${WHO_BOARD.height}`,
  });
  const bars: SVGRectElement[] = [];

  const left = 34;
  const right = WHO_BOARD.width - 6;
  const groupWidth = (right - left) / STAKEHOLDER_SCENARIOS.length;
  const barWidth = (groupWidth - 10) / PRODUCTS.length;
  const atLevel = (value: number): number => W_BOTTOM - (W_BOTTOM - W_TOP) * value;

  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    const y = atLevel(tick);
    board.appendChild(
      svg('line', {
        class: 'vl-grid',
        'vector-effect': 'non-scaling-stroke',
        x1: String(left - 4),
        y1: y.toFixed(1),
        x2: String(right),
        y2: y.toFixed(1),
      }),
    );
    board.appendChild(
      text(tick.toFixed(2), 'vl-axis-label', { 'data-align': 'end', x: String(left - 8), y: (y + 3.4).toFixed(1) }),
    );
  }

  for (const [group, scenario] of STAKEHOLDER_SCENARIOS.entries()) {
    const originX = left + group * groupWidth + 5;

    for (const [index, id] of PRODUCTS.entries()) {
      const value = scenario.scores[id];
      const x = originX + index * barWidth;
      const bar = svg('rect', {
        class: 'vl-who-bar',
        style: productTone(id),
        x: x.toFixed(2),
        y: atLevel(value).toFixed(2),
        width: (barWidth - 1.5).toFixed(2),
        height: (W_BOTTOM - atLevel(value)).toFixed(2),
        rx: '1.5',
      });
      bars.push(bar);
      board.appendChild(bar);
    }

    board.appendChild(
      text(scenario.code, 'vl-group-name', {
        x: (originX + (barWidth * PRODUCTS.length) / 2 - 1).toFixed(1),
        y: String(W_BOTTOM + 15),
      }),
    );
  }

  board.appendChild(
    svg('line', {
      class: 'vl-axis',
      'vector-effect': 'non-scaling-stroke',
      x1: String(left - 4),
      y1: String(W_BOTTOM),
      x2: String(right),
      y2: String(W_BOTTOM),
    }),
  );

  return { board, bars };
};

/* ---- Block two, right: Fig. 8 --------------------------------------------------- */

const bestOf = (scores: Readonly<Record<ProductId, number>>): ProductId =>
  PRODUCTS.reduce((best, id) => (scores[id] > scores[best] ? id : best));

/** Fig. 8: twenty cells, each printed and tinted by value. */
const applicationGrid = (): { readonly element: HTMLElement; readonly cells: HTMLElement[] } => {
  const cells: HTMLElement[] = [];

  const header = [
    el('span', { className: 'vl-grid-corner' }),
    ...PRODUCTS.map((id) =>
      el('span', { className: 'vl-grid-head', text: id, attrs: { style: productTone(id) } }),
    ),
  ];

  const rows = APPLICATIONS.flatMap((application) => {
    const leader = bestOf(application.scores);

    return [
      el('span', { className: 'vl-grid-row-name', text: application.label }),
      ...PRODUCTS.map((id) => {
        const value = application.scores[id];
        const cell = el('span', {
          className: 'vl-grid-cell',
          attrs: {
            'data-lead': String(id === leader),
            'data-dark': String(value >= 0.7),
            style: `--weight: ${value.toFixed(3)}`,
          },
          text: value.toFixed(2),
        });
        cells.push(cell);
        return cell;
      }),
    ];
  });

  return { cells, element: el('div', { className: 'vl-grid', children: [...header, ...rows] }) };
};

/* ---- Block three: Fig. 10 --------------------------------------------------------- */

/**
 * Three of Fig. 10's four panels on a shared scale, so their spread is
 * comparable. The grey bar sums the seven indicators outside the top ten.
 */
const salienceColumn = (context: (typeof SALIENCE)[number]): {
  readonly element: HTMLElement;
  readonly bars: HTMLElement[];
} => {
  const bars: HTMLElement[] = [];
  const weights = (SALIENCE_WEIGHTS[context.key] ?? []).slice(0, 5);
  const remaining = SALIENCE_REMAINING[context.key] ?? 0;

  const row = (label: string, weight: number, kind: string): HTMLElement => {
    const fill = el('span', {
      className: 'vl-shap-fill',
      attrs: { 'data-kind': kind, style: `--extent: ${((weight / SALIENCE_MAX) * 100).toFixed(2)}%` },
    });
    bars.push(fill);
    return el('div', {
      className: 'vl-shap-row',
      attrs: { 'data-kind': kind },
      children: [
        el('span', { className: 'vl-shap-name', text: label }),
        el('span', { className: 'vl-shap-track', children: [fill] }),
      ],
    });
  };

  return {
    bars,
    element: el('div', {
      className: 'vl-shap',
      children: [
        el('p', { className: 'vl-shap-head', text: context.label }),
        ...weights.map((entry, index) =>
          row(INDICATORS[entry.key], entry.weight, index === 0 ? 'lead' : 'normal'),
        ),
        row('Remaining seven', remaining, 'remaining'),
        el('p', { className: 'vl-shap-note', text: context.concentration }),
      ],
    }),
  };
};

/* ---- The panel --------------------------------------------------------------------- */

/**
 * Beat 4: validation. Three numbered blocks: agreement with the expert panel,
 * behaviour across contexts, and feature importance.
 */
export function createValidation(): Validation {
  const panel = panelBoard();
  const who = whoBoard();
  const application = applicationGrid();
  const salience = SALIENCE.map(salienceColumn);

  const figures = AGREEMENT.figures.map((entry) =>
    el('div', {
      className: 'vl-figure',
      children: [
        el('span', { className: 'c5-figure vl-figure-value', text: entry.figure }),
        el('p', { className: 'vl-figure-label', text: entry.label }),
      ],
    }),
  );

  const block = (index: number, title: string, note: string, body: Element): HTMLElement =>
    el('section', {
      className: 'vl-block',
      children: [
        el('div', {
          className: 'vl-block-head',
          children: [
            el('span', { className: 'c5-figure vl-block-index', text: String(index).padStart(2, '0') }),
            el('p', { className: 'c5-index vl-block-title', text: title }),
            el('p', { className: 'vl-block-note', text: note }),
          ],
        }),
        body,
      ],
    });

  const one = block(
    1,
    VALIDATION_BLOCKS.panel,
    `${AGREEMENT.experts} experts, ${AGREEMENT.scenarios} scenarios. Shown: ${AGREEMENT.scenario.toLowerCase()}.`,
    el('div', {
      className: 'vl-block-body',
      children: [
        el('div', { className: 'vl-board-frame', attrs: { style: '--ratio: 880 / 110' }, children: [panel.board] }),
        el('div', { className: 'vl-figures', children: figures }),
      ],
    }),
  );

  const study = (
    title: string,
    takeaway: string,
    body: Element,
  ): HTMLElement =>
    el('div', {
      className: 'vl-study',
      children: [
        el('p', { className: 'vl-study-title', text: title }),
        body,
        el('p', { className: 'vl-study-takeaway', text: takeaway }),
      ],
    });

  const two = block(
    2,
    VALIDATION_BLOCKS.behaviour,
    '',
    el('div', {
      className: 'vl-block-body',
      attrs: { 'data-split': 'behaviour' },
      children: [
        study(
          BEHAVIOUR_STUDIES.stakeholder.title,
          BEHAVIOUR_STUDIES.stakeholder.takeaway,
          el('div', {
            className: 'vl-board-frame',
            attrs: { style: '--ratio: 760 / 104' },
            children: [who.board],
          }),
        ),
        study(
          BEHAVIOUR_STUDIES.application.title,
          BEHAVIOUR_STUDIES.application.takeaway,
          application.element,
        ),
      ],
    }),
  );

  const three = block(
    3,
    VALIDATION_BLOCKS.importance,
    '',
    el('div', {
      className: 'vl-block-body',
      attrs: { 'data-split': 'importance' },
      children: salience.map((column) => column.element),
    }),
  );

  const takeaway = el('p', { className: 'vl-takeaway', text: BEHAVIOUR_TAKEAWAY });

  const element = el('div', { className: 'c5 vl', children: [one, two, three, takeaway] });

  const blocks = [one, two, three, takeaway];
  const shapBars = salience.flatMap((column) => column.bars);

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([...blocks, ...figures], { opacity: 1, y: 0 });
    gsap.set(panel.bands, { opacity: 1, scaleX: 1 });
    gsap.set(who.bars, { opacity: 1, scaleY: 1 });
    gsap.set(application.cells, { opacity: 1, scale: 1 });
    gsap.set(shapBars, { opacity: 1, scaleX: 1 });
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

      return gsap
        .timeline()
        .from(
          blocks,
          {
            opacity: 0,
            y: 16,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 3),
          },
          0,
        )
        // Per row, the panel band draws first and the model band lands inside it.
        .fromTo(
          panel.bands,
          { scaleX: 0.15, opacity: 0 },
          {
            scaleX: 1,
            opacity: 1,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.6),
          },
          seconds(DURATION.quick),
        )
        .from(
          figures,
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.2),
          },
          seconds(DURATION.slow * 0.9),
        )
        .fromTo(
          who.bars,
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: { each: seconds(STAGGER * 0.16), from: 'start' },
          },
          seconds(DURATION.cinematic * 0.9),
        )
        .from(
          application.cells,
          {
            opacity: 0,
            scale: 0.7,
            transformOrigin: 'center center',
            duration: seconds(DURATION.normal),
            ease: 'back.out(1.5)',
            stagger: { each: seconds(STAGGER * 0.2), from: 'start' },
          },
          seconds(DURATION.cinematic),
        )
        .fromTo(
          shapBars,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: { each: seconds(STAGGER * 0.2), from: 'start' },
          },
          seconds(DURATION.cinematic * 1.35),
        );
    },
  };
}
