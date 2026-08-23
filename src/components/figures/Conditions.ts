import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CARDS } from '@/content/act3';
import { el, svg } from '@/utilities/dom';
import './conditions.css';

export interface Conditions {
  readonly element: HTMLElement;
  /** Beat one: the silhouette forms and is carried across its gaps. */
  open(settle: boolean): gsap.core.Timeline;
  /** Beat two: the profile re-forms under a different context. */
  apply(settle: boolean): gsap.core.Timeline;
}

const BOARD = { width: 420, height: 300 } as const;

const mark = (
  tag: keyof SVGElementTagNameMap,
  attrs: Record<string, string | number>,
): SVGElement => {
  const written: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) written[name] = String(value);
  return svg(tag, written);
};

interface Timing {
  duration?: number;
  ease?: string;
  stagger?: number;
}

/**
 * Growth written to the attribute the geometry is in, never to a transform.
 *
 * `transformOrigin` on an SVG child resolves against its `transform-box` and
 * GSAP bakes the compensating translate into the matrix it leaves behind.
 */
const attr = (
  timeline: gsap.core.Timeline,
  node: SVGElement | readonly SVGElement[],
  from: Record<string, number>,
  to: Record<string, number>,
  at: number,
  motion: number,
  options: Timing = {},
): void => {
  timeline.fromTo(
    node as gsap.TweenTarget,
    { attr: motion ? from : to },
    {
      attr: to,
      duration: seconds(options.duration ?? DURATION.slow) * motion,
      ease: options.ease ?? EASE.enter,
      stagger: seconds(options.stagger ?? 0) * motion,
    },
    at,
  );
};

const fade = (
  timeline: gsap.core.Timeline,
  nodes: readonly Element[],
  to: number,
  at: number,
  motion: number,
  options: Timing & { from?: number } = {},
): void => {
  if (nodes.length === 0) return;
  timeline.fromTo(
    nodes as gsap.TweenTarget,
    { opacity: motion ? (options.from ?? 0) : to },
    {
      opacity: to,
      duration: seconds(options.duration ?? DURATION.normal) * motion,
      ease: EASE.enter,
      stagger: seconds(options.stagger ?? 0) * motion,
    },
    at,
  );
};

/* ---- Card one: the silhouette, carried ---------------------------------------------- */

const COLUMNS = 12;
const BARS = { left: 22, right: 398, base: 270, floor: 40, reach: 192, gap: 10 } as const;

/**
 * Which columns are not firmly known.
 *
 * One isolated and one adjacent pair, so the drawing says the absences have
 * structure rather than being scattered noise. That is what the market analysis
 * established, and it is a different claim from "the data is patchy".
 */
const MISSING = new Set([2, 6, 7, 10]);

const PITCH = (BARS.right - BARS.left) / COLUMNS;
const BAR_WIDTH = PITCH - BARS.gap;

/**
 * The profile, as a function rather than as a list of heights.
 *
 * The curve has to pass through the top of every column including the ones that
 * are not there, so the heights and the curve are one function sampled at two
 * resolutions. Hand-picked heights with a spline fitted through them is the same
 * drawing with somewhere for the two to disagree.
 *
 * Two humps and neither in the middle: a single centred bell is a shape the eye
 * files as a chart, and this is a silhouette.
 */
const profileAt = (t: number): number => {
  const hump = (centre: number, spread: number, weight: number): number =>
    weight * Math.exp(-((t - centre) ** 2) / (2 * spread ** 2));
  return hump(0.36, 0.22, 1) + hump(0.83, 0.13, 0.54);
};

const PEAK = (() => {
  let top = 0;
  for (let i = 0; i <= 240; i += 1) top = Math.max(top, profileAt(i / 240));
  return top;
})();

const heightAt = (t: number): number => BARS.floor + (profileAt(t) / PEAK) * BARS.reach;

const columnT = (index: number): number => (index + 0.5) / COLUMNS;
const columnX = (index: number): number => BARS.left + PITCH * index + BARS.gap / 2;

interface Silhouette {
  readonly board: SVGSVGElement;
  build(timeline: gsap.core.Timeline, at: number, motion: number): void;
}

