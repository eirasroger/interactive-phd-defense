import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './influence-curve.css';

export interface InfluenceCurveSpec {
  /** Design phases, left to right. */
  readonly phases: readonly string[];
  /** How many leading phases the window covers. */
  readonly windowPhases: number;
  readonly influence: string;
  readonly information: string;
  readonly window: string;
  readonly crossing: string;
}

export const CURVE = {
  void: -1,
  /** Influence falling across the phases, and the window it falls in. */
  influence: 0,
  /** Information rising to meet it, and where the two cross. */
  crossing: 1,
} as const;

export type CurveState = (typeof CURVE)[keyof typeof CURVE];

export interface InfluenceCurve {
  readonly element: HTMLElement;
  show(state: CurveState, settle?: boolean): gsap.core.Timeline;
}

/*
 * Influence over the building's impact against the information available to
 * assess it, across the design phases.
 *
 * The two curves are authored, not plotted — there is no dataset behind this
 * and pretending otherwise with a numeric axis would be a claim the figure
 * cannot support. What it does support is the shape: one falls, one rises, and
 * they cross well to the right of where the decisions are made.
 */
const VIEW_W = 880;
const VIEW_H = 350;

const PLOT_L = 16;
const PLOT_R = 864;
const PLOT_T = 84;
const PLOT_B = 300;

const AXIS_Y = PLOT_B + 12;
const PHASE_Y = 336;
/* Both names sit on one line above the plot, at the end where their own curve
   is highest — influence starts high on the left, information ends high on the
   right. Labelling either curve at its low end puts the text on the line. */
const NAME_Y = 54;
const WINDOW_LABEL_Y = 24;

/** Normalised height: 0 is the top of the plot, 1 the bottom. */
const ny = (value: number): number => PLOT_T + (PLOT_B - PLOT_T) * value;

const MID_X = 440;

const INFLUENCE = `M${PLOT_L},${ny(0)} C260,${ny(0.04)} 366,${ny(0.36)} ${MID_X},${ny(0.5)} C540,${ny(0.64)} 700,${ny(0.96)} ${PLOT_R},${ny(1)}`;
const INFORMATION = `M${PLOT_L},${ny(1)} C180,${ny(0.97)} 330,${ny(0.66)} ${MID_X},${ny(0.5)} C560,${ny(0.34)} 700,${ny(0.04)} ${PLOT_R},${ny(0)}`;
const CROSS = { x: MID_X, y: ny(0.5) };

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at?: number;
}

export function createInfluenceCurve(spec: InfluenceCurveSpec): InfluenceCurve {
  const step = (PLOT_R - PLOT_L) / (spec.phases.length - 1);
  const windowRight = PLOT_L + step * (spec.windowPhases - 0.5);

  const phases = spec.phases
    .map((phase, index) => {
      const x = PLOT_L + step * index;
      const anchor = index === 0 ? 'start' : index === spec.phases.length - 1 ? 'end' : 'middle';
      return `<text class="curve-phase" x="${x}" y="${PHASE_Y}" text-anchor="${anchor}">${phase}</text>`;
    })
    .join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'curve-diagram');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<g class="curve-window">
       <rect class="curve-window-fill" x="${PLOT_L}" y="${PLOT_T - 18}" width="${windowRight - PLOT_L}" height="${AXIS_Y - PLOT_T + 18}" rx="6" />
       <path class="curve-window-edge" d="M${windowRight},${PLOT_T - 18} L${windowRight},${AXIS_Y}" />
       <text class="curve-window-label" x="${PLOT_L}" y="${WINDOW_LABEL_Y}">${spec.window}</text>
     </g>` +
    `<line class="curve-axis" x1="${PLOT_L}" y1="${AXIS_Y}" x2="${PLOT_R}" y2="${AXIS_Y}" />` +
    `<g class="curve-phases">${phases}</g>` +
    `<path class="curve-line" data-series="influence" d="${INFLUENCE}" />` +
    `<path class="curve-line" data-series="information" d="${INFORMATION}" />` +
    `<text class="curve-name" data-series="influence" x="${PLOT_L}" y="${NAME_Y}">${spec.influence}</text>` +
    `<text class="curve-name" data-series="information" x="${PLOT_R}" y="${NAME_Y}" text-anchor="end">${spec.information}</text>` +
    `<g class="curve-cross">
       <circle class="curve-cross-dot" cx="${CROSS.x}" cy="${CROSS.y}" r="5.5" />
       <text class="curve-cross-label" x="${CROSS.x + 14}" y="${CROSS.y + 4}">${spec.crossing}</text>
     </g>`;

  const element = el('div', { className: 'influence-curve' });
  element.appendChild(svg);

  const windowGroup = svg.querySelector<SVGGElement>('.curve-window')!;
  const axis = svg.querySelector<SVGLineElement>('.curve-axis')!;
  const phaseLabels = Array.from(svg.querySelectorAll<SVGTextElement>('.curve-phase'));
  const influence = svg.querySelector<SVGPathElement>('[data-series="influence"].curve-line')!;
  const information = svg.querySelector<SVGPathElement>('[data-series="information"].curve-line')!;
  const influenceName = svg.querySelector<SVGTextElement>('[data-series="influence"].curve-name')!;
  const informationName = svg.querySelector<SVGTextElement>(
    '[data-series="information"].curve-name',
  )!;
  const cross = svg.querySelector<SVGGElement>('.curve-cross')!;

  // Path length is only knowable once laid out, and the figure is built before
  // it is appended. A dash as long as the path turns offset into "how much is
  // still to draw".
  let measured = false;
  const lengths = new Map<SVGPathElement, number>();
  const measure = (): void => {
    if (measured) return;
    measured = true;
    for (const path of [influence, information]) {
      const length = path.getTotalLength();
      lengths.set(path, length);
      gsap.set(path, { strokeDasharray: length });
    }
  };

  const plan = (state: CurveState): Step[] => {
    const alive = state >= CURVE.influence;
    const crossed = state >= CURVE.crossing;

    return [
      { node: windowGroup, vars: { opacity: alive ? 1 : 0 }, at: 0.1 },
      { node: axis, vars: { opacity: alive ? 1 : 0 } },
      { node: phaseLabels, vars: { opacity: alive ? 1 : 0 }, at: 0.1 },
      {
        node: influence,
        vars: { strokeDashoffset: alive ? 0 : lengths.get(influence)! },
        at: 0.15,
      },
      { node: influenceName, vars: { opacity: alive ? 1 : 0 }, at: 0.6 },
      {
        node: information,
        vars: { strokeDashoffset: crossed ? 0 : lengths.get(information)! },
        at: 0.1,
      },
      { node: informationName, vars: { opacity: crossed ? 1 : 0 }, at: 0.55 },
      { node: cross, vars: { opacity: crossed ? 1 : 0, x: crossed ? 0 : -8 }, at: 0.7 },
    ];
  };

  return {
    element,

    show(state, settle = false) {
      measure();
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
            duration: seconds(DURATION.slow),
            ease: step.node === influence || step.node === information ? 'power1.inOut' : EASE.enter,
            overwrite: 'auto',
          },
          step.at ?? 0,
        );
      }

      return timeline;
    },
  };
}
