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
   * Set the frame to beat `index`: bands up to and including it are lit, and
   * the ones after it are dark.
   *
   * Every beat writes the whole state rather than the difference from the one
   * before it. A beat that trusts its predecessor renders wrong the first time
   * the presenter steps backwards, and a defence is not walked in a straight
   * line.
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
 * A mark, retracted and measured.
 *
 * Every stroke carries its own length, so the retracted state is per element
 * and cannot be one shared value. `getTotalLength` is defined for every
 * geometry element, but a browser that disagrees should degrade to a mark that
 * fades rather than to a scene that throws on entry, and a length of zero is
 * left alone rather than written as a dash pattern of zero.
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
 * The mark the third band carries instead of an icon.
 *
 * A segment that is covered and a trail that carries on after it stops. It has
 * no scale, no axis and nothing written on it, and the three are drawn
 * identically: the column head says which boundary this is, and a mark that
 * varied in length would be read as a measurement of something nobody defined.
 *
 * The spacing grows, so the trail thins as it travels, and the dots keep
 * drifting outward once the band has settled. That drift is the only thing on
 * the foot of the frame saying the boundary is not where the work ends.
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
  /** The resting opacity each dot was given by its distance along the trail. */
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
    // One cycle, offset along itself, so the trail reads as a single thing
    // travelling outward rather than as seven things twitching.
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
  /** What rises into the band when it is lit, in reading order. */
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
 * The third band, set as a matrix.
 *
 * Three columns, one per boundary, and two rows named in a gutter at the left.
 * The reader is told which sentence is the limit and which is the work it opens
 * rather than inferring it from a colour.
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
 * A band lights on one scalar, and its chrome is a function of it.
 *
 * The ground, the tint behind the label, the inset hairline, the drop shadow
 * and the grid texture are all derived from `--open` in the sheet, so they
 * cannot cross and cannot drift, and the band reads as one surface coming up
 * rather than as five properties arriving on five clocks.
 *
 * **The ease is not `expo.out`.** `expo` spends about nine tenths of its
 * distance in the first quarter of its duration, which on a small element reads
 * as crisp and on a surface the width of the frame reads as a snap followed by
 * a crawl. `power2.out` answers the click at once and still settles.
 */
const LIGHT = { seconds: 1.5, ease: 'power2.out' } as const;

/** The rule is drawn across the band before anything stands on it. */
const RULE = { seconds: 1.15, ease: 'power2.inOut' } as const;

/**
 * In seconds from the start of a band's beat.
 *
 * The ground comes up first and the words arrive into a surface that already
 * exists. Reversing that puts text on nothing and then slides a panel under it.
 */
const CUE = { ground: 0, rule: 0.1, cells: 0.34, mark: 0.62 } as const;

const STROKE_STEP = 0.05;
const MARK_STEP = 0.13;

/** Everything a band owns, for one `killTweensOf` that misses nothing. */
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

/** The state a band rests in once it has been lit, written without motion. */
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
 * The state a band rests in before its beat.
 *
 * Not invisible. The name stays legible and the ground keeps a hairline, so the
 * frame's architecture is readable from the first beat and each click fills a
 * region that was already there.
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
 * One band coming up, as one gesture.
 *
 * The ground, then the rule drawn across it, then the columns rising into it,
 * then the marks drawing themselves onto lines that already exist. Four cues
 * inside a second and a half, which is a sequence the eye can follow and not a
 * queue it has to wait through.
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

  // Drawn from the left rather than faded: a rule that appears is a border, and
  // a rule that is drawn is a region being set out.
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

    // Only `strokeDashoffset` moves. Tweening opacity as well would override
    // `icon-faint` and bring the scaffolding up to full weight against what it
    // holds.
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

    // Absence is revealed rather than drawn: the draw writes `stroke-dasharray`
    // and would replace the dash pattern with a solid line, which says the
    // opposite of what the pattern says.
    timeline.to(
      mark.dashes as gsap.TweenTarget,
      { opacity: 0.85, duration: seconds(DURATION.slow), ease: EASE.enter },
      settled,
    );
  });

  band.trails.forEach((trail, order) => {
    const from = seconds(CUE.mark) + order * seconds(STAGGER * 1.6);

    // Drawn by width rather than by a transform: an SVG scale takes the cap
    // radius and the hairline weight with it, so a scaled rule arrives at a
    // different thickness than it settles on.
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
 * The closing frame: three bands, three beats, one title.
 *
 * **The composition is whole from the first beat.** All three bands are on the
 * surface from the moment the scene is entered, dark, with their names legible
 * and their grounds down to a hairline. A frame that grew a band per click would
 * be a slide being assembled in front of the committee; a frame whose
 * architecture is visible from the start and fills in is the argument arriving
 * inside a shape that was already stated. It also means nothing reflows: every
 * element holds its final position for the whole scene, and a beat changes only
 * light.
 *
 * **Each band owns a hue.** Blue has meant *learned* since Act I and carries the
 * theoretical claims; amber is this deck's colour for the place a person stands
 * and carries the four audiences; violet is neither, and carries the boundary.
 * Three regions that would otherwise be told apart by position alone are told
 * apart by light, and each beat brings a colour onto the frame that was not on
 * it before.
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
        // Bands earlier than the one this beat belongs to are written to their
        // lit state rather than replayed, so a jump straight to the third beat
        // lands on the same frame as walking to it.
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
