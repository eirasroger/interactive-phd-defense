import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { BACKBONE_NODES, type BackboneNode } from '@/content/act3';
import { el, svg } from '@/utilities/dom';
import { createWipe, hidden, shown, type Wipe } from './wipeMask';
import './backbone.css';

export interface Backbone {
  readonly element: HTMLElement;
  play(settle: boolean): gsap.core.Timeline;
}

/* ---- The board ---------------------------------------------------------------- */

/**
 * One measured board, and every mark placed against it.
 *
 * The SVG owns the geometry and the HTML anchors to it by percentage, so a word
 * and the shape it names cannot drift apart at any stage size. Four columns laid
 * out in CSS would each have to guess where the other three resolved, and the
 * whole point of this board is that the four sit on one line.
 */
const BOARD = { width: 1440, height: 486 } as const;

const MARGIN = 24;
const COLUMN = (BOARD.width - MARGIN * 2) / BACKBONE_NODES.length;
const columnMid = (index: number): number => MARGIN + COLUMN * (index + 0.5);

const SPINE = { y: 50, thickness: 5, glint: 320 } as const;
const RISER = { top: SPINE.y + 4, bottom: 104 } as const;

/** Where the vertebra sits, and how much room it has. */
const NODE = { y: 252, half: 78 } as const;

/**
 * The rows, and why the family sits above the shape.
 *
 * The riser comes down from the spine and lands on the name of what the spine
 * delivers here. Below that is the shape, and below the shape is what the stage
 * asks for and why the ask is its own. Read top to bottom that is: the
 * technology, its form, and the reason the form is different.
 */
const ROW = { family: 116, verb: 386, need: 434 } as const;

const atBoard = (x: number, y: number): string =>
  `left: ${((x / BOARD.width) * 100).toFixed(3)}%; top: ${((y / BOARD.height) * 100).toFixed(3)}%`;

const spanBoard = (width: number): string =>
  `width: ${((width / BOARD.width) * 100).toFixed(3)}%`;

const mark = (
  tag: keyof SVGElementTagNameMap,
  attrs: Record<string, string | number>,
): SVGElement => {
  const written: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) written[name] = String(value);
  return svg(tag, written);
};

/* ---- The vertebrae -------------------------------------------------------------- */

/**
 * Four shapes, and the reason none of them looks like the others.
 *
 * The slide has one thing to say and it is a difference, so the difference has
 * to be visible before anything is read. Each shape is a silhouette first and a
 * diagram second: a wedge, a cross, a target, a fan. From the back of a theatre
 * they are four different objects, and that is the argument. Read closely they
 * are also true, which is what stops them being decoration.
 *
 * Nothing here is measured. This is a discussion slide, and a quantity on it
 * would be the fifth telling of a figure the committee has already read.
 */
interface Vertebra {
  readonly group: SVGGElement;
  build(timeline: gsap.core.Timeline, at: number, motion: number): void;
}

/**
 * Extract — many into one.
 *
 * Documents arriving in whatever shape their author chose, and one reading
 * coming out. A wedge, because convergence is the whole claim.
 */
function extract(cx: number, cy: number): Vertebra {
  const group = svg('g', { class: 'bb-node' });
  const waist = { x: cx + 42, y: cy };

  const strands = Array.from({ length: 9 }, (_, index) => {
    const from = cy + (index - 4) * 17;
    return mark('path', {
      d: `M ${cx - NODE.half} ${from} C ${cx - 4} ${from}, ${cx - 2} ${waist.y}, ${waist.x} ${waist.y}`,
      class: 'bb-strand',
      pathLength: 1,
    });
  });

  const core = mark('circle', { cx: waist.x, cy: waist.y, r: 7, class: 'bb-core' });
  const out = mark('path', {
    d: `M ${waist.x + 7} ${cy} L ${cx + NODE.half} ${cy}`,
    class: 'bb-out',
    pathLength: 1,
  });

  group.append(...strands, out, core);

  return {
    group,
    build(timeline, at, motion) {
      draw(timeline, strands, at, motion, STAGGER * 0.5);
      draw(timeline, [out], at + seconds(0.3) * motion, motion);
      pop(timeline, core, at + seconds(0.34) * motion, motion, 7);
    },
  };
}

