import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  STANDING_BANDS,
  STANDING_LIMITS,
  type StandingBand,
  type StandingRow,
} from '@/content/act3';
import { el, svg } from '@/utilities/dom';
import { standingIcon } from './standingIcons';
import './standing.css';

export interface Standing {
  readonly element: HTMLElement;
  /**
   * Show beat `index`: bands up to it are lit, later bands are dark. Each call
   * writes the full state so stepping backwards renders correctly.
   */
  reveal(index: number, settle: boolean): gsap.core.Timeline;
}

/* ---- The marks -------------------------------------------------------------------- */

interface Stroke {
  readonly node: SVGGeometryElement;
  readonly length: number;
}

interface Mark {
  readonly strokes: readonly Stroke[];
  readonly dashes: readonly SVGElement[];
  readonly dots: readonly SVGElement[];
}

/**
 * Measures each stroke and retracts it with a dash offset of its own length.
 * If `getTotalLength` fails or returns 0, the stroke is left undashed.
 */
const measure = (root: Element): Mark => {
  const strokes = Array.from(root.querySelectorAll<SVGGeometryElement>('.icon-stroke')).map(
    (node) => {
      let length = 0;
      try {
        length = node.getTotalLength();
      } catch {
        length = 0;
      }
      if (length > 0) {
        node.style.strokeDasharray = `${length}`;
        node.style.strokeDashoffset = `${length}`;
      }
      return { node, length };
    },
  );

  return {
    strokes,
    dashes: Array.from(root.querySelectorAll<SVGElement>('.icon-dash')),
    dots: Array.from(root.querySelectorAll<SVGElement>('.icon-dot')),
  };
};

/* ---- The continuation trail -------------------------------------------------------- */

/**
 * The third band's mark: a solid segment followed by a trail of dots. All three
 * trails are identical, so length carries no meaning. Dot spacing grows by
 * `growth`, and the dots keep drifting outward after the band settles.
 */
const TRAIL = {
  width: 260,
  height: 8,
  midline: 4,
  covered: 104,
  start: 118,
  gap: 13,
  growth: 1.24,
  dots: 7,
  radius: 1.5,
} as const;

interface Trail {
  readonly element: SVGSVGElement;
  readonly solid: SVGRectElement;
  readonly dots: readonly SVGCircleElement[];
  /** Resting opacity per dot, fading with distance along the trail. */
  readonly rest: readonly number[];
}

const trailStops = (): readonly number[] => {
  const stops: number[] = [];
  let x = TRAIL.start;
  let gap = TRAIL.gap;

  for (let index = 0; index < TRAIL.dots && x < TRAIL.width - TRAIL.radius; index += 1) {
    stops.push(x);
    x += gap;
    gap *= TRAIL.growth;
  }

  return stops;
};

const buildTrail = (): Trail => {
  const element = svg('svg', {
    class: 'std-trail',
    viewBox: `0 0 ${TRAIL.width} ${TRAIL.height}`,
    preserveAspectRatio: 'xMinYMid meet',
    'aria-hidden': 'true',
  });

  const solid = svg('rect', {
    class: 'std-trail-solid',
    x: '0',
    y: String(TRAIL.midline - 0.6),
    width: String(TRAIL.covered),
    height: '1.2',
    rx: '0.6',
  });

  const stops = trailStops();
  const rest = stops.map((_, index) => 0.6 * (1 - index / stops.length) ** 1.4 + 0.08);

  const dots = stops.map((x, index) => {
    const node = svg('circle', {
      class: 'std-trail-dot',
      cx: String(x),
      cy: String(TRAIL.midline),
      r: String(TRAIL.radius),
    });
    // Phase-offset each dot so the trail moves outward as one wave.
    node.style.animationDelay = `${(index * -0.9).toFixed(2)}s`;
    return node;
  });

  element.appendChild(solid);
  for (const dot of dots) element.appendChild(dot);

  return { element, solid, dots, rest };
};

/* ---- A band ------------------------------------------------------------------------ */

interface Band {
  readonly element: HTMLElement;
  readonly label: HTMLElement;
  readonly rule: HTMLElement;
  /** Elements that fade in when the band is lit, in reading order. */
  readonly cells: readonly HTMLElement[];
  readonly marks: readonly Mark[];
  readonly trails: readonly Trail[];
}

const buildColumn = (row: StandingRow): { element: HTMLElement; mark: Mark } => {
  const holder = el('div', { className: 'std-mark' });
  holder.innerHTML = standingIcon(row.icon);

  const element = el('div', {
    className: 'std-col',
    children: [
      holder,
      el('p', { className: 'std-lead', text: row.lead }),
      el('p', { className: 'std-note', text: row.note }),
    ],
  });

  return { element, mark: measure(holder) };
};