/**
 * Card one, and the whole of it.
 *
 * Columns of evidence, some of which are not there at all, and one curve running
 * the width of the card straight over the gaps. That is the section in a single
 * gesture: the record is incomplete, and what the pipeline produces is
 * continuous across it.
 *
 * Nothing is labelled. Two earlier passes of this card carried a legend and then
 * a pair of micro-labels, and both were the drawing apologising for itself.
 */
function createSilhouette(): Silhouette {
  const board = svg('svg', {
    class: 'cnd-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
    'aria-hidden': 'true',
  });

  const bars: SVGElement[] = [];
  const heights: number[] = [];
  const absent: SVGElement[] = [];

  for (let index = 0; index < COLUMNS; index += 1) {
    const height = heightAt(columnT(index));
    const missing = MISSING.has(index);
    const bar = mark('rect', {
      x: columnX(index),
      y: BARS.base - height,
      width: BAR_WIDTH,
      height,
      rx: 5,
      class: missing ? 'sl-bar sl-bar-absent' : 'sl-bar',
    });
    heights.push(height);
    bars.push(bar);
    if (missing) absent.push(bar);
  }

  board.append(...bars);

  return {
    board,

    build(timeline, at, motion) {
      bars.forEach((bar, index) => {
        const height = heights[index] as number;
        attr(
          timeline,
          bar,
          { y: BARS.base, height: 0 },
          { y: BARS.base - height, height },
          at + seconds(index * STAGGER * 0.8) * motion,
          motion,
          { duration: DURATION.slow },
        );
      });

      // The columns that are not firmly known settle a beat behind the rest, so
      // the eye finds them rather than having to be told where to look.
      fade(timeline, absent, 1, at + seconds(0.92) * motion, motion, {
        duration: DURATION.slow,
        stagger: STAGGER * 2,
      });
    },
  };
}

/* ---- Card two: one profile, two forms ----------------------------------------------- */

const RADIAL = { cx: 210, cy: 150, reachX: 152, reachY: 122, arms: 7 } as const;

/**
 * The same product under two contexts.
 *
 * Seven arms rather than an even number, so the form has no axis of symmetry to
 * read as an ornament, and no grid behind it, because a grid would make it a
 * chart and this card carries no quantity.
 */
const BEFORE = [0.96, 0.5, 0.88, 0.44, 0.8, 0.56, 0.92] as const;
const AFTER = [0.42, 0.97, 0.52, 0.93, 0.38, 0.99, 0.48] as const;

const armAngle = (index: number): number => (index / RADIAL.arms) * Math.PI * 2 - Math.PI / 2;

/** Elliptical, so a form centred in a wide board fills it rather than floating. */
const cornerAt = (index: number, reach: number): [number, number] => {
  const angle = armAngle(index);
  return [
    RADIAL.cx + Math.cos(angle) * RADIAL.reachX * reach,
    RADIAL.cy + Math.sin(angle) * RADIAL.reachY * reach,
  ];
};

