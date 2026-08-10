import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './candidate-set.css';

export interface Criterion {
  readonly label: string;
  /**
   * One value per candidate, in column order. A criterion with no values is one
   * the stage cannot answer, and the figure exists to say which those are.
   */
  readonly values?: readonly string[];
}

export interface CandidateSetSpec {
  /** Column headers. */
  readonly candidates: readonly string[];
  /** The threshold every candidate has already cleared. */
  readonly gate: {
    readonly label: string;
    readonly value: string;
    readonly note: string;
  };
  readonly criteria: readonly Criterion[];
  /** Named under the rows that stay empty. */
  readonly withheld: string;
}

export const SET = {
  void: -1,
  /** The threshold everyone clears, and everything past it that ought to sort them. */
  criteria: 0,
  /** What can actually be filled in, and what cannot. */
  evidence: 1,
} as const;

export type SetState = (typeof SET)[keyof typeof SET];

export interface CandidateSet {
  readonly element: HTMLElement;
  show(state: SetState, settle?: boolean): gsap.core.Timeline;
}

/*
 * Four candidates for one bay, and what is known about each.
 *
 * **Criteria are rows and candidates are columns**, which is the transpose of
 * the obvious arrangement and the reason the figure works. The claim is about
 * criteria: one is met by everyone, two can be answered, four cannot. Read down
 * a column that is a list of facts about a product; read down the *label*
 * column it is the argument, and the four empty rows sit together as one block
 * of absence instead of being scattered across four narrow headers.
 *
 * **Compliance is drawn above a gate, not as a first criterion.** It is a
 * threshold rather than a comparison: every product on the market has cleared
 * it, so it separates none of them, and putting it in the same stack would
 * invite it to be read as one more column that happens to be full.
 *
 * The drain, the dashes and the amber are `ImpactMethod`'s and `Declaration`'s,
 * unchanged, because they mean the same thing in all three: this is missing,
 * and its absence is the argument. By the third appearance the audience reads
 * it without being told, which is the whole return on keeping one language.
 *
 * What is new here is the direction. Both of those figures show something whole
 * and empty it; this one starts empty and fills two rows of six. The claim is
 * not that evidence was taken away, it is that it never arrives.
 */
const VIEW_W = 880;
const VIEW_H = 392;

const LABEL_W = 250;
const CELL_W = 151;
const CELL_GAP = 8;

const HEADER_Y = 14;

const ROW_H = 32;
const ROW_PITCH = 38;

const GATE_ROW_Y = 30;
const GATE_RULE_Y = 84;
const GATE_RULE_H = 2;
const GATE_LABEL_DY = 16;

const CRITERIA_TOP = 116;

const NOTE_RULE_H = 2;
const NOTE_RULE_Y = 356;
const NOTE_Y = 378;

/** Solid, and the start of the tween that breaks it up. */
const STROKE_SOLID = '40 0';
const STROKE_DASHED = '6 5';

/**
 * The key a column shares with the label anchored to its panel in the world.
 * Exported so the two cannot drift into different numbering.
 */
export const columnKey = (index: number): string => String(index + 1).padStart(2, '0');

const cellX = (index: number): number => LABEL_W + index * (CELL_W + CELL_GAP);
const rowY = (index: number): number => CRITERIA_TOP + index * ROW_PITCH;

