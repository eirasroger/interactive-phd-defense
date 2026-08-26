import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './loop.css';

export interface LoopReturn {
  /** Index in `stages` this return arrives at. Always before the last stage. */
  readonly to: number;
  /** What the return is called. One word — it sits over the run. */
  readonly label: string;
}

export interface LoopMark {
  /** Index in `stages` the mark rings. */
  readonly at: number;
  /**
   * What happens at that stage, one line per entry.
   *
   * Two short lines rather than one long one: the marks sit over adjacent
   * stages, and a single line wide enough to say something useful runs into
   * its neighbour.
   */
  readonly lines: readonly string[];
}

export interface LoopSpec {
  /** Left to right: raw material through to end of life. Fixed at four. */
  readonly stages: readonly [string, string, string, string];
  /** Tightest first — the diagram stacks them in the order given. Fixed at three. */
  readonly returns: readonly [LoopReturn, LoopReturn, LoopReturn];
  /** Held back for the second beat, and drawn above the chain, not on it. */
  readonly marks: readonly LoopMark[];
}

export interface Loop {
  readonly element: HTMLElement;
  /** The chain, then the returns closing it, tightest first. */
  close(settle?: boolean): gsap.core.Timeline;
  /** The returns fall back and the chain is marked with what actually happens on it. */
  recede(settle?: boolean): gsap.core.Timeline;
}

/*
 * The linear chain runs along the top; the returns come back underneath it.
 *
 * Depth is the encoding, and the only one: a return that arrives further left
 * gives back less, so it is drawn longer, lower, thinner and dimmer. Reuse is
 * the short bright one under the chain, recycling the long dim one at the
 * bottom.
 *
 * Routed orthogonally rather than as nested curves, which is not a stylistic
 * choice. Every return carries a label, and a curve gives text no reliable
 * clearance: the label of a shallow arc sits on the arc, because moving away
 * from the apex is moving into the line. A straight run at a fixed depth gives
 * each return its own horizontal band instead, laid out against itself and
 * never against a neighbour. Nested arcs were tried here and reverted.
 *
 * The band above the chain is empty until the second beat, when the marks land
 * in it. They go above rather than below because everything below is spoken
 * for, and because a mark over a stage reads as a caption on it.
 */
/*
 * 1180 x 334, and the width is the deliberate half.
 *
 * This figure is given the whole 1600 the card leaves, with the claims reading
 * across underneath it rather than down a column beside it. At 820 x 334 that
 * width made it 652px tall and it crowded everything else off the frame. Spread
 * to 1180 the same drawing lands at 453, the chain has room to be read as a
 * chain, and the three returns get bands wide enough to carry their names
 * without touching the runs above them.
 */
const VIEW_W = 1180;
const VIEW_H = 334;

const NODE_W = 200;
const NODE_H = 60;
const NODE_Y = 78;
const NODE_TOP = NODE_Y - NODE_H / 2;
const NODE_BOTTOM = NODE_Y + NODE_H / 2;

/* Four nodes across the width, clear of the value axis in the left margin. */
const CENTERS = [170, 467, 763, 1060] as const;

/**
 * Where each return leaves the last node, and how deep it runs.
 *
 * The two are ordered together and cannot be reordered independently: the
 * tightest return drops nearest the node's left edge and runs highest, which
 * is the only arrangement in which no return crosses another.
 */
const EXITS = [1010, 1060, 1110] as const;
const RUN_Y = [180, 246, 312] as const;

const CORNER = 18;
/** Arrival, just below the node: the head occupies the gap above it. */
const ARRIVE_Y = NODE_BOTTOM + 13;

/*
 * A return is named where it arrives, not over the middle of its run.
 *
 * Centred on the run, `Recycle` sat at the midpoint of a line eight hundred
 * units long, which is a place nothing happens. Set just past the riser it
 * climbs, each name reads into the stage it returns to, and the three fall
 * into a staircase that says the same thing the depths do.
 */
const NAME_INSET = 20;
const NAME_LIFT = 15;
/** Baseline of a mark's first line, in the clear band over the chain. */
const MARK_Y = 14;
const MARK_LEADING = 18;
/** How far a mark's ring stands off the node it rings. */
const RING_INSET = -4;

/** Down from the last node, round the corner, and left along the run. */
const routeFrom = (x: number, runY: number, midX: number): string =>
  `M${x},${NODE_BOTTOM} L${x},${runY - CORNER} Q${x},${runY} ${x - CORNER},${runY} L${midX},${runY}`;