const buildBand = (band: StandingBand): Band => {
  const label = el('span', { className: 'std-label', text: band.label });
  const rule = el('div', { className: 'std-rule' });
  const columns = band.rows.map(buildColumn);
  const body = el('div', {
    className: 'std-cols',
    attrs: { 'data-count': String(band.rows.length) },
    children: columns.map((column) => column.element),
  });

  const element = el('div', {
    className: 'std-band',
    attrs: { 'data-band': band.key },
    children: [label, rule, body],
  });

  return {
    element,
    label,
    rule,
    cells: columns.map((column) => column.element),
    marks: columns.map((column) => column.mark),
    trails: [],
  };
};

/**
 * The third band as a matrix: one column per boundary, and two labelled rows
 * (limit and next step) with their names in a left gutter.
 */
const buildHorizon = (): Band => {
  const label = el('span', { className: 'std-label', text: STANDING_LIMITS.label });
  const rule = el('div', { className: 'std-rule' });
  const trails = STANDING_LIMITS.items.map(() => buildTrail());

  const heads = STANDING_LIMITS.items.map((item, index) =>
    el('div', {
      className: 'std-head',
      children: [trails[index]!.element, el('p', { className: 'std-lead', text: item.lead })],
    }),
  );

  const side = (text: string): HTMLElement => el('span', { className: 'std-side', text });
  const sides = [side(STANDING_LIMITS.rows.limit), side(STANDING_LIMITS.rows.next)];

  const limitCells = STANDING_LIMITS.items.map((item) =>
    el('p', { className: 'std-cell', text: item.limit }),
  );
  const nextCells = STANDING_LIMITS.items.map((item) =>
    el('p', { className: 'std-cell std-cell-next', text: item.next }),
  );

  const body = el('div', {
    className: 'std-matrix',
    children: [
      el('span', { className: 'std-gutter' }),
      ...heads,
      sides[0]!,
      ...limitCells,
      sides[1]!,
      ...nextCells,
    ],
  });

  const element = el('div', {
    className: 'std-band',
    attrs: { 'data-band': 'horizon' },
    children: [label, rule, body],
  });

  return {
    element,
    label,
    rule,
    cells: [...heads, sides[0]!, ...limitCells, sides[1]!, ...nextCells],
    marks: [],
    trails,
  };
};

/* ---- The opening ------------------------------------------------------------------- */

/**
 * A band lights by tweening `--open` from 0 to 1. The stylesheet derives the
 * ground, label tint, hairline, shadow and grid from it, so they stay in sync.
 * `power2.out` responds at once and settles smoothly on a full-width surface.
 */
const LIGHT = { seconds: 1.5, ease: 'power2.out' } as const;

/** The rule draws across the band before the cells appear. */
const RULE = { seconds: 1.15, ease: 'power2.inOut' } as const;

/** Start times in seconds within a band's beat. The ground comes up before the text. */
const CUE = { ground: 0, rule: 0.1, cells: 0.34, mark: 0.62 } as const;

const STROKE_STEP = 0.05;
const MARK_STEP = 0.13;

/** Every animated element of a band, for `killTweensOf`. */
const contentsOf = (band: Band): Element[] => [
  band.element,
  band.label,
  band.rule,
  ...band.cells,
  ...band.marks.flatMap((mark) => [
    ...mark.strokes.map((stroke) => stroke.node),
    ...mark.dashes,
    ...mark.dots,
  ]),
  ...band.trails.flatMap((trail) => [trail.solid, ...trail.dots]),
];

/** Sets a band to its final lit state with no animation. */
const setLit = (band: Band): void => {
  gsap.set(band.element, { '--open': 1 });
  gsap.set([band.label, ...band.cells], { opacity: 1, y: 0 });
  gsap.set(band.rule, { opacity: 1, scaleX: 1 });

  for (const mark of band.marks) {
    for (const stroke of mark.strokes) {
      gsap.set(stroke.node, { strokeDashoffset: 0 });
    }
    gsap.set(mark.dots, { scale: 1 });
    gsap.set(mark.dashes, { opacity: 0.85 });
  }

  for (const trail of band.trails) {
    gsap.set(trail.solid, { attr: { width: TRAIL.covered } });
    trail.dots.forEach((dot, index) => gsap.set(dot, { opacity: trail.rest[index] ?? 1 }));
  }
};

/**
 * Sets a band to its state before its beat. The label stays dimly visible and
 * the ground keeps a hairline, so the full layout shows from the first beat.
 */
