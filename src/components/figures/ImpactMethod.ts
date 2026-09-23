import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './impact-method.css';

export interface MethodBand {
  /** LCA, LCC, S-LCA. */
  readonly code: string;
  readonly name: string;
  /** The primary is LCA; the other two complete LCSA. */
  readonly rank: 'primary' | 'secondary';
}

export interface MethodInput {
  readonly label: string;
  /** Known at early design, so this row stays filled in the `missing` state. */
  readonly known?: boolean;
}

export interface ImpactMethodSpec {
  /** Inventory data the method needs. */
  readonly inputs: readonly MethodInput[];
  readonly bands: readonly MethodBand[];
  /** Label under the bands (their sum). */
  readonly sum: string;
  /** Note shown under the inputs in the `missing` state. */
  readonly missing: string;
}

export const METHOD = {
  void: -1,
  /** Method and inputs shown. */
  method: 0,
  /** Unknown inputs drain. */
  missing: 1,
} as const;

export type MethodState = (typeof METHOD)[keyof typeof METHOD];

export interface ImpactMethod {
  readonly element: HTMLElement;
  show(state: MethodState, settle?: boolean): gsap.core.Timeline;
}

/*
 * Impact method diagram: inventory inputs feeding LCA, LCC and S-LCA. In the
 * `missing` state unknown inputs drain and turn dashed, top to bottom, and the
 * method fades back.
 */
const VIEW_W = 880;
const VIEW_H = 268;

const MID_Y = 130;

const INPUT_W = 318;
const INPUT_H = 32;
const INPUT_GAP = 8;

const FEED_X = INPUT_W + 14;
const JOIN_X = 428;
const BAND_X = 452;
const BAND_W = 428;
const BAND_H = 40;
const BAND_GAP = 8;

const SUM_Y = 214;
const SUM_TICK = 7;
const SUM_LABEL_DY = 18;

const MISSING_RULE_Y = MID_Y + 102;
const MISSING_RULE_H = 2;
const MISSING_NOTE_Y = MID_Y + 124;

/** Solid stroke written as a dash pattern so it can tween to dashed. */
const STROKE_SOLID = '40 0';
const STROKE_DASHED = '6 5';

/** Method opacity in the `missing` state. */
const RECEDED = 0.42;

const stackTop = (count: number, height: number, gap: number): number =>
  MID_Y - (count * height + (count - 1) * gap) / 2;