/** Tokens are the source of truth for colour, and GSAP needs resolved values. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at?: number;
  readonly duration?: number;
  readonly ease?: string;
}

const cell = (x: number, y: number, value: string, kind: string): string => `
  <g class="candidate-cell" data-kind="${kind}">
    <rect class="candidate-cell-fill" x="${x}" y="${y}" width="${CELL_W}" height="${ROW_H}" rx="5" />
    <rect class="candidate-cell-frame" x="${x}" y="${y}" width="${CELL_W}" height="${ROW_H}" rx="5" />
    ${value ? `<text class="candidate-value" x="${x + CELL_W / 2}" y="${y + ROW_H / 2}" dy="0.34em" text-anchor="middle">${value}</text>` : ''}
  </g>`;

export function createCandidateSet(spec: CandidateSetSpec): CandidateSet {
  const columns = spec.candidates.length;
  for (const criterion of spec.criteria) {
    if (criterion.values && criterion.values.length !== columns) {
      throw new Error(
        `CandidateSet: '${criterion.label}' carries ${criterion.values.length} values for ` +
          `${columns} candidates. Every answerable criterion is answered for all of them.`,
      );
    }
  }

  // Numbers, not names. The candidates are named on the objects themselves, so
  // repeating the names here would be the same four strings twice in one frame
  // — and the columns cannot be aligned to the panels, which is what a shared
  // key solves instead.
  const headers = spec.candidates
    .map(
      (_, index) =>
        `<text class="candidate-column" x="${cellX(index) + CELL_W / 2}" y="${HEADER_Y}" text-anchor="middle">${columnKey(index)}</text>`,
    )
    .join('');

  const gateCells = spec.candidates
    .map((_, index) => cell(cellX(index), GATE_ROW_Y, spec.gate.value, 'met'))
    .join('');

  const rows = spec.criteria
    .map((criterion, index) => {
      const y = rowY(index);
      const kind = criterion.values ? 'answered' : 'withheld';
      const cells = spec.candidates
        .map((_, column) => cell(cellX(column), y, criterion.values?.[column] ?? '', kind))
        .join('');
      return `
        <g class="candidate-row" data-kind="${kind}">
          <text class="candidate-label" x="0" y="${y + ROW_H / 2}" dy="0.34em">${criterion.label}</text>
          ${cells}
        </g>`;
    })
    .join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'candidate-diagram');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<g class="candidate-columns">${headers}</g>` +
    `<g class="candidate-gate">
       <text class="candidate-label" x="0" y="${GATE_ROW_Y + ROW_H / 2}" dy="0.34em">${spec.gate.label}</text>
       ${gateCells}
     </g>` +
    `<g class="candidate-threshold">
       <rect class="candidate-threshold-rule" x="0" y="${GATE_RULE_Y - GATE_RULE_H / 2}" width="${VIEW_W - 2}" height="${GATE_RULE_H}" rx="1" />
       <text class="candidate-threshold-label" x="${VIEW_W - 2}" y="${GATE_RULE_Y + GATE_LABEL_DY}" text-anchor="end">${spec.gate.note}</text>
     </g>` +
    `<g class="candidate-rows">${rows}</g>` +
    `<g class="candidate-note">
       <rect class="candidate-note-rule" x="0" y="${NOTE_RULE_Y}" width="${VIEW_W - 2}" height="${NOTE_RULE_H}" rx="1" />
       <text class="candidate-note-label" x="0" y="${NOTE_Y}">${spec.withheld}</text>
     </g>`;

  const element = el('div', { className: 'candidate-set' });
  element.appendChild(svg);

  const columnLabels = svg.querySelector<SVGGElement>('.candidate-columns')!;
  const gate = svg.querySelector<SVGGElement>('.candidate-gate')!;
  const threshold = svg.querySelector<SVGGElement>('.candidate-threshold')!;
  const thresholdRule = svg.querySelector<SVGRectElement>('.candidate-threshold-rule')!;
  const rowNodes = Array.from(svg.querySelectorAll<SVGGElement>('.candidate-row')).map((group) => ({
    group,
    answered: group.dataset['kind'] === 'answered',
    fills: Array.from(group.querySelectorAll<SVGRectElement>('.candidate-cell-fill')),
    frames: Array.from(group.querySelectorAll<SVGRectElement>('.candidate-cell-frame')),
    values: Array.from(group.querySelectorAll<SVGTextElement>('.candidate-value')),
    label: group.querySelector<SVGTextElement>('.candidate-label')!,
  }));
  const noteRule = svg.querySelector<SVGRectElement>('.candidate-note-rule')!;
  const noteLabel = svg.querySelector<SVGTextElement>('.candidate-note-label')!;

  const colours = {
    frame: token('--c-border-strong'),
    emphasis: token('--c-emphasis'),
    label: token('--c-text'),
    labelWithheld: token('--c-text-faint'),
  };

  const plan = (state: SetState): Step[] => {
    const compared = state >= SET.criteria;
    const answered = state >= SET.evidence;

    const steps: Step[] = [
      { node: columnLabels, vars: { opacity: compared ? 1 : 0, y: compared ? 0 : -8 }, at: 0 },
      { node: gate, vars: { opacity: compared ? 1 : 0, x: compared ? 0 : -14 }, at: 0.08 },
      {
        node: thresholdRule,
        vars: { opacity: compared ? 1 : 0, scaleX: compared ? 1 : 0, svgOrigin: `0 ${GATE_RULE_Y}` },
        at: 0.3,
      },
      { node: threshold, vars: { opacity: compared ? 1 : 0 }, at: 0.3 },
      {
        node: noteRule,
        vars: { opacity: answered ? 1 : 0, scaleX: answered ? 1 : 0, svgOrigin: `0 ${NOTE_RULE_Y}` },
        at: 0.7,
      },
      {
        node: noteLabel,
        vars: { opacity: answered ? 1 : 0, y: answered ? 0 : 8 },
        at: 0.8,
        duration: DURATION.normal,
      },
    ];

    rowNodes.forEach((row, index) => {
      // Down the stack, so the split reads as one movement rather than six.
      const cue = 0.1 + index * 0.07;

      steps.push({
        node: row.group,
        vars: { opacity: compared ? 1 : 0, x: compared ? 0 : -14 },
        at: index * 0.05,
      });

      if (row.answered) {
        steps.push({
          node: row.values,
          vars: { opacity: answered ? 1 : 0, y: answered ? 0 : 10 },
          at: cue,
          duration: DURATION.normal,
        });
        return;
      }

      steps.push({
        node: row.fills,
        vars: { attr: { width: answered ? 0 : CELL_W } },
        at: cue,
        duration: DURATION.slow * 0.7,
        ease: 'power2.inOut',
      });
      steps.push({
        node: row.frames,
        vars: {
          stroke: answered ? colours.emphasis : colours.frame,
          strokeDasharray: answered ? STROKE_DASHED : STROKE_SOLID,
        },
        at: cue,
      });
      steps.push({
        node: row.label,
        vars: { fill: answered ? colours.emphasis : colours.label },
        at: cue + 0.1,
        duration: DURATION.normal,
      });
    });

    return steps;
  };

  return {
    element,

    show(state, settle = false) {
      const timeline = gsap.timeline();

      for (const step of plan(state)) {
        if (settle) {
          gsap.set(step.node as gsap.TweenTarget, step.vars);
          continue;
        }
        timeline.to(
          step.node as gsap.TweenTarget,
          {
            ...step.vars,
            duration: seconds(step.duration ?? DURATION.slow),
            ease: step.ease ?? EASE.enter,
            overwrite: 'auto',
          },
          step.at ?? 0,
        );
      }

      return timeline;
    },
  };
}
