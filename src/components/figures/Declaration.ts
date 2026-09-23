import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './declaration.css';

export interface DeclaredModule {
  /** EN 15804 module range as printed on the EPD. */
  readonly code: string;
  readonly name: string;
  /** Data basis of the module. Shown only in the `basis` state. */
  readonly basis: string;
  /** True below the gate (scenario data); false above it (primary data). */
  readonly scenario: boolean;
}

export interface DeclarationSpec {
  readonly product: string;
  readonly unit: string;
  /** Label of the rule between primary-data and scenario modules. */
  readonly gate: string;
  /** Verdict text shown under each module code. */
  readonly verdicts: {
    readonly primary: string;
    readonly scenario: string;
  };
  readonly modules: readonly DeclaredModule[];
  readonly indicator: {
    readonly name: string;
    readonly value: string;
    readonly unit: string;
  };
}

export const DECLARATION = {
  void: -1,
  /** The EPD as published: modules and one declared value. */
  declared: 0,
  /** Adds each module's data basis, the gate and the uncertainty bracket. */
  basis: 1,
} as const;

export type DeclarationState = (typeof DECLARATION)[keyof typeof DECLARATION];

export interface Declaration {
  readonly element: HTMLElement;
  show(state: DeclarationState, settle?: boolean): gsap.core.Timeline;
}

/*
 * One EPD and the basis of its modules. In the `basis` state the gate rule
 * splits the stack, scenario modules empty (same style as `ImpactMethod`), and
 * the declared value gains an error-bar bracket. The value itself never changes.
 */
const VIEW_W = 880;
const VIEW_H = 396;

/*
 * Each module row has two lines: code and name on top, verdict and basis below.
 * This gives the text the full row width.
 */
const STACK_W = 640;
const STACK_TOP = 26;
const ROW_H = 58;
const ROW_GAP = 6;
/** Larger than `ROW_GAP` so the gate split is visible. */
const GATE_GAP = 40;

/** Two text columns: code over verdict, name over basis. */
const CODE_X = 18;
const NAME_X = 128;
const LINE_ONE_DY = 23;
const LINE_TWO_DY = 46;

const IDENTITY_Y = 14;

const GATE_RULE_H = 2;
/** Label sits below the rule to avoid the row above. */
const GATE_LABEL_DY = 14;

const AXIS_X = 706;
const TICK_X = 686;
const TICK_W = 40;
const TICK_H = 3;
const RANGE_H = 200;
/** Wider than the tick so the caps frame it. */
const RANGE_CAP = 48;
const VALUE_X = 742;
const VALUE_UNIT_DY = 28;

/** Dash patterns. The solid one is the tween start. */
const STROKE_SOLID = '40 0';
const STROKE_DASHED = '6 5';

/** Resolves a CSS colour token, since GSAP needs concrete values. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at?: number;
  readonly duration?: number;
  readonly ease?: string;
}

/** Error-bar path (stem and two caps) centred on the tick. */
const bracket = (tickY: number): string => {
  const top = tickY - RANGE_H / 2;
  const bottom = tickY + RANGE_H / 2;
  const left = AXIS_X - RANGE_CAP / 2;
  const right = AXIS_X + RANGE_CAP / 2;
  return `M${AXIS_X},${top} V${bottom} M${left},${top} H${right} M${left},${bottom} H${right}`;
};

