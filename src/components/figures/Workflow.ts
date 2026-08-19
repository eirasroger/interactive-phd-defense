import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CHECKPOINT, DOCUMENTS, ENGINE, EPDS, OUTCOMES, RECORDS } from '@/content/c3';
import { el, svg } from '@/utilities/dom';
import './c3-palette.css';
import './workflow.css';

export interface Workflow {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * One mark per input, drawn rather than iconified.
 *
 * Each says what shape the input arrives in: ruled rows inside a frame for a
 * closed list, ragged lines for free text, stacked sheets for a document per
 * product, a framed plan for project documentation. The four cards are
 * otherwise identical, and identical cards are what made the tier unreadable.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  schema: ['M3 3h18v18H3z', 'M3 9h18', 'M3 15h18', 'M9 3v18'],
  text: ['M3 5h14', 'M3 10h18', 'M3 15h11', 'M3 20h16'],
  stack: ['M7 3h10l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M16 3v5h5'],
  drawing: ['M3 4h18v16H3z', 'M3 15l6-6 4 4 3-3 5 5', 'M8 8h.01'],
};

const glyph = (name: string): SVGSVGElement => {
  const board = svg('svg', { class: 'wf-glyph', viewBox: '0 0 24 24' });
  for (const path of GLYPHS[name] ?? []) board.appendChild(svg('path', { d: path }));
  return board;
};

const tier = (index: number, label: string, body: HTMLElement): readonly HTMLElement[] => [
  el('div', {
    className: 'wf-gutter',
    children: [
      el('span', { className: 'wf-gutter-step', text: String(index).padStart(2, '0') }),
      el('span', { className: 'wf-gutter-label', text: label }),
    ],
  }),
  body,
];

/**
 * Fig. 1 as three tiers over one rule.
 *
 * The rule is the composition's strongest horizontal because it is the
 * architecture's only claim: everything above it is a language model reading
 * documents, everything below it is a rule engine executing clauses, and
 * nothing crosses without an operator. Drawn as a chain of boxes and arrows
 * that separation is invisible, which is the whole reason the paper's own
 * schematic needs a caption and this does not.
 */
export function createWorkflow(): Workflow {
  const documents = DOCUMENTS.map((document) => {
    const card = el('div', {
      className: 'wf-doc',
      attrs: { 'data-path': document.path, 'data-source': document.source },
      children: [
        el('div', {
          className: 'wf-doc-head',
          children: [el('p', { className: 'wf-doc-label', text: document.label })],
        }),
        el('p', { className: 'wf-doc-detail', text: document.detail }),
      ],
    });
    card.firstElementChild?.prepend(glyph(document.glyph));
    return card;
  });

  const records = RECORDS.map((record) =>
    el('div', {
      className: 'wf-record',
      attrs: { 'data-key': record.key },
      children: [
        el('p', { className: 'wf-record-label', text: record.label }),
        el('div', {
          className: 'wf-fields',
          children: record.fields.map((field) =>
            el('span', { className: 'wf-field', text: field }),
          ),
        }),
      ],
    }),
  );

  const ruleLine = el('span', { className: 'wf-rule-line' });
  const ruleNode = el('span', {
    className: 'wf-rule-node',
    children: [
      el('span', { className: 'wf-rule-tick' }),
      el('span', { className: 'wf-rule-label', text: CHECKPOINT.label }),
      el('span', { className: 'wf-rule-detail', text: CHECKPOINT.detail }),
    ],
  });
  const rule = el('div', { className: 'wf-rule', children: [ruleLine, ruleNode] });

  const chips = EPDS.map((epd) => el('span', { className: 'wf-chip', text: epd.label }));

  const engine = el('div', {
    className: 'wf-engine',
    children: [
      el('div', {
        className: 'wf-engine-head',
        children: [
          el('p', { className: 'wf-engine-label', text: ENGINE.label }),
          el('p', { className: 'wf-engine-detail', text: ENGINE.detail }),
        ],
      }),
      el('div', { className: 'wf-chips', children: chips }),
    ],
  });

  const bins = OUTCOMES.map((outcome) =>
    el('div', {
      className: 'wf-bin',
      attrs: { 'data-key': outcome.key, 'data-status': outcome.key === 'considered' ? 'pass' : 'fail' },
      children: [el('span', { className: 'wf-bin-label', text: outcome.label })],
    }),
  );

  const verdict = el('div', {
    className: 'wf-verdict',
    children: [engine, el('div', { className: 'wf-bins', children: bins })],
  });

  const grid = el('div', {
    className: 'wf-grid',
    children: [
      ...tier(1, 'Documents', el('div', { className: 'wf-docs', children: documents })),
      ...tier(2, 'Extracted', el('div', { className: 'wf-records', children: records })),
      rule,
      ...tier(3, 'Screened', verdict),
    ],
  });

  const index = el('p', { className: 'c3-index', text: 'One workflow, one point of control' });
  const element = el('div', { className: 'c3 wf', children: [index, grid] });

  const gutters = [...grid.children].filter((node) =>
    node.classList.contains('wf-gutter'),
  ) as HTMLElement[];
  const fields = records.flatMap((record) => [
    ...(record.lastElementChild?.children ?? []),
  ]) as HTMLElement[];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([index, ...gutters, ...documents, ...records, ...fields, engine, ...bins], {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
    });
    gsap.set(ruleLine, { opacity: 1, scaleX: 1 });
    gsap.set(ruleNode, { opacity: 1, y: 0 });
    gsap.set(chips, { opacity: 1, y: 0, scale: 1 });
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
          [index, ...gutters],
          {
            opacity: 0,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.8),
          },
          0,
        )
        .from(
          documents,
          {
            opacity: 0,
            y: -18,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.8),
          },
          seconds(DURATION.quick * 0.4),
        )
        .from(
          records,
          {
            opacity: 0,
            y: 20,
            scale: 0.97,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.4),
          },
          seconds(DURATION.normal * 0.8),
        )
        .from(
          fields,
          {
            opacity: 0,
            y: 8,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.5),
          },
          seconds(DURATION.normal * 1.1),
        )
        // The rule closes across the whole width in one sweep. Everything below
        // it waits for that sweep to land.
        .fromTo(
          ruleLine,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.slow),
            ease: 'power3.inOut',
            transformOrigin: 'left center',
          },
          seconds(DURATION.slow),
        )
        .fromTo(
          ruleNode,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
          seconds(DURATION.slow + DURATION.normal * 0.6),
        )
        .from(
          engine,
          { opacity: 0, y: 18, duration: seconds(DURATION.slow), ease: EASE.enter },
          seconds(DURATION.slow + DURATION.normal),
        )
        .from(
          chips,
          {
            opacity: 0,
            y: 12,
            scale: 0.9,
            duration: seconds(DURATION.normal),
            ease: 'back.out(2)',
            stagger: seconds(STAGGER * 0.6),
          },
          seconds(DURATION.slow + DURATION.normal * 1.3),
        )
        .from(
          bins,
          {
            opacity: 0,
            x: -14,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.2),
          },
          seconds(DURATION.slow + DURATION.normal * 1.6),
        );
    },
  };
}
