import gsap from 'gsap';
import { EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './contribution-map.css';

export type Lane = 'axis' | 'high' | 'low';

export interface Contribution {
  readonly key: string;
  /** The station name from `narrative.md`. Survives into the plan. */
  readonly role: string;
  /** The published page. Carries title and authorship; nothing repeats them. */
  readonly sheet: string;
  readonly journal: string;
  readonly locator: string;
  /** The objective key this answers. O4 is claimed twice, on purpose. */
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
  /** The five cards, for the scene's own entrance stagger. */
  readonly frames: readonly HTMLElement[];
  /** `PAPERS` for the five as published, `PLAN` for the pipeline they make. */
  show(state: number, settle?: boolean): gsap.core.Timeline;
}

/*
 * The five papers, and then the pipeline they are.
 *
 * **One set of cards in two layouts, not two figures.** The audience has to see
 * that the diagram is made of the papers they were just shown, or the corridor
 * opens in Act II as a new drawing they have to take on trust. So the cards are
 * absolutely placed, every state computes a full box for each one, and the
 * change is five objects rearranging rather than one composition being swapped
 * for another.
 *
 * **The masthead survives the morph.** In the plan each node keeps a sliver of
 * its own page — the running head, the journal, the year — so a node is still
 * visibly a paper at the size of a diagram box. Fading the sheets out entirely
 * was the first attempt and it turned five documents into five rectangles the
 * moment the beat landed.
 */

export const PAPERS = 0;
export const PLAN = 1;

/* ---- Geometry ------------------------------------------------------------ */
/*
 * All in field units, and the field is a fixed box — the stage is 1920x1080 and
 * does not reflow (`decisions.md` §31), so a layout solved once is solved. The
 * SVG shares the coordinate system through its `viewBox`, which is what lets an
 * edge terminate exactly on a card edge without measuring anything.
 */

/**
 * Sized to the plan, which is the taller layout, and no taller — every unit
 * beyond what the plan needs is dead air under the papers, and it reads as the
 * row having come loose from the heading above it.
 */
const FIELD = { width: 1664, height: 470 } as const;

/**
 * Five across, as published.
 *
 * The sheet's height is its source aspect at this width, so the page is never
 * scaled anisotropically — 1072x460 at 310 wide is 133. Getting this wrong by a
 * pixel is a masthead subtly stretched, which is exactly the tell that separates
 * a document from a picture of one.
 */
const ROW = { width: 310, height: 382, pitch: 338, sheet: 133 } as const;

/**
 * The corridor plan. The column pitch leaves 100 units between cards, which is
 * the run every elbow has to turn in — narrow it and the fan out of C2 stops
 * reading as two routes and starts reading as one thick line.
 */
/**
 * Height is the station name at this width plus its key, and nothing more. The
 * first pass carried the row's proportions into the plan and every node had a
 * third of itself empty — which is what makes a diagram look like a layout that
 * did not fit rather than one that was drawn.
 */
const PLAN_BOX = { width: 300, height: 140, sheet: 46 } as const;
const COLUMN_X = [82, 482, 882, 1282] as const;
/**
 * The axis lane is clear between the two branch lanes, which is what lets
 * C2 → C5 run straight through the middle rather than around anything.
 */
const LANE_Y: Record<Lane, number> = { axis: 236, high: 92, low: 380 };

/** Elbow corner radius. A plan drawing turns corners; it does not kink. */
const BEND = 16;
const ARROW = 9;

/** Centred in the field, which is sized for the plan — the taller layout. */
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
  /** The morph. Long, soft at both ends — five documents crossing the frame. */
  travel: 1.2,
  edge: 0.9,
} as const;

const MOVE = {
  release: 'power2.out',
  draw: EASE.standard,
  travel: 'power3.inOut',
} as const;

/**
 * The cards leave in reading order and arrive in pipeline order, which are not
 * the same order — C5 is last in the row and last in the plan, but C3 and C4
 * swap lanes on the way. Staggering by index is what makes that legible as five
 * objects finding their places rather than one block sliding.
 */
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
 * Orthogonal routing with turned corners, because this is a plan drawing and the
 * corridor it previews is orthogonal. A diagonal between two lanes reads as a
 * relationship; an elbow reads as a route, and these are routes.
 *
 * Same-lane pairs come back as a plain horizontal, which is the whole of
 * C1 → C2 and C2 → C5.
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

  // ---- The edges, under the cards ---------------------------------------- //

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

    // `getTotalLength` is defined for every geometry element, but a browser that
    // disagrees should degrade to an edge that fades rather than to a scene that
    // throws on entry. The resting state is `opacity: 0` in CSS, so a length of
    // zero costs the draw-on and nothing else.
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

  // ---- The five ----------------------------------------------------------- //

  const cards = spec.items.map((item) => {
    // The page itself. `object-position: top` and a container whose height is
    // animated, so shrinking the card slides the page up behind its own window
    // rather than squashing it — the masthead stays the masthead at every size.
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
    /** The layout itself changes, in either direction. */
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
        // The record is what the plan has no room for and no use for: a node in
        // a pipeline is a station, and a volume number is not part of what a
        // station does. It goes first and comes back last.
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
        // After its own line has arrived, never before. An arrowhead landing
        // ahead of the route it terminates is a diagram assembling backwards.
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
