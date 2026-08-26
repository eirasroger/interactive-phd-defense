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
  /**
   * Attribution, where the figure carries its own.
   *
   * Optional because the composition around it now has an attribution strip of
   * its own, and a source printed twice in one frame is a proofreading error
   * the committee gets to find.
   */
  readonly source?: string;
}

export const MACLEAMY = {
  void: -1,
  /** Ability to impact the project, at its highest and falling. */
  ability: 0,
  /** The cost of design changes rising against it. */
  cost: 1,
  /**
   * The span the thesis works in, bracketed under the first two phases.
   *
   * Its own state rather than a rider on `cost`, because it is the only mark on
   * the figure that is a claim about this work rather than about the published
   * curve. Landing it with the second curve made it one more thing arriving in
   * a busy frame; on its own click it is the conclusion the drawing was built
   * to deliver.
   */
  window: 2,
} as const;

export type MacLeamyState = (typeof MACLEAMY)[keyof typeof MACLEAMY];

export interface Leverage {
  readonly element: HTMLElement;
  show(state: MacLeamyState, settle?: boolean): gsap.core.Timeline;
}

/*
 * The MacLeamy curve: ability to impact the project against the cost of design
 * changes, across the design phases.
 *
 * **Both quantities rise upward from one baseline.** They are opposed in the
 * argument, so the temptation is to oppose them in the drawing and hang the
 * cost below the line. That inverts the claim on sight: a mass growing downward
 * reads as a quantity falling, which is the opposite of what cost does. Up is
 * more, for both, and the story is carried by which one owns which end of the
 * programme.
 *
 * The two curves are **authored, not plotted**. The relationship is published
 * and attributed in `spec.source`; what has never had a dataset behind it is
 * the shape, and a numeric axis would be a claim neither the original nor this
 * drawing can support. What it does support is the form: the ability is spent
 * early, the price arrives late, and construction products are specified inside
 * the window at the front where both are still in the project's favour.
 */
/*
 * 880 x 480, and the height is the deliberate half.
 *
 * The card this stands in is 1096 wide on a fixed surface, so the drawing's
 * aspect ratio is what decides how tall the card is. At 880 x 380 it rendered
 * 473px high and the composition finished halfway down a 952px frame, with the
 * whole bottom band — baseline, two rows of phase names, bracket, bracket label
 * — packed into ninety of those units. Everything below the axis was legible
 * and nothing in it had any air. Taller costs nothing and buys both.
 */
const VIEW_W = 880;
const VIEW_H = 480;

const PLOT_L = 16;
const PLOT_R = 864;
const PLOT_T = 78;
/** The baseline both areas stand on. */
const PLOT_B = 356;
/** Where each curve meets its low end, held clear of the baseline itself. */
const PLOT_FLOOR = 348;

/* Both names sit on one line above the plot, at the end where their own curve
   is highest — the ability peaks on the left, its cost on the right. Labelling
   either at its low end puts the text on the line. */
const NAME_Y = 46;
/* Phase names are the industry's own and several are long enough that
   neighbours touch on one line. They alternate between two rows instead of
   being abbreviated or set smaller: only every second name shares a row, and
   the gap between those is twice the phase step. */
const PHASE_Y = 386;
const PHASE_DROP = 20;
/*
 * The bracket sits in its own band, below both rows of phase names.
 *
 * It used to clear the lower row by fourteen units, which is not an overlap and
 * still reads as one: a rule running a few pixels under a line of type is
 * underlining it. Twenty-six units and its ticks rise into empty space.
 */
const BRACKET_Y = 444;
const BRACKET_TICK = 8;
const WINDOW_LABEL_Y = 470;

/*
 * The ability holds briefly, falls hard through the middle phases, then runs
 * out along a long tail. Cost is the other hand: near flat while nothing is
 * committed, then steep once everything is.
 */
const ABILITY_CURVE = `C180,83 430,337 ${PLOT_R},${PLOT_FLOOR}`;
const COST_CURVE = `C520,342 760,171 ${PLOT_R},81`;

/* The edge is the curve alone and takes the stroke; the fill drops it to the
   baseline. Two paths, so neither area is outlined down its straight sides. */
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
    // A bracket under the phases rather than a tinted band over them: a wash
    // laid across a filled area muddies both, and the span is what has to read.
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

  // Path length is only knowable once laid out, and the figure is built before
  // it is appended. A dash as long as the path turns offset into "how much is
  // still to draw".
  let measured = false;
  const lengths = new Map<SVGPathElement, number>();
  const measure = (): void => {
    if (measured) return;
    measured = true;
    for (const path of [ability.edge, cost.edge]) {
      const length = path.getTotalLength();
      lengths.set(path, length);
      gsap.set(path, { strokeDasharray: length });
    }
  };

  const plan = (state: MacLeamyState): Step[] => {
    const open = state >= MACLEAMY.ability;
    const priced = state >= MACLEAMY.cost;
    const bracketed = state >= MACLEAMY.window;

    return [
      { node: axis, vars: { opacity: open ? 1 : 0 } },
      { node: phaseAxis, vars: { opacity: open ? 1 : 0 }, at: 0.1 },
      // The edge draws itself across the phases and the area fills in behind
      // it, so the shape is watched arriving rather than switched on.
      {
        node: ability.edge,
        vars: { strokeDashoffset: open ? 0 : lengths.get(ability.edge)! },
        at: 0.15,
      },
      { node: ability.fill, vars: { opacity: open ? 1 : 0 }, at: 0.45 },
      { node: ability.name, vars: { opacity: open ? 1 : 0 }, at: 0.6 },
      {
        node: cost.edge,
        vars: { strokeDashoffset: priced ? 0 : lengths.get(cost.edge)! },
        at: 0.1,
      },
      { node: cost.fill, vars: { opacity: priced ? 1 : 0 }, at: 0.4 },
      { node: cost.name, vars: { opacity: priced ? 1 : 0 }, at: 0.55 },
      // Last, and it is the point of the figure: the window sits where the
      // ability is still high and the price still low, and it closes first.
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
