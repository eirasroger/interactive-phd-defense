import gsap from 'gsap';
import { EASE, seconds } from '@/animations/timing';
import plan from '@/config/corridorPlan.json';
import { el } from '@/utilities/dom';
import './contribution-map.css';

export type Lane = 'axis' | 'high' | 'low';

export interface Contribution {
  readonly key: string;
  /** Station name from `narrative.md`. Shown in both layouts. */
  readonly role: string;
  /** Image of the published first page. It carries title and authors. */
  readonly sheet: string;
  readonly journal: string;
  readonly locator: string;
  /** Objective key this paper answers. O4 appears twice by design. */
  readonly answers: string;
  readonly plan: { readonly column: number; readonly lane: Lane };
}

export interface Edge {
  readonly from: string;
  readonly to: string;
}

export interface ContributionMapSpec {
  readonly items: readonly Contribution[];
  readonly edges: readonly Edge[];
}

export interface ContributionMap {
  readonly element: HTMLElement;
  /** The five cards, for the scene's entrance stagger. */
  readonly frames: readonly HTMLElement[];
  /** `PAPERS` shows the row of papers, `PLAN` shows the pipeline diagram. */
  show(state: number, settle?: boolean): gsap.core.Timeline;
}

/*
 * Five paper cards that morph from a row into the pipeline diagram. The same
 * absolutely placed cards move between both layouts, so the audience sees the
 * diagram is built from the papers. Each plan node keeps the top strip of its
 * page so it still looks like a paper.
 */

export const PAPERS = 0;
export const PLAN = 1;

/* ---- Geometry ------------------------------------------------------------ */
/*
 * All values are field units. The stage is a fixed 1920x1080 (`decisions.md`
 * §31). The SVG `viewBox` uses the same units, so edges meet card edges exactly.
 */

/** Sized to fit the plan, the taller of the two layouts. */
const FIELD = plan.field;

/**
 * Row layout. `sheet` keeps the source image aspect (1072x460 at 310 wide is
 * 133) so the page is never stretched.
 */
const ROW = { width: 310, height: 382, pitch: 338, sheet: 133 } as const;

/** Plan geometry lives in `config/corridorPlan.json` (see `config/corridor.ts`). */
const PLAN_BOX = { ...plan.box, sheet: 46 } as const;
const COLUMN_X = plan.columnX;
/** The axis lane sits between the branch lanes, so C2 to C5 is a straight line. */
const LANE_Y: Record<Lane, number> = plan.laneY;

/** Elbow corner radius. */
const BEND = 16;
const ARROW = 9;

/** Vertically centred in the field. */
const ROW_TOP = (FIELD.height - ROW.height) / 2;

/* ---- Choreography -------------------------------------------------------- */

const CUE = {
  release: 0,
  travel: 0.05,
  record: 0,
  edge: 0.72,
} as const;

const SPAN = {
  release: 0.32,
  fade: 0.34,
  /** Duration of the layout morph. */
  travel: 1.2,
  edge: 0.9,
} as const;

const MOVE = {
  release: 'power2.out',
  draw: EASE.standard,
  travel: 'power3.inOut',
} as const;

/** Per-card stagger, so each card is seen moving to its own place. */
const CARD_STEP = 0.07;
const EDGE_STEP = 0.09;

const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at: number;
  readonly duration: number;
  readonly ease: string;
  readonly stagger?: number;
}

/* ---- Edge routing -------------------------------------------------------- */

interface Slot {
  readonly left: number;
  readonly right: number;
  readonly centreY: number;
}

const slotOf = (item: Contribution): Slot => {
  const left = COLUMN_X[item.plan.column] ?? 0;
  return {
    left,
    right: left + PLAN_BOX.width,
    centreY: LANE_Y[item.plan.lane],
  };
};

/**
 * Orthogonal edge with rounded elbows, matching the corridor layout. Same-lane
 * pairs (C1 to C2, C2 to C5) are a plain horizontal line.
 */