/** Resolves a CSS colour token, since GSAP cannot tween `var()`. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at?: number;
  readonly duration?: number;
  readonly ease?: string;
}

export function createImpactMethod(spec: ImpactMethodSpec): ImpactMethod {
  const inputTop = stackTop(spec.inputs.length, INPUT_H, INPUT_GAP);
  const inputY = (index: number): number => inputTop + index * (INPUT_H + INPUT_GAP);

  const bandTop = stackTop(spec.bands.length, BAND_H, BAND_GAP);
  const bandY = (index: number): number => bandTop + index * (BAND_H + BAND_GAP);

  const inputs = spec.inputs
    .map(({ label }, index) => {
      const y = inputY(index);
      return `
        <g class="method-input">
          <rect class="method-input-fill" x="0" y="${y}" width="${INPUT_W}" height="${INPUT_H}" rx="5" />
          <rect class="method-input-frame" x="0" y="${y}" width="${INPUT_W}" height="${INPUT_H}" rx="5" />
          <text class="method-input-label" x="16" y="${y + INPUT_H / 2}" dy="0.35em">${label}</text>
        </g>`;
    })
    .join('');

  // All feeds converge on one arrow into the method. Each feed has a line and
  // a flow path on the same curve, grouped so dimming the group dims both.
  // `--feed` staggers the flow delay.
  const feeds = spec.inputs
    .map((_, index) => {
      const y = inputY(index) + INPUT_H / 2;
      const d = `M${FEED_X},${y} C${JOIN_X - 60},${y} ${JOIN_X - 60},${MID_Y} ${JOIN_X},${MID_Y}`;
      return `
        <g class="method-feed" style="--feed:${index}">
          <path class="method-feed-line" d="${d}" />
          <path class="method-feed-flow" d="${d}" />
        </g>`;
    })
    .join('');

  const bands = spec.bands
    .map((band, index) => {
      const y = bandY(index);
      return `
        <g class="method-band" data-rank="${band.rank}">
          <rect x="${BAND_X}" y="${y}" width="${BAND_W}" height="${BAND_H}" rx="5" />
          <text class="method-band-code" x="${BAND_X + 18}" y="${y + BAND_H / 2}" dy="0.35em">${band.code}</text>
          <text class="method-band-name" x="${BAND_X + 108}" y="${y + BAND_H / 2}" dy="0.35em">${band.name}</text>
        </g>`;
    })
    .join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'method-diagram');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<g class="method-feeds">${feeds}</g>` +
    `<path class="method-arrow" d="M${BAND_X},${MID_Y} L${BAND_X - 11},${MID_Y - 5.5} L${BAND_X - 11},${MID_Y + 5.5} Z" />` +
    `<g class="method-inputs">${inputs}</g>` +
    `<rect class="method-missing-rule" x="0" y="${MISSING_RULE_Y}" width="${INPUT_W}" height="${MISSING_RULE_H}" rx="1" />` +
    `<text class="method-missing-note" x="0" y="${MISSING_NOTE_Y}">${spec.missing}</text>` +
    `<g class="method-bands">${bands}</g>` +
    `<g class="method-sum">
       <path class="method-sum-rule" d="M${BAND_X},${SUM_Y - SUM_TICK} L${BAND_X},${SUM_Y} L${BAND_X + BAND_W},${SUM_Y} L${BAND_X + BAND_W},${SUM_Y - SUM_TICK}" />
       <text class="method-sum-label" x="${BAND_X + BAND_W / 2}" y="${SUM_Y + SUM_LABEL_DY}" text-anchor="middle">${spec.sum}</text>
     </g>`;

  const element = el('div', { className: 'impact-method' });
  element.appendChild(svg);

  const inputNodes = Array.from(svg.querySelectorAll<SVGGElement>('.method-input')).map(
    (group) => ({
      group,
      fill: group.querySelector<SVGRectElement>('.method-input-fill')!,
      frame: group.querySelector<SVGRectElement>('.method-input-frame')!,
      label: group.querySelector<SVGTextElement>('.method-input-label')!,
    }),
  );
  const feedNodes = Array.from(svg.querySelectorAll<SVGGElement>('.method-feed'));
  const arrow = svg.querySelector<SVGPathElement>('.method-arrow')!;
  const bandNodes = Array.from(svg.querySelectorAll<SVGGElement>('.method-band'));
  const sum = svg.querySelector<SVGGElement>('.method-sum')!;
  const missingRule = svg.querySelector<SVGRectElement>('.method-missing-rule')!;
  const missingNote = svg.querySelector<SVGTextElement>('.method-missing-note')!;

  const colours = {
    frame: token('--c-border-strong'),
    emphasis: token('--c-emphasis'),
    label: token('--c-text'),
    labelMissing: token('--c-text-faint'),
  };

  const plan = (state: MethodState): Step[] => {
    const alive = state >= METHOD.method;
    const missing = state >= METHOD.missing;

    const steps: Step[] = [
      { node: arrow, vars: { opacity: alive ? (missing ? 0.3 : 1) : 0 }, at: 0.05 },
      { node: bandNodes, vars: { opacity: alive ? (missing ? RECEDED : 1) : 0 }, at: 0.05 },
      { node: sum, vars: { opacity: alive ? (missing ? RECEDED : 1) : 0 }, at: 0.05 },
      {
        node: missingRule,
        vars: { scaleX: missing ? 1 : 0, opacity: missing ? 1 : 0 },
        at: 0.52,
      },
      {
        node: missingNote,
        vars: { opacity: missing ? 1 : 0, y: missing ? 0 : 8 },
        at: 0.62,
        duration: DURATION.normal,
      },
    ];

    inputNodes.forEach((node, index) => {
      const drains = missing && !spec.inputs[index]?.known;
      // Staggered down the stack.
      const cue = 0.08 + index * 0.075;

      steps.push({
        node: node.group,
        vars: { opacity: alive ? 1 : 0, x: alive ? 0 : -14 },
        at: index * 0.05,
      });
      steps.push({
        node: node.fill,
        vars: { attr: { width: drains ? 0 : INPUT_W } },
        at: cue,
        duration: DURATION.slow * 0.7,
        ease: 'power2.inOut',
      });
      steps.push({
        node: node.frame,
        vars: {
          stroke: drains ? colours.emphasis : colours.frame,
          strokeDasharray: drains ? STROKE_DASHED : STROKE_SOLID,
        },
        at: cue,
      });
      steps.push({
        node: node.label,
        vars: { fill: drains ? colours.labelMissing : colours.label },
        at: cue + 0.1,
        duration: DURATION.normal,
      });
      // Feeds from known inputs stay lit while the method fades.
      steps.push({
        node: feedNodes[index]!,
        vars: { opacity: alive ? (drains ? 0.16 : 1) : 0 },
        at: alive && !drains ? 0.1 + index * 0.04 : cue,
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