/**
 * Screen — the one place a person stands in the pipeline.
 *
 * A channel with a bar across it. The bar is the only warm mark on the slide and
 * it is taller than the channel it interrupts, because what stops here is not a
 * property of the channel.
 */
function screen(cx: number, cy: number): Vertebra {
  const group = svg('g', { class: 'bb-node' });

  const rails = [-12, 12].map((offset) =>
    mark('path', {
      d: `M ${cx - NODE.half} ${cy + offset} L ${cx + NODE.half} ${cy + offset}`,
      class: 'bb-rail',
      pathLength: 1,
    }),
  );

  const held = mark('circle', { cx: cx - 44, cy, r: 8, class: 'bb-held' });
  const passed = mark('circle', { cx: cx + 46, cy, r: 8, class: 'bb-passed' });
  const bar = mark('rect', {
    x: cx - 3,
    y: cy - 48,
    width: 6,
    height: 96,
    rx: 3,
    class: 'bb-gate',
  });

  group.append(...rails, held, passed, bar);

  return {
    group,
    build(timeline, at, motion) {
      draw(timeline, rails, at, motion, STAGGER * 0.5);
      grow(timeline, bar, { y: cy, height: 0 }, { y: cy - 48, height: 96 }, at + seconds(0.16) * motion, motion);
      pop(timeline, held, at + seconds(0.28) * motion, motion, 8);
      pop(timeline, passed, at + seconds(0.42) * motion, motion, 8);
    },
  };
}

/**
 * Estimate — a value that is not there, and how sure the model is that it found
 * it.
 *
 * A core with rings around it, breathing. The dashed side is what arrived
 * incomplete and the solid side is what leaves, still carrying its spread: the
 * shape says *estimate* rather than *value* without a word or a number.
 */
function estimate(cx: number, cy: number): Vertebra {
  const group = svg('g', { class: 'bb-node' });

  const gap = mark('path', {
    d: `M ${cx - NODE.half} ${cy} L ${cx - 26} ${cy}`,
    class: 'bb-gap',
    pathLength: 1,
  });
  const out = mark('path', {
    d: `M ${cx + 26} ${cy} L ${cx + NODE.half} ${cy}`,
    class: 'bb-out',
    pathLength: 1,
  });

  const rings = [28, 44, 58].map((radius, index) =>
    mark('circle', {
      cx,
      cy,
      r: radius,
      class: 'bb-ring',
      style: `--ring: ${index}`,
    }),
  );
  const core = mark('circle', { cx, cy, r: 8, class: 'bb-core' });

  group.append(gap, out, ...rings, core);

  return {
    group,
    build(timeline, at, motion) {
      draw(timeline, [gap, out], at, motion, STAGGER * 0.5);
      pop(timeline, core, at + seconds(0.16) * motion, motion, 8);
      rings.forEach((ring, index) => {
        const radius = Number(ring.getAttribute('r'));
        timeline.fromTo(
          ring,
          { attr: motion ? { r: 8 } : { r: radius }, opacity: motion ? 0 : 1 },
          {
            attr: { r: radius },
            opacity: 1,
            duration: seconds(DURATION.slow) * motion,
            ease: EASE.enter,
          },
          at + seconds(0.2 + index * 0.09) * motion,
        );
      });
    },
  };
}

/**
 * Recommend — one in, an ordering out.
 *
 * Rows, not a fan. A fan says *several outputs* and this stage has one output
 * that happens to have an order inside it, which is a different claim and the
 * only one of the four that is about arrangement rather than about flow. Rows
 * also give the board its fourth topology: converging, crossing, concentric,
 * stacked, and no two of those can be mistaken for each other at distance.
 */
