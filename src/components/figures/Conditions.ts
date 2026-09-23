import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CARDS } from '@/content/act3';
import { el, svg } from '@/utilities/dom';
import './conditions.css';

export interface Conditions {
  readonly element: HTMLElement;
  /** Beat one: opens the evidence card and builds the silhouette. */
  open(settle: boolean): gsap.core.Timeline;
  /** Beat two: opens the context card and re-forms the profile. */
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
 * Tweens geometry attributes directly. On SVG children, GSAP's `transformOrigin`
 * leaves a baked translate in the transform matrix.
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

/* ---- Card one: silhouette ----------------------------------------------------------- */

const COLUMNS = 12;
const BARS = { left: 22, right: 398, base: 270, floor: 40, reach: 192, gap: 10 } as const;

/**
 * Columns with missing data. Grouped (one single, one pair, one single) to show
 * that the gaps have structure, as the market analysis found.
 */
const MISSING = new Set([2, 6, 7, 10]);

const PITCH = (BARS.right - BARS.left) / COLUMNS;
const BAR_WIDTH = PITCH - BARS.gap;

/**
 * Profile height at t (0 to 1). One function drives both the column heights and
 * the curve, so the curve always meets the column tops. Two off-centre humps keep
 * it from looking like a bell chart.
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
 * Card one: columns of evidence with some missing. Shows that the record has
 * gaps and the pipeline output stays continuous across them. Unlabelled.
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

      // Missing columns settle a beat later so the eye finds them.
      fade(timeline, absent, 1, at + seconds(0.92) * motion, motion, {
        duration: DURATION.slow,
        stagger: STAGGER * 2,
      });
    },
  };
}

/* ---- Card two: profile -------------------------------------------------------------- */

const RADIAL = { cx: 210, cy: 150, reachX: 152, reachY: 122, arms: 7 } as const;

/**
 * Arm reaches (0 to 1) for the same product under two contexts. Seven arms avoid
 * an axis of symmetry. No grid, since the card shows no quantity.
 */
const BEFORE = [0.96, 0.5, 0.88, 0.44, 0.8, 0.56, 0.92] as const;
const AFTER = [0.42, 0.97, 0.52, 0.93, 0.38, 0.99, 0.48] as const;

const armAngle = (index: number): number => (index / RADIAL.arms) * Math.PI * 2 - Math.PI / 2;

/** Elliptical, so the form fills the wide board. */
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
 * Card two: one form that re-forms, with a ghost of the first shape left behind.
 * GSAP cannot tween polygon points without a plugin, so a proxy value is tweened
 * and the geometry is rebuilt from it.
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

    /** Fades the form in while the card is still opening. */
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

/* ---- Composition -------------------------------------------------------------------- */

interface Card {
  readonly element: HTMLElement;
  /** Title and lead, visible from the first frame. */
  readonly claim: readonly HTMLElement[];
}

/**
 * When each step lights up, as a fraction (0 to 1) of the card's `--open`.
 * Written to `--at` and read by the stylesheet, so steps stay in sync with the
 * card's edge.
 */
const STEP_AT = [0.08, 0.34, 0.6] as const;

/**
 * A card with the claim on the left and the drawing beside it. Both columns are
 * fixed width, so opening the card only widens the space between them and
 * nothing reflows.
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
 * A card opens by tweening one value, `--open` (0 to 1). The stylesheet derives
 * width, heights and step lighting from it. `power2.out` because `expo.out`
 * snaps then crawls on an element this large.
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
 * Two conditions as two cards over two beats. No connector between them, since
 * neither condition leads to the other. The second card shows only its claim
 * until the second beat opens it.
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

    /** Sets every state it depends on, so stepping backwards renders correctly. */
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
      // Starts once the card has mostly opened.
      silhouette.build(timeline, seconds(1.24) * motion, motion);

      return timeline;
    },

    /**
     * Opens the second card and re-forms its profile. Sets its starting state
     * explicitly, since a jump can land here directly.
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