const shape = (reaches: readonly number[]): string =>
  reaches
    .map((reach, index) => {
      const [x, y] = cornerAt(index, reach);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

interface Profile {
  readonly board: SVGSVGElement;
  arrive(timeline: gsap.core.Timeline, at: number, motion: number): void;
  /** 0 is the first context, 1 the second. */
  set(share: number): void;
  reform(timeline: gsap.core.Timeline, at: number, motion: number): void;
}

/**
 * Card two, and the whole of it.
 *
 * One form, which re-forms. The audience is shown the same object twice and the
 * ghost of the first stays behind it, so the change is the picture rather than
 * something they have to hold in memory across a click.
 *
 * GSAP cannot tween a polygon's points without a plugin this project does not
 * carry, so the reach of each arm is tweened on a proxy and the geometry is
 * rebuilt from it. Exact, and it costs one object.
 */
function createProfile(): Profile {
  const board = svg('svg', {
    class: 'cnd-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
    'aria-hidden': 'true',
  });

  const ring = mark('ellipse', {
    cx: RADIAL.cx,
    cy: RADIAL.cy,
    rx: RADIAL.reachX,
    ry: RADIAL.reachY,
    class: 'pf-ring',
  });
  const ghost = mark('polygon', { points: shape(BEFORE), class: 'pf-ghost' });
  const form = mark('polygon', { points: shape(BEFORE), class: 'pf-form' });
  const nodes = BEFORE.map((reach, index) => {
    const [x, y] = cornerAt(index, reach);
    return mark('circle', { cx: x, cy: y, r: 5, class: 'pf-node' });
  });

  board.append(ring, ghost, form, ...nodes);

  const at = { share: 0 };

  const write = (): void => {
    const reaches = BEFORE.map(
      (start, index) => start + ((AFTER[index] as number) - start) * at.share,
    );
    form.setAttribute('points', shape(reaches));
    nodes.forEach((node, index) => {
      const [x, y] = cornerAt(index, reaches[index] as number);
      node.setAttribute('cx', x.toFixed(2));
      node.setAttribute('cy', y.toFixed(2));
    });
  };

  return {
    board,

    /**
     * The form comes up in the light, and nothing about it pops.
     *
     * An earlier pass grew each corner from a radius of zero, which is a set of
     * small events inside a card that is already making one large one. Uncovered
     * by the card's own opening and lit as it goes, the drawing is part of that
     * gesture rather than a second one arriving on top of it.
     */
    arrive(timeline, delay, motion) {
      fade(timeline, [ring], 1, delay, motion, { duration: DURATION.cinematic });
      fade(timeline, [form], 1, delay + seconds(0.12) * motion, motion, {
        duration: DURATION.cinematic,
      });
      fade(timeline, nodes, 1, delay + seconds(0.3) * motion, motion, {
        duration: DURATION.slow,
        stagger: STAGGER * 0.9,
      });
    },

    set(share) {
      at.share = share;
      write();
    },

    reform(timeline, delay, motion) {
      fade(timeline, [ghost], 1, delay, motion, { duration: DURATION.slow });
      timeline.fromTo(
        at,
        { share: motion ? 0 : 1 },
        {
          share: 1,
          duration: seconds(DURATION.cinematic * 1.15) * motion,
          ease: EASE.standard,
          onUpdate: write,
        },
        delay + seconds(0.14) * motion,
      );
    },
  };
}

/* ---- The composition ---------------------------------------------------------------- */

interface Card {
  readonly element: HTMLElement;
  /** Read from the first frame: the claim this card makes. */
  readonly claim: readonly HTMLElement[];
}

/**
 * Where each step comes in, as a position on the card's own opening.
 *
 * Not a delay in seconds. The steps are uncovered by the card's growing edge, so
 * their light has to be a function of how far open the card is or the edge cuts
 * through a line that is already lit. Expressed here and read by the sheet, so
 * there is one clock for the whole gesture and nothing to keep in step.
 */
const STEP_AT = [0.08, 0.34, 0.6] as const;

/**
 * A card: the claim on the left, the drawing beside it.
 *
 * Side by side rather than stacked, so the figure is read against the sentence
 * it belongs to instead of underneath a block the eye has already left. The
 * claim's column is a fixed width and the drawing's frame is a fixed width, so
 * widening the card widens only the space between them: the drawing is uncovered
 * at the size it will keep, and nothing scales or reflows.
 */
const buildCard = (
  key: string,
  content: { heading: string; lead: string; steps: readonly string[] },
  board: SVGSVGElement,
): Card => {
  const title = el('h3', { className: 'cnd-title', text: content.heading });
  const lead = el('p', { className: 'cnd-lead', text: content.lead });
  const steps = content.steps.map((text, index) => {
    const step = el('li', {
      className: 'cnd-step',
      children: [
        el('span', { className: 'cnd-index', text: String(index + 1).padStart(2, '0') }),
        el('p', { className: 'cnd-step-text', text }),
      ],
    });
    step.style.setProperty('--at', String(STEP_AT[index] ?? 0));
    return step;
  });
  const list = el('ol', { className: 'cnd-steps', children: steps });
  const stage = el('div', {
    className: 'cnd-stage',
    children: [el('div', { className: 'cnd-frame', children: [board] })],
  });

  return {
    element: el('div', {
      className: 'cnd-card',
      attrs: { 'data-card': key },
      children: [title, lead, list, stage],
    }),
    claim: [title, lead],
  };
};

/**
 * A card opens on one scalar, and everything else is a function of it.
 *
 * The first version of this move ran six tweens: width, the run's height, the
 * stage's height, the stage's light, a per-step rise and the drawing's own
 * build, each on its own clock and its own delay. Six curves crossing is six
 * things happening, and no amount of tuning the delays makes that read as one
 * gesture. Here the sheet derives the width, both heights, the stage's light and
 * every step's light from `--open`, so they cannot drift and there is nothing to
 * keep in step.
 *
 * **And the ease is not `expo.out`.** `expo` spends about nine tenths of its
 * distance in the first quarter of its duration, which on a small element reads
 * as crisp and on a card the size of half the frame reads as a snap followed by
 * a crawl. `power2.out` answers the click immediately and still settles, which
 * is what a surface this large needs.
 */
const OPENING = { seconds: 1.7, ease: 'power2.out' } as const;

const openCard = (
  timeline: gsap.core.Timeline,
  card: Card,
  at: number,
  motion: number,
): void => {
  timeline.fromTo(
    card.element,
    { '--open': motion ? 0 : 1 },
    { '--open': 1, duration: seconds(OPENING.seconds) * motion, ease: OPENING.ease },
    at,
  );
};

/**
 * Two conditions, two cards, two beats.
 *
 * Nothing is drawn between them: both sections claim their condition runs the
 * length of the pipeline, and neither claims one leads to the other.
 *
 * **The second card carries only its claim until the click.** A card that
 * arrives whole on a click is a slide change; a card that shows an unlit drawing
 * for a minute is a drawing nobody is looking at. Standing narrow with its claim
 * already made, it is the one thing on screen that is visibly unfinished, which
 * is what a second beat is for.
 */
export function createConditions(): Conditions {
  const silhouette = createSilhouette();
  const profile = createProfile();

  const evidence = buildCard('evidence', CARDS.evidence, silhouette.board);
  const context = buildCard('context', CARDS.context, profile.board);

  const element = el('div', { className: 'cnd', children: [evidence.element, context.element] });

  const claims = [...evidence.claim, ...context.claim];
  const marks = [...silhouette.board.querySelectorAll('rect, path')];
  const formed = [...profile.board.querySelectorAll('circle, polygon, ellipse')];
  const everything = [...claims, evidence.element, context.element, ...marks, ...formed];

  return {
    element,

    /**
     * Beat one, with every state it depends on written here.
     *
     * A beat that trusts the beat before it renders wrong the first time the
     * presenter steps backwards, and a defence is not walked in a straight line.
     */
    open(settle) {
      gsap.killTweensOf(everything);
      const timeline = gsap.timeline();
      const motion = settle ? 0 : 1;

      gsap.set(context.element, { '--open': 0 });
      gsap.set(profile.board.querySelectorAll('.pf-ghost'), { opacity: 0 });
      gsap.set(profile.board.querySelectorAll('.pf-ring, .pf-form, .pf-node'), { opacity: 0 });
      profile.set(0);

      fade(timeline, claims, 1, 0, motion, { duration: DURATION.slow, stagger: STAGGER * 1.4 });
      openCard(timeline, evidence, seconds(0.28) * motion, motion);
      // Behind the opening edge, so the columns are drawn in room that already
      // exists rather than growing alongside it.
      silhouette.build(timeline, seconds(1.24) * motion, motion);

      return timeline;
    },

    /**
     * Beat two: the second card takes the room it was left, and fills it.
     *
     * One opening, and the drawing continuing out of it rather than starting
     * beside it. The starting state is written rather than assumed, because a
     * jump can land on this beat directly and because stepping back and forward
     * again has to run the same move twice.
     */
    apply(settle) {
      gsap.killTweensOf(everything);
      const timeline = gsap.timeline();
      const motion = settle ? 0 : 1;

      gsap.set(claims, { opacity: 1 });
      gsap.set(evidence.element, { '--open': 1 });
      profile.set(0);

      openCard(timeline, context, 0, motion);
      profile.arrive(timeline, seconds(0.95) * motion, motion);
      profile.reform(timeline, seconds(2.35) * motion, motion);

      return timeline;
    },
  };
}