export function createDeclaration(spec: DeclarationSpec): Declaration {
  const gateIndex = spec.modules.findIndex((module) => module.scenario);
  if (gateIndex < 1) {
    throw new Error(
      'Declaration: the gate is drawn between the primary-data modules and the rest, ' +
        'so at least one module must precede the first scenario one.',
    );
  }

  const rowY = (index: number): number =>
    STACK_TOP + index * (ROW_H + ROW_GAP) + (index >= gateIndex ? GATE_GAP - ROW_GAP : 0);

  const stackBottom = rowY(spec.modules.length - 1) + ROW_H;
  const gateY = rowY(gateIndex) - GATE_GAP / 2;
  /** Centred on the stack so the bracket opens evenly up and down. */
  const tickY = (STACK_TOP + stackBottom) / 2;

  const modules = spec.modules
    .map((module, index) => {
      const y = rowY(index);
      const one = y + LINE_ONE_DY;
      const two = y + LINE_TWO_DY;
      const verdict = module.scenario ? spec.verdicts.scenario : spec.verdicts.primary;
      return `
        <g class="declaration-module" data-scenario="${module.scenario}">
          <rect class="declaration-module-fill" x="0" y="${y}" width="${STACK_W}" height="${ROW_H}" rx="6" />
          <rect class="declaration-module-frame" x="0" y="${y}" width="${STACK_W}" height="${ROW_H}" rx="6" />
          <text class="declaration-module-code" x="${CODE_X}" y="${one}">${module.code}</text>
          <text class="declaration-module-name" x="${NAME_X}" y="${one}">${module.name}</text>
          <text class="declaration-module-verdict" x="${CODE_X}" y="${two}">${verdict}</text>
          <text class="declaration-module-basis" x="${NAME_X}" y="${two}">${module.basis}</text>
        </g>`;
    })
    .join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'declaration-diagram');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<g class="declaration-identity">
       <text class="declaration-product" x="0" y="${IDENTITY_Y}">${spec.product}</text>
       <text class="declaration-unit" x="${STACK_W}" y="${IDENTITY_Y}" text-anchor="end">${spec.unit}</text>
     </g>` +
    `<g class="declaration-modules">${modules}</g>` +
    `<g class="declaration-gate">
       <rect class="declaration-gate-rule" x="0" y="${gateY - GATE_RULE_H / 2}" width="${STACK_W}" height="${GATE_RULE_H}" rx="1" />
       <text class="declaration-gate-label" x="${STACK_W}" y="${gateY + GATE_LABEL_DY}" text-anchor="end">${spec.gate}</text>
     </g>` +
    // Bracket before tick so the tick draws on top.
    `<g class="declaration-value">
       <text class="declaration-indicator" x="${TICK_X}" y="${IDENTITY_Y}">${spec.indicator.name}</text>
       <line class="declaration-axis" x1="${AXIS_X}" y1="${STACK_TOP}" x2="${AXIS_X}" y2="${stackBottom}" />
       <path class="declaration-range" d="${bracket(tickY)}" />
       <rect class="declaration-tick" x="${TICK_X}" y="${tickY - TICK_H / 2}" width="${TICK_W}" height="${TICK_H}" rx="1.5" />
       <text class="declaration-amount" x="${VALUE_X}" y="${tickY}" dy="0.32em">${spec.indicator.value}</text>
       <text class="declaration-amount-unit" x="${VALUE_X}" y="${tickY + VALUE_UNIT_DY}">${spec.indicator.unit}</text>
     </g>`;

  const element = el('div', { className: 'declaration' });
  element.appendChild(svg);

  const identity = svg.querySelector<SVGGElement>('.declaration-identity')!;
  const moduleNodes = Array.from(svg.querySelectorAll<SVGGElement>('.declaration-module')).map(
    (group, index) => ({
      group,
      scenario: spec.modules[index]!.scenario,
      fill: group.querySelector<SVGRectElement>('.declaration-module-fill')!,
      frame: group.querySelector<SVGRectElement>('.declaration-module-frame')!,
      name: group.querySelector<SVGTextElement>('.declaration-module-name')!,
      annotation: [
        group.querySelector<SVGTextElement>('.declaration-module-verdict')!,
        group.querySelector<SVGTextElement>('.declaration-module-basis')!,
      ],
    }),
  );
  const gateRule = svg.querySelector<SVGRectElement>('.declaration-gate-rule')!;
  const gateLabel = svg.querySelector<SVGTextElement>('.declaration-gate-label')!;
  const axis = svg.querySelector<SVGLineElement>('.declaration-axis')!;
  const indicator = svg.querySelector<SVGTextElement>('.declaration-indicator')!;
  const range = svg.querySelector<SVGPathElement>('.declaration-range')!;
  const tick = svg.querySelector<SVGRectElement>('.declaration-tick')!;
  const amount = [
    svg.querySelector<SVGTextElement>('.declaration-amount')!,
    svg.querySelector<SVGTextElement>('.declaration-amount-unit')!,
  ];

  const colours = {
    frame: token('--c-border-strong'),
    emphasis: token('--c-emphasis'),
    name: token('--c-text-muted'),
    nameScenario: token('--c-text-faint'),
  };

  const plan = (state: DeclarationState): Step[] => {
    const alive = state >= DECLARATION.declared;
    const shown = state >= DECLARATION.basis;

    const steps: Step[] = [
      { node: identity, vars: { opacity: alive ? 1 : 0, y: alive ? 0 : -8 }, at: 0 },
      { node: [axis, indicator], vars: { opacity: alive ? 1 : 0 }, at: 0.1 },
      {
        node: tick,
        vars: { opacity: alive ? 1 : 0, scaleX: alive ? 1 : 0, svgOrigin: `${AXIS_X} ${tickY}` },
        at: 0.22,
      },
      { node: amount, vars: { opacity: alive ? 1 : 0, y: alive ? 0 : 12 }, at: 0.3 },
      {
        node: gateRule,
        vars: { opacity: shown ? 1 : 0, scaleX: shown ? 1 : 0, svgOrigin: `0 ${gateY}` },
        at: 0.02,
      },
      { node: gateLabel, vars: { opacity: shown ? 1 : 0 }, at: 0.14 },
      // Bracket opens last and slowest.
      {
        node: range,
        vars: { opacity: shown ? 1 : 0, scaleY: shown ? 1 : 0, svgOrigin: `${AXIS_X} ${tickY}` },
        at: 0.74,
        duration: DURATION.cinematic * 0.65,
      },
    ];

    moduleNodes.forEach((node, index) => {
      // Staggered down the stack.
      const cue = 0.16 + index * 0.085;

      steps.push({
        node: node.group,
        vars: { opacity: alive ? 1 : 0, x: alive ? 0 : -14 },
        at: index * 0.05,
      });
      steps.push({
        node: node.annotation,
        vars: { opacity: shown ? 1 : 0, x: shown ? 0 : -10 },
        at: cue + 0.06,
        duration: DURATION.normal,
      });

      if (!node.scenario) return;

      steps.push({
        node: node.fill,
        vars: { attr: { width: shown ? 0 : STACK_W } },
        at: cue,
        duration: DURATION.slow * 0.7,
        ease: 'power2.inOut',
      });
      steps.push({
        node: node.frame,
        vars: {
          stroke: shown ? colours.emphasis : colours.frame,
          strokeDasharray: shown ? STROKE_DASHED : STROKE_SOLID,
        },
        at: cue,
      });
      steps.push({
        node: node.name,
        vars: { fill: shown ? colours.nameScenario : colours.name },
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