function recommend(cx: number, cy: number): Vertebra {
  const group = svg('g', { class: 'bb-node' });
  const hinge = { x: cx - 62, y: cy };

  const feed = mark('path', {
    d: `M ${cx - NODE.half} ${cy} L ${hinge.x} ${cy}`,
    class: 'bb-out',
    pathLength: 1,
  });
  const node = mark('circle', { cx: hinge.x, cy, r: 5, class: 'bb-head' });

  // Rows are wider than they are tall, so the block reads right of the hinge
  // unless the run is pulled back under the column's own centre.
  const rowLeft = cx - 50;

  const widths = [1, 0.84, 0.7, 0.58, 0.48];
  const reach = 112;
  const rows = widths.map((share, index) =>
    mark('rect', {
      x: rowLeft,
      y: cy - 42 + index * 21,
      width: reach * share,
      height: 9,
      rx: 4.5,
      class: index === 0 ? 'bb-row bb-row-lead' : 'bb-row',
    }),
  );

  group.append(feed, node, ...rows);

  return {
    group,
    build(timeline, at, motion) {
      draw(timeline, [feed], at, motion);
      pop(timeline, node, at + seconds(0.14) * motion, motion, 5);
      rows.forEach((row, index) => {
        grow(
          timeline,
          row,
          { width: 0 },
          { width: reach * (widths[index] as number) },
          at + seconds(0.2 + index * 0.07) * motion,
          motion,
        );
      });
    },
  };
}

const VERTEBRAE = { extract, screen, estimate, recommend } as const;

/* ---- Motion helpers -------------------------------------------------------------- */

/**
 * Growth is written to attributes, never to a transform.
 *
 * `transformOrigin` on an SVG shape is a translate wrapped around a scale, and
 * GSAP leaves the compensating translate on the element when the tween lands.
 * Every bar of an earlier build finished sitting exactly its own height too
 * high, with a clean `scaleY(1)` on it and nothing in the geometry to blame.
 * Attributes carry no such baggage: the value the tween ends on is the value in
 * the drawing.
 */
const grow = (
  timeline: gsap.core.Timeline,
  node: SVGElement,
  from: Record<string, number>,
  to: Record<string, number>,
  at: number,
  motion: number,
): void => {
  timeline.fromTo(
    node,
    { attr: motion ? from : to },
    { attr: to, duration: seconds(DURATION.slow) * motion, ease: EASE.enter },
    at,
  );
};

const pop = (
  timeline: gsap.core.Timeline,
  node: SVGElement,
  at: number,
  motion: number,
  radius: number,
): void => {
  timeline.fromTo(
    node,
    { attr: motion ? { r: 0 } : { r: radius } },
    { attr: { r: radius }, duration: seconds(DURATION.normal) * motion, ease: EASE.enter },
    at,
  );
};

/**
 * A stroke drawn on, in the path's own normalised length.
 *
 * Every path here carries `pathLength="1"`, so the dash pattern is written in
 * the same units whatever the path's real length, and nine strands of different
 * lengths draw at the same rate.
 */
const draw = (
  timeline: gsap.core.Timeline,
  nodes: readonly SVGElement[],
  at: number,
  motion: number,
  stagger = 0,
): void => {
  timeline.fromTo(
    nodes as gsap.TweenTarget,
    { strokeDasharray: 1, strokeDashoffset: motion ? 1 : 0 },
    {
      strokeDashoffset: 0,
      duration: seconds(DURATION.slow) * motion,
      ease: EASE.standard,
      stagger: seconds(stagger) * motion,
    },
    at,
  );
};

/* ---- The composition ------------------------------------------------------------- */

let sequence = 0;