const setDark = (band: Band): void => {
  gsap.set(band.element, { '--open': 0 });
  gsap.set(band.label, { opacity: 0.34, y: 0 });
  gsap.set(band.rule, { opacity: 1, scaleX: 0 });
  gsap.set(band.cells, { opacity: 0, y: 14 });

  for (const mark of band.marks) {
    for (const stroke of mark.strokes) {
      gsap.set(stroke.node, { strokeDashoffset: stroke.length });
    }
    gsap.set(mark.dots, { scale: 0 });
    gsap.set(mark.dashes, { opacity: 0 });
  }

  for (const trail of band.trails) {
    gsap.set(trail.solid, { attr: { width: 0 } });
    gsap.set(trail.dots, { opacity: 0 });
  }
};

/**
 * Animates one band in, in order: ground, rule, cells, then marks.
 * All four cues fit in about 1.5 s.
 */
const lightBand = (timeline: gsap.core.Timeline, band: Band): void => {
  timeline.fromTo(
    band.element,
    { '--open': 0 },
    { '--open': 1, duration: seconds(LIGHT.seconds), ease: LIGHT.ease },
    seconds(CUE.ground),
  );

  timeline.to(
    band.label,
    { opacity: 1, duration: seconds(DURATION.slow), ease: EASE.enter },
    seconds(CUE.ground),
  );

  // The rule draws in from the left.
  timeline.fromTo(
    band.rule,
    { scaleX: 0 },
    { scaleX: 1, duration: seconds(RULE.seconds), ease: RULE.ease },
    seconds(CUE.rule),
  );

  timeline.to(
    band.cells as gsap.TweenTarget,
    {
      opacity: 1,
      y: 0,
      duration: seconds(DURATION.slow),
      ease: EASE.enter,
      stagger: seconds(STAGGER * 1.5),
    },
    seconds(CUE.cells),
  );

  band.marks.forEach((mark, order) => {
    const from = seconds(CUE.mark) + order * seconds(MARK_STEP);

    // Tween only `strokeDashoffset`. Tweening opacity would override the
    // `icon-faint` styling.
    mark.strokes.forEach((stroke, index) => {
      timeline.to(
        stroke.node,
        { strokeDashoffset: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
        from + index * seconds(STROKE_STEP),
      );
    });

    const settled = from + mark.strokes.length * seconds(STROKE_STEP);

    timeline.to(
      mark.dots as gsap.TweenTarget,
      {
        scale: 1,
        duration: seconds(DURATION.quick),
        ease: 'back.out(2)',
        stagger: seconds(STAGGER * 0.6),
      },
      settled,
    );

    // Dashed strokes fade in. The draw effect writes `stroke-dasharray` and
    // would overwrite their dash pattern.
    timeline.to(
      mark.dashes as gsap.TweenTarget,
      { opacity: 0.85, duration: seconds(DURATION.slow), ease: EASE.enter },
      settled,
    );
  });

  band.trails.forEach((trail, order) => {
    const from = seconds(CUE.mark) + order * seconds(STAGGER * 1.6);

    // Animate the width attribute. An SVG scale would also scale the corner
    // radius and line weight.
    timeline.to(
      trail.solid,
      { attr: { width: TRAIL.covered }, duration: seconds(DURATION.cinematic), ease: 'power2.out' },
      from,
    );

    trail.dots.forEach((dot, index) => {
      timeline.to(
        dot,
        {
          opacity: trail.rest[index] ?? 1,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
        },
        from + seconds(0.22) + index * seconds(STAGGER),
      );
    });
  });
};

/* ---- The frame --------------------------------------------------------------------- */

/**
 * The closing frame: three bands, one per beat. All bands are laid out from the
 * start, dark, so nothing reflows and each beat only lights a band.
 * Hues: blue for the theoretical claims, amber for the four audiences, violet
 * for the boundary.
 */
export function createStanding(): Standing {
  const bands: readonly Band[] = [...STANDING_BANDS.map(buildBand), buildHorizon()];

  const element = el('div', {
    className: 'std',
    children: bands.map((band) => band.element),
  });

  const everything = bands.flatMap(contentsOf);

  return {
    element,

    reveal(index, settle) {
      gsap.killTweensOf(everything);
      const timeline = gsap.timeline();
      const target = Math.max(0, Math.min(index, bands.length - 1));

      bands.forEach((band, position) => {
        if (position > target) {
          setDark(band);
          return;
        }
        // Earlier bands are set lit without animation, so jumping to a beat
        // gives the same frame as stepping to it.
        if (position < target || settle) {
          setLit(band);
          return;
        }
        setDark(band);
        lightBand(timeline, band);
      });

      return timeline;
    },
  };
}