const edgePath = (from: Slot, to: Slot): string => {
  const [x1, y1] = [from.right, from.centreY];
  const [x2, y2] = [to.left, to.centreY];
  if (y1 === y2) return `M ${x1} ${y1} H ${x2}`;

  const mid = (x1 + x2) / 2;
  const sign = Math.sign(y2 - y1);
  return [
    `M ${x1} ${y1}`,
    `H ${mid - BEND}`,
    `Q ${mid} ${y1} ${mid} ${y1 + sign * BEND}`,
    `V ${y2 - sign * BEND}`,
    `Q ${mid} ${y2} ${mid + BEND} ${y2}`,
    `H ${x2}`,
  ].join(' ');
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const svg = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

export function createContributionMap(spec: ContributionMapSpec): ContributionMap {
  const indexOfKey = new Map(spec.items.map((item, index) => [item.key, index]));

  const colours = {
    edge: token('--c-border'),
    edgeLit: token('--c-border-strong'),
  };

  // ---- Edges, drawn under the cards --------------------------------------- //

  const canvas = svg('svg', {
    class: 'contribution-plan',
    viewBox: `0 0 ${FIELD.width} ${FIELD.height}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });

  const edges = spec.edges.map((edge) => {
    const from = spec.items[indexOfKey.get(edge.from) ?? -1];
    const to = spec.items[indexOfKey.get(edge.to) ?? -1];
    if (!from || !to) {
      throw new Error(`ContributionMap: edge ${edge.from} → ${edge.to} names an unknown card.`);
    }

    const a = slotOf(from);
    const b = slotOf(to);

    const path = svg('path', { class: 'plan-edge', d: edgePath(a, b) });
    canvas.appendChild(path);

    // If `getTotalLength` throws, the edge skips the draw-on and only fades in.
    let length = 0;
    try {
      length = path.getTotalLength();
    } catch {
      length = 0;
    }
    if (length > 0) {
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
    }

    const head = svg('polygon', {
      class: 'plan-arrow',
      points: [
        `${b.left - ARROW},${b.centreY - 5}`,
        `${b.left},${b.centreY}`,
        `${b.left - ARROW},${b.centreY + 5}`,
      ].join(' '),
    });
    canvas.appendChild(head);

    return { path, length, head };
  });

  // ---- Cards -------------------------------------------------------------- //

  const cards = spec.items.map((item) => {
    // `object-position: top` in an animated-height container crops the page
    // from the bottom, so the masthead stays visible and unscaled.
    const image = el('img', {
      className: 'paper-image',
      attrs: {
        src: item.sheet,
        alt: `${item.key} — published in ${item.journal}`,
        decoding: 'async',
      },
    });
    const sheet = el('div', { className: 'paper-sheet', children: [image] });

    const key = el('span', { className: 'paper-key', text: item.key });
    const role = el('p', { className: 'paper-role', text: item.role });
    const head = el('div', { className: 'paper-head', children: [key, role] });

    const journal = el('p', { className: 'paper-journal', text: item.journal });
    const locator = el('p', { className: 'paper-locator', text: item.locator });
    const answers = el('p', { className: 'paper-answers', text: `Answers ${item.answers}` });
    const record = el('div', {
      className: 'paper-record',
      children: [journal, locator, answers],
    });

    const body = el('div', { className: 'paper-body', children: [head, record] });
    const element = el('article', { className: 'paper-card', children: [sheet, body] });

    return { element, sheet, record, slot: slotOf(item) };
  });

  const field = el('div', { className: 'contribution-field' });
  field.appendChild(canvas);
  for (const card of cards) field.appendChild(card.element);

  const element = el('div', { className: 'contribution-map', children: [field] });

  /* ---- State ------------------------------------------------------------- */

  const boxOf = (card: (typeof cards)[number], index: number, planned: boolean): gsap.TweenVars =>
    planned
      ? {
          x: card.slot.left,
          y: card.slot.centreY - PLAN_BOX.height / 2,
          width: PLAN_BOX.width,
          height: PLAN_BOX.height,
        }
      : {
          x: index * ROW.pitch,
          y: ROW_TOP,
          width: ROW.width,
          height: ROW.height,
        };

  const plan = (state: number, previous: number): Step[] => {
    const steps: Step[] = [];
    const planned = state === PLAN;
    /** True when switching between layouts. */
    const travelling = previous !== state;

    cards.forEach((card, index) => {
      const at = travelling ? CUE.travel + index * CARD_STEP : CUE.release;
      const duration = travelling ? SPAN.travel : SPAN.release;
      const ease = travelling ? MOVE.travel : MOVE.release;

      steps.push(
        {
          node: card.element,
          vars: {
            ...boxOf(card, index, planned),
            borderColor: planned ? colours.edgeLit : colours.edge,
          },
          at,
          duration,
          ease,
        },
        {
          node: card.sheet,
          vars: { height: planned ? PLAN_BOX.sheet : ROW.sheet },
          at,
          duration,
          ease,
        },
        // Journal details are hidden in the plan. They fade out first and back in last.
        {
          node: card.record,
          vars: { opacity: planned ? 0 : 1, y: planned ? -6 : 0 },
          at: planned ? CUE.record : at + duration * 0.45,
          duration: SPAN.fade,
          ease: MOVE.release,
        },
      );
    });

    edges.forEach((edge, index) => {
      const at = planned ? CUE.edge + index * EDGE_STEP : CUE.release;
      steps.push({
        node: edge.path,
        vars: { strokeDashoffset: planned ? 0 : edge.length, opacity: planned ? 1 : 0 },
        at,
        duration: planned ? SPAN.edge : SPAN.release,
        ease: planned ? MOVE.draw : MOVE.release,
      });
      steps.push({
        node: edge.head,
        // Arrowhead appears once its line is mostly drawn.
        vars: { opacity: planned ? 1 : 0 },
        at: planned ? at + SPAN.edge * 0.75 : CUE.release,
        duration: planned ? SPAN.fade : SPAN.release,
        ease: MOVE.release,
      });
    });

    return steps;
  };

  let current = PAPERS;

  return {
    element,
    frames: cards.map((card) => card.element),

    show(state, settle = false) {
      const previous = current;
      current = state;
      const timeline = gsap.timeline();

      for (const step of plan(state, settle ? state : previous)) {
        if (settle) {
          gsap.set(step.node as gsap.TweenTarget, step.vars);
          continue;
        }
        timeline.to(
          step.node as gsap.TweenTarget,
          {
            ...step.vars,
            duration: seconds(step.duration),
            ease: step.ease,
            stagger: seconds(step.stagger ?? 0),
            overwrite: 'auto',
          },
          step.at,
        );
      }

      return timeline;
    },
  };
}