/**
 * The backbone, in one beat.
 *
 * A spine the width of the frame with a light travelling it that never stops,
 * and four vertebrae hanging off it that look nothing like each other. That is
 * the whole slide: the technology runs through everything, and it is a different
 * bone at every joint.
 *
 * **One beat, no clicks.** The presenter has about half a minute here and the
 * shape only argues while all four are on screen together. A build that revealed
 * them one at a time would spend the half minute assembling the picture instead
 * of standing on it.
 *
 * **The motion after the build belongs to CSS.** The glint along the spine, the
 * pulses dropping into each vertebra and the breathing rings all run on
 * keyframes, so the frame stays alive for as long as the presenter stands on it
 * with no timeline to own and none to dispose of.
 */
export function createBackbone(): Backbone {
  sequence += 1;
  const clipId = `bb-spine-${sequence}`;
  const spineId = `bb-spine-fill-${sequence}`;
  const glintId = `bb-glint-${sequence}`;

  const board = svg('svg', {
    class: 'bb-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });

  const defs = svg('defs');
  const spineFill = svg('linearGradient', { id: spineId, x1: '0', x2: '1', y1: '0', y2: '0' });
  spineFill.append(
    svg('stop', { offset: '0', class: 'bb-spine-end' }),
    svg('stop', { offset: '0.5', class: 'bb-spine-mid' }),
    svg('stop', { offset: '1', class: 'bb-spine-end' }),
  );
  const glintFill = svg('linearGradient', { id: glintId, x1: '0', x2: '1', y1: '0', y2: '0' });
  glintFill.append(
    svg('stop', { offset: '0', class: 'bb-glint-edge' }),
    svg('stop', { offset: '0.5', class: 'bb-glint-core' }),
    svg('stop', { offset: '1', class: 'bb-glint-edge' }),
  );
  const clip = svg('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
  clip.appendChild(
    mark('rect', {
      x: MARGIN,
      y: SPINE.y - SPINE.thickness / 2,
      width: BOARD.width - MARGIN * 2,
      height: SPINE.thickness,
      rx: SPINE.thickness / 2,
    }),
  );
  defs.append(spineFill, glintFill, clip);
  board.appendChild(defs);

  const spine = svg('g', { class: 'bb-spine', 'clip-path': `url(#${clipId})` });
  spine.append(
    mark('rect', {
      x: MARGIN,
      y: SPINE.y - SPINE.thickness / 2,
      width: BOARD.width - MARGIN * 2,
      height: SPINE.thickness,
      fill: `url(#${spineId})`,
    }),
    mark('rect', {
      x: MARGIN - SPINE.glint,
      y: SPINE.y - SPINE.thickness / 2,
      width: SPINE.glint,
      height: SPINE.thickness,
      class: 'bb-glint',
      fill: `url(#${glintId})`,
    }),
  );

  /**
   * The spine opens left to right, and it is the only thing the wipe touches.
   *
   * A group carries one `clip-path`, and the spine already needs its own for the
   * rounded ends and to keep the glint inside them, so the wipe wraps it rather
   * than replacing it. Nothing else goes in: the risers build on their own
   * clock, and clipped by a wipe still crossing the board the last of them would
   * animate somewhere nobody can see it.
   */
  const spineWipe: Wipe = createWipe(board, BOARD.width, BOARD.height, 'x');
  const revealed = svg('g', { 'clip-path': spineWipe.clip });
  revealed.appendChild(spine);
  board.appendChild(revealed);

  const risers: SVGElement[] = [];
  const drops: SVGElement[] = [];
  const vertebrae: Vertebra[] = [];
  const families: HTMLElement[] = [];
  const verbs: HTMLElement[] = [];
  const needs: HTMLElement[] = [];

  const frame = el('div', { className: 'bb-frame' });

  BACKBONE_NODES.forEach((node: BackboneNode, index) => {
    const mid = columnMid(index);

    const riser = mark('rect', {
      x: mid - 0.75,
      y: RISER.top,
      width: 1.5,
      height: RISER.bottom - RISER.top,
      class: 'bb-riser',
    });
    const drop = mark('circle', {
      cx: mid,
      cy: RISER.top,
      r: 3.5,
      class: 'bb-drop',
    });
    risers.push(riser);
    drops.push(drop);
    board.append(riser, drop);

    const vertebra = VERTEBRAE[node.key](mid, NODE.y);
    vertebrae.push(vertebra);
    board.appendChild(vertebra.group);

    const at = (row: number): string =>
      `${atBoard(mid - COLUMN / 2, row)}; ${spanBoard(COLUMN)}`;

    const family = el('p', { className: 'bb-family', text: node.family });
    family.setAttribute('style', at(ROW.family));

    const verb = el('p', { className: 'bb-verb', text: node.verb });
    verb.setAttribute('style', at(ROW.verb));

    const need = el('p', { className: 'bb-need', text: node.need });
    need.setAttribute('style', at(ROW.need));

    families.push(family);
    verbs.push(verb);
    needs.push(need);
    frame.append(family, verb, need);
  });

  frame.insertBefore(board, frame.firstChild);

  const element = el('div', { className: 'bb', children: [frame] });

  const written = [...families, ...verbs, ...needs];
  const groups = vertebrae.map((vertebra) => vertebra.group);

  gsap.set(written, { opacity: 0 });
  gsap.set(groups, { opacity: 0 });
  gsap.set(spineWipe.rect, hidden(spineWipe));
  gsap.set(risers, { attr: { height: 0 } });
  gsap.set(drops, { opacity: 0, attr: { cy: RISER.top } });

  return {
    element,

    play(settle) {
      const timeline = gsap.timeline();

      gsap.killTweensOf([...written, ...groups, ...risers, spineWipe.rect]);

      if (settle) {
        gsap.set(spineWipe.rect, shown(spineWipe));
        gsap.set(risers, { attr: { height: RISER.bottom - RISER.top } });
        gsap.set(drops, { opacity: 0 });
        gsap.set([...written, ...groups], { opacity: 1, y: 0 });
        for (const vertebra of vertebrae) vertebra.build(timeline, 0, 0);
        return timeline;
      }

      timeline.fromTo(
        spineWipe.rect,
        hidden(spineWipe),
        { ...shown(spineWipe), duration: seconds(DURATION.cinematic) * 0.9, ease: 'power2.inOut' },
        0,
      );
      timeline.to(
        risers,
        {
          attr: { height: RISER.bottom - RISER.top },
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.8),
        },
        seconds(0.42),
      );

      /**
       * One pulse down each riser, and only one.
       *
       * It ran on a loop and the four verticals never stopped twitching, which
       * is movement with nothing to say for half a minute of standing on the
       * slide. Fired once with the riser it is falling down, it reads as the
       * spine delivering to that stage and then leaves the frame still.
       */
      drops.forEach((drop, index) => {
        const at = seconds(0.44 + index * STAGGER * 1.8);
        timeline.to(drop, { opacity: 1, duration: seconds(DURATION.instant) }, at);
        timeline.to(
          drop,
          {
            attr: { cy: RISER.bottom },
            duration: seconds(DURATION.slow) * 0.9,
            ease: 'power1.in',
          },
          at,
        );
        timeline.to(drop, { opacity: 0, duration: seconds(DURATION.quick) }, '>-0.1');
      });

      vertebrae.forEach((vertebra, index) => {
        const at = seconds(0.6 + index * STAGGER * 1.8);
        timeline.to(vertebra.group, { opacity: 1, duration: seconds(DURATION.quick) }, at);
        vertebra.build(timeline, at, 1);
      });

      const column = (nodes: readonly HTMLElement[], at: number): void => {
        timeline.fromTo(
          nodes,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.8),
          },
          at,
        );
      };

      column(families, seconds(0.52));
      column(verbs, seconds(1.05));
      column(needs, seconds(1.2));

      return timeline;
    },
  };
}
