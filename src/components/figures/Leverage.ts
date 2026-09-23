import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './leverage.css';

export interface LeverageSpec {
  /** Design phases, left to right. */
  readonly phases: readonly string[];
  /** How many leading phases the window covers. */
  readonly windowPhases: number;
  readonly ability: string;
  readonly cost: string;
  readonly window: string;
  /** Attribution. Omit when the surrounding composition already prints one. */
  readonly source?: string;
}

export const MACLEAMY = {
  void: -1,
  /** Ability to impact the project, falling over time. */
  ability: 0,
  /** Cost of design changes, rising over time. */
  cost: 1,
  /** Bracket under the early phases where the thesis works. Its own beat. */
  window: 2,
} as const;

export type MacLeamyState = (typeof MACLEAMY)[keyof typeof MACLEAMY];

export interface Leverage {
  readonly element: HTMLElement;
  show(state: MacLeamyState, settle?: boolean): gsap.core.Timeline;
}

/*
 * MacLeamy curve: ability to impact the project and cost of design changes
 * across the design phases. Both rise upward from one baseline. The curves are
 * hand-drawn shapes with no numeric axis, since the source has no dataset.
 */
/* The aspect ratio sets the card height. The extra height gives the labels
   below the axis room. */
const VIEW_W = 880;
const VIEW_H = 480;

const PLOT_L = 16;
const PLOT_R = 864;
const PLOT_T = 78;
/** Shared baseline of both areas. */
const PLOT_B = 356;
/** Low end of each curve, just above the baseline. */
const PLOT_FLOOR = 348;

/* Each curve name sits above the plot at the end where that curve is highest. */
const NAME_Y = 46;
/* Phase names alternate between two rows so long neighbours do not touch. */
const PHASE_Y = 386;
const PHASE_DROP = 20;
/* The bracket sits in its own band below both rows of phase names. */
const BRACKET_Y = 444;
const BRACKET_TICK = 8;
const WINDOW_LABEL_Y = 470;

/* Ability holds, drops through the middle phases, then tails off. Cost stays
   flat early, then climbs steeply. */
const ABILITY_CURVE = `C180,83 430,337 ${PLOT_R},${PLOT_FLOOR}`;
const COST_CURVE = `C520,342 760,171 ${PLOT_R},81`;

/* Edge is the stroked curve only. Fill closes it to the baseline, so the
   straight sides get no outline. */
const ABILITY_EDGE = `M${PLOT_L},${PLOT_T} ${ABILITY_CURVE}`;
const COST_EDGE = `M${PLOT_L},${PLOT_FLOOR} ${COST_CURVE}`;

const ABILITY_FILL = `M${PLOT_L},${PLOT_B} L${PLOT_L},${PLOT_T} ${ABILITY_CURVE} L${PLOT_R},${PLOT_B} Z`;
const COST_FILL = `M${PLOT_L},${PLOT_B} L${PLOT_L},${PLOT_FLOOR} ${COST_CURVE} L${PLOT_R},${PLOT_B} Z`;

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at?: number;
}