/** On along the run, round the corner, and up into the stage it returns to. */
const routeInto = (midX: number, runY: number, x: number): string =>
  `M${midX},${runY} L${x + CORNER},${runY} Q${x},${runY} ${x},${runY - CORNER} L${x},${ARRIVE_Y}`;

/** A triangle on its tip, pointing up into the node it arrives at. */
const headUp = (x: number): string =>
  `M${x},${NODE_BOTTOM + 2} L${x - 5.5},${ARRIVE_Y} L${x + 5.5},${ARRIVE_Y} Z`;

/** The same, laid on its side for the chain. */
const headRight = (x: number, y: number): string =>
  `M${x},${y} L${x - 10},${y - 5} L${x - 10},${y + 5} Z`;

interface Arc {
  readonly group: SVGGElement;
  readonly from: SVGPathElement;
  readonly into: SVGPathElement;
  readonly head: SVGPathElement;
  readonly name: SVGTextElement;
  lengthFrom: number;
  lengthInto: number;
}


interface Mark {
  readonly group: SVGGElement;
  readonly ring: SVGRectElement;
  readonly label: SVGTextElement;
}

export function createLoop(spec: LoopSpec): Loop {
  const nodes = CENTERS.map(
    (cx, i) => `
      <g class="loop-node">
        <rect x="${cx - NODE_W / 2}" y="${NODE_TOP}" width="${NODE_W}" height="${NODE_H}" rx="10" />
        <text x="${cx}" y="${NODE_Y}" dy="0.35em" text-anchor="middle">${spec.stages[i]}</text>
      </g>`,
  ).join('');

  const chain = [0, 1, 2]
    .map((i) => {
      const x1 = CENTERS[i]! + NODE_W / 2 + 8;
      const tip = CENTERS[i + 1]! - NODE_W / 2 - 4;
      return `
        <g class="loop-step">
          <line x1="${x1}" y1="${NODE_Y}" x2="${tip - 9}" y2="${NODE_Y}" />
          <path d="${headRight(tip, NODE_Y)}" />
        </g>`;
    })
    .join('');

  const returns = spec.returns
    .map((ret, depth) => {
      const exit = EXITS[depth]!;
      const target = CENTERS[ret.to]!;
      const runY = RUN_Y[depth]!;
      // The halves meet at the middle of the run, which is where the draw-on
      // hands over from one to the other.
      const midX = (exit + target) / 2;

      return `
        <g class="loop-return" data-depth="${depth}">
          <path class="loop-return-line" d="${routeFrom(exit, runY, midX)}" />
          <path class="loop-return-line" d="${routeInto(midX, runY, target)}" />
          <path class="loop-return-head" d="${headUp(target)}" />
          <text class="loop-return-name" x="${target + NAME_INSET}" y="${runY - NAME_LIFT}">${ret.label}</text>
        </g>`;
    })
    .join('');

  const marks = spec.marks
    .map((mark) => {
      const cx = CENTERS[mark.at]!;
      const lines = mark.lines
        .map(
          (line, row) =>
            `<tspan x="${cx}" dy="${row === 0 ? 0 : MARK_LEADING}">${line}</tspan>`,
        )
        .join('');
      return `
        <g class="loop-mark">
          <rect class="loop-mark-ring"
            x="${cx - NODE_W / 2 + RING_INSET}" y="${NODE_TOP + RING_INSET}"
            width="${NODE_W - RING_INSET * 2}" height="${NODE_H - RING_INSET * 2}" rx="14" />
          <text class="loop-mark-label" x="${cx}" y="${MARK_Y}" text-anchor="middle">${lines}</text>
        </g>`;
    })
    .join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'loop-diagram');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.setAttribute('aria-hidden', 'true');
  // Returns first, so the nodes they arrive at are drawn over their heads.
  svg.innerHTML =
    `<g class="loop-returns">${returns}</g>` +
    `<g class="loop-chain">${chain}</g>` +
    `<g class="loop-nodes">${nodes}</g>` +
    `<g class="loop-marks">${marks}</g>`;

  const element = el('div', { className: 'loop' });
  element.appendChild(svg);

  const nodeGroups = Array.from(svg.querySelectorAll<SVGGElement>('.loop-node'));
  const steps = Array.from(svg.querySelectorAll<SVGGElement>('.loop-step'));

  const arcs: Arc[] = Array.from(svg.querySelectorAll<SVGGElement>('.loop-return')).map((group) => {
    const lines = group.querySelectorAll<SVGPathElement>('.loop-return-line');
    return {
      group,
      from: lines[0]!,
      into: lines[1]!,
      head: group.querySelector<SVGPathElement>('.loop-return-head')!,
      name: group.querySelector<SVGTextElement>('.loop-return-name')!,
      lengthFrom: 0,
      lengthInto: 0,
    };
  });

  const annotations: Mark[] = Array.from(svg.querySelectorAll<SVGGElement>('.loop-mark')).map(
    (group) => ({
      group,
      ring: group.querySelector<SVGRectElement>('.loop-mark-ring')!,
      label: group.querySelector<SVGTextElement>('.loop-mark-label')!,
    }),
  );

  // Path length is only knowable once the SVG is laid out, and the figure is
  // built before it is appended. Measured on first use, then kept.
  let measured = false;
  const measure = (): void => {
    if (measured) return;
    measured = true;
    for (const arc of arcs) {
      arc.lengthFrom = arc.from.getTotalLength();
      arc.lengthInto = arc.into.getTotalLength();
      // A dash as long as the path turns offset into "how much is missing".
      gsap.set(arc.from, { strokeDasharray: arc.lengthFrom });
      gsap.set(arc.into, { strokeDasharray: arc.lengthInto });
    }
  };

  /** Longer runs take longer to travel, but not proportionally — that drags. */
  const sweep = (length: number): number => seconds(Math.min(0.36 + length / 900, 0.95));

  return {
    element,

    close(settle = false) {
      measure();
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set([...nodeGroups, ...steps], { opacity: 1, y: 0 });
        for (const arc of arcs) {
          gsap.set(arc.group, { opacity: 1 });
          gsap.set([arc.from, arc.into], { strokeDashoffset: 0 });
          gsap.set([arc.head, arc.name], { opacity: 1, x: 0 });
        }
        for (const mark of annotations) {
          gsap.set(mark.group, { opacity: 0 });
          gsap.set(mark.label, { y: 0 });
          gsap.set(mark.ring, { scale: 1 });
        }
        return timeline;
      }

      timeline
        .from(
          nodeGroups,
          {
            opacity: 0,
            y: 12,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: 0.09,
          },
          0,
        )
        .from(
          steps,
          { opacity: 0, duration: seconds(DURATION.quick), stagger: 0.09 },
          seconds(DURATION.instant),
        );

      // One nested timeline per return, so the three read as three statements
      // of the same shape rather than as a wall of overlapping tweens.
      arcs.forEach((arc, depth) => {
        const outward = sweep(arc.lengthFrom);
        const back = sweep(arc.lengthInto);
        const travel = gsap.timeline();

        travel
          .fromTo(
            arc.from,
            { strokeDashoffset: arc.lengthFrom },
            { strokeDashoffset: 0, duration: outward, ease: 'power1.in' },
            0,
          )
          .fromTo(
            arc.into,
            { strokeDashoffset: arc.lengthInto },
            { strokeDashoffset: 0, duration: back, ease: 'power1.out' },
            outward,
          )
          .from(
            arc.head,
            { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.enter },
            outward + back - 0.12,
          )
          .from(
            arc.name,
            { opacity: 0, x: -8, duration: seconds(DURATION.normal), ease: EASE.enter },
            outward + back * 0.45,
          );

        timeline.add(travel, seconds(DURATION.normal) + depth * 0.42);
      });

      // Whatever the next beat did to the figure is undone on the way back in.
      timeline
        .set(
          annotations.map((mark) => mark.group),
          { opacity: 0 },
          0,
        )
        .set(
          arcs.map((arc) => arc.group),
          { opacity: 1 },
          0,
        );

      return timeline;
    },

    recede(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        for (const arc of arcs) gsap.set(arc.group, { opacity: 0.34 });
        for (const mark of annotations) {
          gsap.set(mark.group, { opacity: 1 });
          gsap.set(mark.label, { opacity: 1, y: 0 });
          gsap.set(mark.ring, { opacity: 1, scale: 1 });
        }
        return timeline;
      }

      timeline.to(
        arcs.map((arc) => arc.group),
        { opacity: 0.34, duration: seconds(DURATION.slow), ease: EASE.standard },
        0,
      );

      annotations.forEach((mark, index) => {
        const start = seconds(DURATION.quick) + index * 0.12;

        timeline
          .set(mark.group, { opacity: 1 }, start)
          .fromTo(
            mark.ring,
            { opacity: 0, scale: 1.06, transformOrigin: '50% 50%' },
            { opacity: 1, scale: 1, duration: seconds(DURATION.slow), ease: EASE.enter },
            start,
          )
          .fromTo(
            mark.label,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
            start + 0.08,
          );
      });

      return timeline;
    },
  };
}