export function createLeverage(spec: LeverageSpec): Leverage {
  const step = (PLOT_R - PLOT_L) / (spec.phases.length - 1);
  const windowRight = PLOT_L + step * (spec.windowPhases - 0.5);

  const phases = spec.phases
    .map((phase, index) => {
      const x = PLOT_L + step * index;
      const y = PHASE_Y + (index % 2 === 0 ? 0 : PHASE_DROP);
      const anchor = index === 0 ? 'start' : index === spec.phases.length - 1 ? 'end' : 'middle';
      const tick = `<path class="leverage-tick" d="M${x},${PLOT_B} L${x},${y - 10}" />`;
      return `${tick}<text class="leverage-phase" x="${x}" y="${y}" text-anchor="${anchor}">${phase}</text>`;
    })
    .join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'leverage-diagram');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<path class="leverage-fill" data-series="ability" d="${ABILITY_FILL}" />` +
    `<path class="leverage-fill" data-series="cost" d="${COST_FILL}" />` +
    `<line class="leverage-axis" x1="${PLOT_L}" y1="${PLOT_B}" x2="${PLOT_R}" y2="${PLOT_B}" />` +
    `<path class="leverage-edge" data-series="ability" d="${ABILITY_EDGE}" />` +
    `<path class="leverage-edge" data-series="cost" d="${COST_EDGE}" />` +
    `<g class="leverage-phases">${phases}</g>` +
    `<text class="leverage-name" data-series="ability" x="${PLOT_L}" y="${NAME_Y}">${spec.ability}</text>` +
    `<text class="leverage-name" data-series="cost" x="${PLOT_R}" y="${NAME_Y}" text-anchor="end">${spec.cost}</text>` +
    // Bracket under the phases keeps the filled areas clean.
    `<g class="leverage-window">
       <path class="leverage-window-edge" d="M${windowRight},${PLOT_T - 14} L${windowRight},${BRACKET_Y}" />
       <path class="leverage-window-bracket" d="M${PLOT_L},${BRACKET_Y - BRACKET_TICK} L${PLOT_L},${BRACKET_Y} L${windowRight},${BRACKET_Y} L${windowRight},${BRACKET_Y - BRACKET_TICK}" />
       <text class="leverage-window-label" x="${PLOT_L}" y="${WINDOW_LABEL_Y}">${spec.window}</text>
     </g>`;

  const element = el('div', { className: 'leverage' });
  element.appendChild(svg);
  if (spec.source) {
    element.appendChild(el('p', { className: 'leverage-source', text: spec.source }));
  }

  const series = (name: string) => ({
    fill: svg.querySelector<SVGPathElement>(`[data-series="${name}"].leverage-fill`)!,
    edge: svg.querySelector<SVGPathElement>(`[data-series="${name}"].leverage-edge`)!,
    name: svg.querySelector<SVGTextElement>(`[data-series="${name}"].leverage-name`)!,
  });

  const ability = series('ability');
  const cost = series('cost');
  const windowGroup = svg.querySelector<SVGGElement>('.leverage-window')!;
  const axis = svg.querySelector<SVGLineElement>('.leverage-axis')!;
  const phaseAxis = svg.querySelector<SVGGElement>('.leverage-phases')!;

  // Path length is measured lazily, after the figure is in the DOM. The gap is
  // longer than the dash and the retracted offset overshoots, so no round-cap
  // dot leaks at the path end.
  const DASH_GAP = 10;
  const DASH_CLEAR = 4;

  let measured = false;
  const retracted = new Map<SVGPathElement, number>();
  const measure = (): void => {
    if (measured) return;
    measured = true;
    for (const path of [ability.edge, cost.edge]) {
      const length = path.getTotalLength();
      retracted.set(path, length + DASH_CLEAR);
      gsap.set(path, { strokeDasharray: `${length} ${length + DASH_GAP}` });
    }
  };

  const plan = (state: MacLeamyState): Step[] => {
    const open = state >= MACLEAMY.ability;
    const priced = state >= MACLEAMY.cost;
    const bracketed = state >= MACLEAMY.window;

    return [
      { node: axis, vars: { opacity: open ? 1 : 0 } },
      { node: phaseAxis, vars: { opacity: open ? 1 : 0 }, at: 0.1 },
      // Edge draws across the phases, then the area fills in behind it.
      {
        node: ability.edge,
        vars: { strokeDashoffset: open ? 0 : retracted.get(ability.edge)! },
        at: 0.15,
      },
      { node: ability.fill, vars: { opacity: open ? 1 : 0 }, at: 0.45 },
      { node: ability.name, vars: { opacity: open ? 1 : 0 }, at: 0.6 },
      {
        node: cost.edge,
        vars: { strokeDashoffset: priced ? 0 : retracted.get(cost.edge)! },
        at: 0.1,
      },
      { node: cost.fill, vars: { opacity: priced ? 1 : 0 }, at: 0.4 },
      { node: cost.name, vars: { opacity: priced ? 1 : 0 }, at: 0.55 },
      // Window last: where ability is still high and cost still low.
      { node: windowGroup, vars: { opacity: bracketed ? 1 : 0 }, at: 0.15 },
    ];
  };

  return {
    element,

    show(state, settle = false) {
      measure();
      const timeline = gsap.timeline();

      for (const item of plan(state)) {
        if (settle) {
          gsap.set(item.node as gsap.TweenTarget, item.vars);
          continue;
        }
        timeline.to(
          item.node as gsap.TweenTarget,
          {
            ...item.vars,
            duration: seconds(DURATION.slow),
            ease:
              item.node === ability.edge || item.node === cost.edge
                ? 'power1.inOut'
                : EASE.enter,
            overwrite: 'auto',
          },
          item.at ?? 0,
        );
      }

      return timeline;
    },
  };
}
