import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  ATTRIBUTE_FAMILIES,
  CLOSING_CONDITION,
  CONDITIONING,
  COST_LABELS,
  ENABLES,
  ENABLES_EYEBROW,
  MASKING,
  PRODUCTS,
  SHOWCASE,
  type ProductId,
} from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import { createWipe, hidden, shown } from './wipeMask';
import './c5-palette.css';
import './enables.css';

export interface Enables {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const CARD = { width: 320, height: 212 } as const;

const text = (content: string, className: string, attrs: Record<string, string> = {}) => {
  const node = svg('text', { class: className, ...attrs });
  node.textContent = content;
  return node;
};

const art = (): SVGSVGElement =>
  svg('svg', { class: 'en-art', viewBox: `0 0 ${CARD.width} ${CARD.height}` });

const named = <T extends { key: string }>(list: readonly T[], key: string): T => {
  const found = list.find((entry) => entry.key === key);
  if (!found) throw new Error(`C5: "${key}" is not on file.`);
  return found;
};

interface Art {
  readonly element: SVGSVGElement;
  build(line: gsap.core.Timeline, at: number): void;
  settle(): void;
  /** Nothing drawn, because this card's beat has not been reached. */
  clear(): void;
}

/** The eighteen indicators laid out in five family blocks along one axis. */
const comb = (width: number, gap: number, familyGap: number) => {
  const counts = ATTRIBUTE_FAMILIES.map((family) => family.attributes.length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const span = total * width + (total - counts.length) * gap + (counts.length - 1) * familyGap;

  const slots: { x: number; family: string }[] = [];
  let x = (CARD.width - span) / 2;
  const left = x;

  for (const [index, family] of ATTRIBUTE_FAMILIES.entries()) {
    for (let member = 0; member < counts[index]!; member += 1) {
      slots.push({ x, family: family.key });
      x += width + gap;
    }
    x += familyGap - gap;
  }

  return { slots, left, right: left + span };
};

/* ---- 01. Beyond cost and availability -------------------------------------------- */

/**
 * Two movements. The cost bar splits into the eighteen indicators the
 * recommendation reads, and what that leaves behind heads a comparison: the
 * shortlist cost alone produces against the one the model produces. The
 * cheapest alternative is second in the recommendation's own column, and the
 * one it promotes to first is what the card exists to show.
 */
function profileArt(): Art {
  const element = art();

  const BAR_WIDTH = 9;
  const strip = comb(BAR_WIDTH, 3, 10);
  const STRIP_TOP = 12;
  const STRIP_HEIGHT = 26;
  const SEED = { x: CARD.width / 2 - 6, width: 12, top: 8, height: 34 } as const;

  const seed = svg('rect', {
    class: 'en-seed',
    x: String(SEED.x),
    y: String(SEED.top),
    width: String(SEED.width),
    height: String(SEED.height),
    rx: '3',
  });
  const seedLabel = text('Cost', 'en-seed-label', {
    x: String(CARD.width / 2),
    y: String(SEED.top + SEED.height + 15),
    'text-anchor': 'middle',
  });

  const bars = strip.slots.map((slot) => {
    const bar = svg('rect', {
      class: 'en-strip-bar',
      x: String(slot.x),
      y: String(STRIP_TOP),
      width: String(BAR_WIDTH),
      height: String(STRIP_HEIGHT),
      rx: '3',
    });
    if (slot.family === 'economic') bar.dataset['seed'] = 'true';
    return bar;
  });
  const economic = strip.slots.findIndex((slot) => slot.family === 'economic');

  const rule = svg('line', {
    class: 'en-hairline',
    x1: String(strip.left),
    y1: '54',
    x2: String(strip.right),
    y2: '54',
  });

  const PIP_R = 11.5;
  const COL_LEFT = 42;
  const COL_RIGHT = CARD.width - 42;
  const ROW_TOP = 96;
  const ROW_STEP = 27;
  const rowY = (rank: number): number => ROW_TOP + rank * ROW_STEP;

  const headLeft = text(COST_LABELS.cost, 'en-column-head', {
    x: String(COL_LEFT),
    y: '73',
    'text-anchor': 'middle',
  });
  const headRight = text(COST_LABELS.model, 'en-column-head', {
    x: String(COL_RIGHT),
    y: '73',
    'text-anchor': 'middle',
  });

  const from = SHOWCASE.cost;
  const to = SHOWCASE.recommended;

  /*
   * Two marks carry colour and nothing else does.
   *
   * On the left, the alternative cost would pick. On the right, the one the
   * full picture picks. Every other token on either side is the same neutral,
   * because a column that tints three of its five says the ordering is about
   * those three when it is about the one at the top.
   */
  const costPick = from[0]!;
  const modelPick = to[0]!;

  const standingOf = (id: ProductId, side: 'cost' | 'model'): string => {
    if (side === 'cost') return id === costPick ? 'cost' : 'rest';
    return id === modelPick ? 'lead' : 'rest';
  };

  const nodeFor = (id: ProductId, x: number, rank: number, side: 'cost' | 'model') => {
    const group = svg('g', { class: 'en-node-row' });
    group.dataset['standing'] = standingOf(id, side);
    group.append(
      svg('circle', { class: 'en-pip', cx: String(x), cy: String(rowY(rank)), r: String(PIP_R) }),
      text(id, 'en-pip-letter', {
        x: String(x),
        y: String(rowY(rank) + 4),
        'text-anchor': 'middle',
      }),
    );
    return group;
  };

  const leftNodes = from.map((id, rank) => nodeFor(id, COL_LEFT, rank, 'cost'));
  const rightNodes = to.map((id, rank) => nodeFor(id, COL_RIGHT, rank, 'model'));

  /*
   * Centre to centre, with the tokens painted opaque on top of the links.
   *
   * Ending a connector on the circumference leaves the join at the mercy of the
   * stroke width, the anti-aliasing and the rounding of the scale factor, and
   * it showed as a gap on one side and an overshoot on the other. Running the
   * line into the middle of each token and letting the token cover the rest
   * makes the two ends identical by construction: what is visible emerges
   * exactly at the rim, on both sides, at every row.
   */
  const LINK_X1 = COL_LEFT;
  const LINK_X2 = COL_RIGHT;
  const MIDLINE = (LINK_X1 + LINK_X2) / 2;

  /*
   * The two connectors that carry a choice are drawn as a gradient along their
   * own span: the cost pick leaves its colour behind on the way across, and
   * the model's pick takes its colour on. Everything else stays neutral.
   */
  const gradients = svg('defs');

  /**
   * A ramp that fades a colour out to nothing along the span.
   *
   * The accent is an overlay, so where it reaches zero the neutral connector
   * underneath is all that is left. That is what makes the far end of a
   * carrying link identical to every other link, in weight as well as tone: a
   * stroke cannot taper, but an overlay that disappears can.
   */
  const rampFor = (id: string, colour: string, towards: 'right' | 'left'): string => {
    const ramp = svg('linearGradient', {
      id,
      gradientUnits: 'userSpaceOnUse',
      x1: String(LINK_X1),
      y1: '0',
      x2: String(LINK_X2),
      y2: '0',
    });
    const solid = towards === 'right' ? '0%' : '100%';
    const clear = towards === 'right' ? '100%' : '0%';
    const stops = [
      svg('stop', { offset: solid, 'stop-color': colour, 'stop-opacity': '1' }),
      svg('stop', { offset: '50%', 'stop-color': colour, 'stop-opacity': '0.42' }),
      svg('stop', { offset: clear, 'stop-color': colour, 'stop-opacity': '0' }),
    ];
    ramp.append(...(towards === 'right' ? stops : [stops[2]!, stops[1]!, stops[0]!]));
    gradients.appendChild(ramp);
    return `url(#${id})`;
  };

  const leaving = rampFor('en-ramp-leaving', 'var(--c5-contested)', 'right');
  const arriving = rampFor('en-ramp-arriving', 'var(--c5-lead)', 'left');
  element.appendChild(gradients);

  const pathFor = (id: ProductId): string => {
    const start = rowY(from.indexOf(id));
    const end = rowY(to.indexOf(id));
    return `M ${LINK_X1} ${start} C ${MIDLINE} ${start} ${MIDLINE} ${end} ${LINK_X2} ${end}`;
  };

  // Every connector is the same neutral line. Two of them carry an accent on
  // top of it, and the accent is what fades.
  const links = from.map((id) => svg('path', { class: 'en-link', d: pathFor(id) }));

  const accents = [costPick, modelPick].map((id) => {
    const accent = svg('path', { class: 'en-link-accent', d: pathFor(id) });
    accent.style.stroke = id === costPick ? leaving : arriving;
    return accent;
  });

  const promoted = rightNodes[to.indexOf(SHOWCASE.promoted)]!;

  /*
   * The connectors are revealed by a clip rectangle in the board's own units,
   * never by `stroke-dasharray`: on a scaled board the dash unit and the
   * reported path length disagree and the line stops short of its end.
   */
  const wipe = createWipe(element, CARD.width, CARD.height, 'x');
  const linkGroup = svg('g', { class: 'en-links', 'clip-path': wipe.clip });
  linkGroup.append(...links, ...accents);

  element.append(
    linkGroup,
    ...leftNodes,
    ...rightNodes,
    headLeft,
    headRight,
    rule,
    ...bars,
    seed,
    seedLabel,
  );

  const columns = [...leftNodes, ...rightNodes, headLeft, headRight];

  const settle = (): void => {
    gsap.set([seed, seedLabel], { opacity: 0 });
    gsap.set(bars, { opacity: 1, scaleY: 1, x: 0 });
    gsap.set([rule, ...columns], { opacity: 1, y: 0, scale: 1 });
    gsap.set([...links, ...accents], { opacity: 1 });
    gsap.set(wipe.rect, shown(wipe));
  };

  const clear = (): void => {
    gsap.set([seed, seedLabel, rule, ...columns, ...links, ...accents, ...bars], { opacity: 0 });
    gsap.set(wipe.rect, hidden(wipe));
  };

  const build = (line: gsap.core.Timeline, start: number): void => {
    clear();
    gsap.set([...columns, ...bars], { scale: 1, x: 0, y: 0, scaleY: 1 });
    gsap.set([...links, ...accents], { opacity: 1 });

    line
      .fromTo(
        seed,
        { opacity: 0, scaleY: 0.2 },
        {
          opacity: 1,
          scaleY: 1,
          transformOrigin: 'center bottom',
          duration: seconds(DURATION.slow),
          ease: 'back.out(1.8)',
        },
        start,
      )
      .fromTo(
        seedLabel,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
        start + seconds(DURATION.quick),
      );

    const fan = start + seconds(DURATION.slow * 1.15);
    line
      .to(seed, { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit }, fan)
      .to(seedLabel, { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit }, fan);

    for (const [index, bar] of bars.entries()) {
      line.fromTo(
        bar,
        { opacity: 0, x: SEED.x - strip.slots[index]!.x, scaleY: 1.8 },
        {
          opacity: 1,
          x: 0,
          scaleY: 1,
          transformOrigin: 'center center',
          duration: seconds(DURATION.cinematic * 0.8),
          ease: 'expo.out',
        },
        fan + Math.abs(index - economic) * seconds(STAGGER * 0.36),
      );
    }

    const compare = fan + seconds(DURATION.cinematic * 0.8);

    line
      .to(rule, { opacity: 1, duration: seconds(DURATION.slow), ease: EASE.enter }, compare)
      .fromTo(
        [headLeft, headRight],
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 2),
        },
        compare,
      )
      .fromTo(
        leftNodes,
        { opacity: 0, scale: 0.5 },
        {
          opacity: 1,
          scale: 1,
          transformOrigin: 'center center',
          duration: seconds(DURATION.slow),
          ease: 'back.out(2)',
          stagger: seconds(STAGGER * 1.4),
        },
        compare + seconds(DURATION.quick),
      );

    // One left-to-right gesture, because the two columns are formed together.
    const cross = compare + seconds(DURATION.slow);
    line.fromTo(
      wipe.rect,
      hidden(wipe),
      { ...shown(wipe), duration: seconds(DURATION.cinematic * 1.1), ease: 'power2.inOut' },
      cross,
    );

    /*
     * One tween per token, and never two on the same one at once.
     *
     * The promoted token used to take an entry tween and an overlapping pulse.
     * The shorter of the two finished first and left the longer one to end on
     * a value it had recorded mid-flight, so the token came to rest away from
     * its row and only snapped back when the next beat settled the card. It
     * now lands once, with the overshoot carried by the ease.
     */
    const landing = cross + seconds(DURATION.slow * 0.9);
    line.fromTo(
      rightNodes.filter((node) => node !== promoted),
      { opacity: 0, scale: 0.5 },
      {
        opacity: 1,
        scale: 1,
        transformOrigin: 'center center',
        duration: seconds(DURATION.slow),
        ease: 'back.out(2)',
        stagger: seconds(STAGGER * 1.4),
      },
      landing,
    );

    line.fromTo(
      promoted,
      { opacity: 0, scale: 0.3 },
      {
        opacity: 1,
        scale: 1,
        transformOrigin: 'center center',
        duration: seconds(DURATION.cinematic * 0.85),
        ease: 'elastic.out(1, 0.55)',
      },
      landing + seconds(DURATION.slow * 0.7),
    );
  };

  return { element, build, settle, clear };
}

/* ---- 02. Tailored to the decision ------------------------------------------------- */

interface Dial {
  readonly group: SVGGElement;
  readonly segments: SVGPathElement[];
  readonly pointer: SVGGElement;
  readonly origin: string;
  angleOf(index: number): number;
}

const dialAt = (cx: number, cy: number, radius: number, count: number, label: string): Dial => {
  const group = svg('g', { class: 'en-dial' });
  const GAP = Math.min(14, 360 / count / 3);
  const sweep = 360 / count;

  const on = (angle: number, r: number): [number, number] => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return [cx + Math.cos(radians) * r, cy + Math.sin(radians) * r];
  };

  const segments = Array.from({ length: count }, (_, index) => {
    const start = index * sweep + GAP / 2;
    const end = (index + 1) * sweep - GAP / 2;
    const [x1, y1] = on(start, radius);
    const [x2, y2] = on(end, radius);
    return svg('path', {
      class: 'en-segment',
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2}`,
    });
  });

  const pointer = svg('g', { class: 'en-pointer' });
  pointer.append(
    svg('line', {
      class: 'en-pointer-arm',
      x1: String(cx),
      y1: String(cy),
      x2: String(cx),
      y2: String(cy - radius + 10),
    }),
    svg('circle', { class: 'en-pointer-tip', cx: String(cx), cy: String(cy - radius), r: '4' }),
  );

  group.append(
    svg('circle', { class: 'en-dial-face', cx: String(cx), cy: String(cy), r: String(radius - 7) }),
    ...segments,
    pointer,
    svg('circle', { class: 'en-dial-hub', cx: String(cx), cy: String(cy), r: '2.5' }),
    text(label, 'en-dial-label', {
      x: String(cx),
      y: String(cy + radius + 17),
      'text-anchor': 'middle',
    }),
  );

  return {
    group,
    segments,
    pointer,
    origin: `${cx} ${cy}`,
    angleOf: (index) => (index + 0.5) * sweep,
  };
};

/**
 * Two settings, and the same candidates re-routing into different rank slots.
 *
 * The alternatives stay where they are on the left and the ribbons move, so
 * what the card shows is the ordering being a function of the two dials rather
 * than a property of the products.
 */
function decisionArt(): Art {
  const element = art();

  const who = dialAt(80, 40, 28, CONDITIONING.archetypes, 'Who is deciding');
  const what = dialAt(240, 40, 28, CONDITIONING.applications, 'What it is for');
  element.append(who.group, what.group);

  const ROW_TOP = 108;
  const ROW_STEP = 22;
  const rowY = (index: number): number => ROW_TOP + index * ROW_STEP;
  const TOKEN_X = 22;
  const SLOT_X = 298;
  // Centre to centre, covered at both ends by the mark that sits on top.
  const MIDLINE = (TOKEN_X + SLOT_X) / 2;

  const slots = PRODUCTS.map((_, index) => {
    const group = svg('g', { class: 'en-slot' });
    group.append(
      svg('circle', { class: 'en-slot-disc', cx: String(SLOT_X), cy: String(rowY(index)), r: '10' }),
      text(String(index + 1), 'en-slot-index', {
        x: String(SLOT_X),
        y: String(rowY(index) + 4),
        'text-anchor': 'middle',
      }),
    );
    return group;
  });

  const ribbons = PRODUCTS.map(() => svg('path', { class: 'en-ribbon' }));

  const tokens = PRODUCTS.map((id, index) => {
    const group = svg('g', { class: 'en-node-row' });
    group.append(
      svg('circle', { class: 'en-pip', cx: String(TOKEN_X), cy: String(rowY(index)), r: '10' }),
      text(id, 'en-pip-letter', {
        x: String(TOKEN_X),
        y: String(rowY(index) + 4),
        'text-anchor': 'middle',
      }),
    );
    return { id, group, y: rowY(index) };
  });

  element.append(...ribbons, ...slots, ...tokens.map((token) => token.group));

  const route = (index: number, endY: number): void => {
    const startY = tokens[index]!.y;
    ribbons[index]!.setAttribute(
      'd',
      `M ${TOKEN_X} ${startY} C ${MIDLINE} ${startY} ${MIDLINE} ${endY} ${SLOT_X} ${endY}`,
    );
  };

  const HOME = SHOWCASE.contexts[0]!;
  const stops = SHOWCASE.contexts.slice(1);
  const LAST = SHOWCASE.contexts[SHOWCASE.contexts.length - 1]!;

  const light = (dial: Dial, index: number): void => {
    for (const [position, segment] of dial.segments.entries()) {
      segment.dataset['active'] = String(position === index);
    }
  };

  const mark = (order: readonly ProductId[]): void => {
    for (const [index, token] of tokens.entries()) {
      const rank = order.indexOf(token.id);
      token.group.dataset['standing'] = rank === 0 ? 'lead' : 'rest';
      ribbons[index]!.dataset['standing'] = rank === 0 ? 'lead' : 'rest';
    }
    for (const [rank, slot] of slots.entries()) {
      slot.dataset['standing'] = rank === 0 ? 'lead' : 'rest';
    }
  };

  const place = (order: readonly ProductId[]): void => {
    for (const [index, token] of tokens.entries()) {
      route(index, rowY(order.indexOf(token.id)));
    }
    mark(order);
  };

  const settle = (): void => {
    gsap.set([who.group, what.group], { opacity: 1, scale: 1 });
    gsap.set(who.pointer, { rotation: who.angleOf(LAST.who), svgOrigin: who.origin });
    gsap.set(what.pointer, { rotation: what.angleOf(LAST.what), svgOrigin: what.origin });
    light(who, LAST.who);
    light(what, LAST.what);
    gsap.set([...ribbons, ...slots, ...tokens.map((token) => token.group)], { opacity: 1 });
    place(LAST.order);
  };

  const clear = (): void => {
    gsap.set(
      [who.group, what.group, ...ribbons, ...slots, ...tokens.map((token) => token.group)],
      { opacity: 0 },
    );
  };

  const build = (line: gsap.core.Timeline, start: number): void => {
    clear();
    gsap.set([who.group, what.group], { scale: 1 });
    gsap.set(who.pointer, { rotation: who.angleOf(HOME.who), svgOrigin: who.origin });
    gsap.set(what.pointer, { rotation: what.angleOf(HOME.what), svgOrigin: what.origin });
    light(who, HOME.who);
    light(what, HOME.what);
    place(HOME.order);

    line
      .fromTo(
        [who.group, what.group],
        { opacity: 0, scale: 0.84 },
        {
          opacity: 1,
          scale: 1,
          transformOrigin: 'center center',
          duration: seconds(DURATION.cinematic * 0.6),
          ease: 'back.out(1.6)',
          stagger: seconds(STAGGER * 2),
        },
        start,
      )
      .fromTo(
        tokens.map((token) => token.group),
        { opacity: 0, scale: 0.5 },
        {
          opacity: 1,
          scale: 1,
          transformOrigin: 'center center',
          duration: seconds(DURATION.slow),
          ease: 'back.out(2)',
          stagger: seconds(STAGGER * 1.2),
        },
        start + seconds(DURATION.normal),
      )
      .fromTo(
        slots,
        { opacity: 0 },
        {
          opacity: 1,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.2),
        },
        start + seconds(DURATION.normal),
      )
      .fromTo(
        ribbons,
        { opacity: 0 },
        {
          opacity: 1,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.2),
        },
        start + seconds(DURATION.slow * 0.7),
      );

    let at = start + seconds(DURATION.cinematic * 0.9);
    let previous = HOME;

    for (const stop of stops) {
      if (stop.who !== previous.who) {
        line.to(
          who.pointer,
          {
            rotation: who.angleOf(stop.who),
            svgOrigin: who.origin,
            duration: seconds(DURATION.slow * 0.85),
            ease: 'back.out(1.3)',
            onStart: () => light(who, stop.who),
          },
          at,
        );
      }
      if (stop.what !== previous.what) {
        line.to(
          what.pointer,
          {
            rotation: what.angleOf(stop.what),
            svgOrigin: what.origin,
            duration: seconds(DURATION.slow * 0.85),
            ease: 'back.out(1.3)',
            onStart: () => light(what, stop.what),
          },
          at,
        );
      }

      // A path cannot be tweened directly, so each ribbon carries the rank slot
      // it is heading for and redraws itself as that number travels.
      const held = previous.order;
      for (const [index, token] of tokens.entries()) {
        const carrier = { y: rowY(held.indexOf(token.id)) };
        line.to(
          carrier,
          {
            y: rowY(stop.order.indexOf(token.id)),
            duration: seconds(DURATION.slow),
            ease: 'power3.inOut',
            onUpdate: () => route(index, carrier.y),
          },
          at + seconds(DURATION.quick),
        );
      }
      line.call(() => mark(stop.order), undefined, at + seconds(DURATION.slow * 0.7));

      previous = stop;
      at += seconds(DURATION.cinematic * 0.95);
    }
  };

  return { element, build, settle, clear };
}

/* ---- 03. Designed for uncertainty -------------------------------------------------- */

/**
 * Nine of the eighteen indicators go dark. Every score moves a little and the
 * ordering does not: the uncertainty is carried in the scores rather than
 * hidden, and the recommendation still stands.
 */
function incompleteArt(): Art {
  const element = art();
  const condition = named(MASKING, CLOSING_CONDITION);

  const SLAB = { width: 10, gap: 3, familyGap: 10, top: 14, height: 42 } as const;
  const strip = comb(SLAB.width, SLAB.gap, SLAB.familyGap);

  /*
   * Each indicator is two marks in the same place: the value, and the outline
   * that is left once the value is gone. Removal crossfades between them from
   * the top down, so the evidence dissolves instead of switching off.
   */
  const slabs = strip.slots.map((slot) => {
    const shared = {
      x: String(slot.x),
      y: String(SLAB.top),
      width: String(SLAB.width),
      height: String(SLAB.height),
      rx: '3',
    };
    const value = svg('rect', { class: 'en-slab', ...shared });
    const outline = svg('rect', { class: 'en-slab-absent', ...shared, opacity: '0' });
    value.dataset['family'] = slot.family;
    return { value, outline, family: slot.family };
  });
  const gone = slabs.filter((slab) => condition.families.includes(slab.family));
  const values = slabs.map((slab) => slab.value);
  const outlines = slabs.map((slab) => slab.outline);
  element.append(...outlines, ...values);

  const ROW_TOP = 86;
  const ROW_STEP = 24;
  const BAR_X = 34;
  const BAR_MAX = 240;

  const rows = SHOWCASE.recommended.map((id, rank) => {
    const y = ROW_TOP + rank * ROW_STEP;
    const group = svg('g', { class: 'en-row' });
    group.dataset['standing'] = rank === 0 ? 'lead' : 'rest';

    // The interval the score is known to within, once the evidence is gone.
    const spread = svg('rect', {
      class: 'en-spread',
      x: String(BAR_X),
      y: String(y - 2),
      width: '0',
      height: '15',
      rx: '7.5',
    });
    const bar = svg('rect', {
      class: 'en-bar',
      x: String(BAR_X),
      y: String(y),
      width: '0',
      height: '11',
      rx: '5.5',
    });
    group.append(spread, bar, text(id, 'en-letter', { x: '14', y: String(y + 10) }));
    element.appendChild(group);
    return { id, group, bar, spread, rank, y };
  });

  const hold = svg('rect', {
    class: 'en-hold',
    x: '6',
    y: String(ROW_TOP - 7),
    width: String(CARD.width - 12),
    height: '25',
    rx: '12',
  });
  element.insertBefore(hold, rows[0]!.group);

  const settle = (): void => {
    gsap.set(values, { opacity: 1, scaleY: 1 });
    gsap.set(outlines, { opacity: 0, scaleY: 1 });
    for (const slab of gone) {
      gsap.set(slab.value, { opacity: 0 });
      gsap.set(slab.outline, { opacity: 1 });
    }
    gsap.set(hold, { opacity: 1, scaleX: 1 });
    for (const row of rows) {
      const before = SHOWCASE.scores[row.id];
      const after = SHOWCASE.uncertain[row.id];
      gsap.set(row.group, { opacity: 1, x: 0 });
      gsap.set(row.bar, { attr: { width: after * BAR_MAX } });
      gsap.set(row.spread, {
        opacity: 1,
        attr: {
          x: BAR_X + Math.min(before, after) * BAR_MAX - 4,
          width: Math.abs(after - before) * BAR_MAX + 8,
        },
      });
    }
  };

  const clear = (): void => {
    gsap.set([...values, ...outlines, hold], { opacity: 0 });
    gsap.set(
      rows.map((row) => row.group),
      { opacity: 0 },
    );
  };

  const build = (line: gsap.core.Timeline, start: number): void => {
    clear();
    gsap.set([...values, ...outlines], { scaleY: 1, y: 0 });
    for (const row of rows) {
      gsap.set(row.group, { x: 0 });
      gsap.set(row.bar, { attr: { width: 0 } });
      gsap.set(row.spread, { opacity: 0, attr: { x: BAR_X, width: 0 } });
    }

    line.fromTo(
      values,
      { opacity: 0, scaleY: 0.25 },
      {
        opacity: 1,
        scaleY: 1,
        transformOrigin: 'center center',
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        stagger: { each: seconds(STAGGER * 0.5) },
      },
      start,
    );

    for (const row of rows) {
      const at = start + seconds(DURATION.normal) + row.rank * seconds(STAGGER * 1.5);
      line
        .set(row.group, { opacity: 1 }, at)
        .fromTo(
          row.bar,
          { attr: { width: 0 } },
          {
            attr: { width: SHOWCASE.scores[row.id] * BAR_MAX },
            duration: seconds(DURATION.cinematic * 0.55),
            ease: EASE.enter,
          },
          at,
        );
    }

    /* The value drains downward and the outline it leaves rises in behind it,
       one indicator after the next, slowly enough to be watched. */
    const removal = start + seconds(DURATION.cinematic * 0.9);
    const drain = { each: seconds(STAGGER * 1.5) } as const;

    line
      .to(
        gone.map((slab) => slab.value),
        {
          opacity: 0,
          scaleY: 0.08,
          transformOrigin: 'center bottom',
          duration: seconds(DURATION.cinematic * 0.7),
          ease: 'power2.inOut',
          stagger: drain,
        },
        removal,
      )
      .fromTo(
        gone.map((slab) => slab.outline),
        { opacity: 0, scaleY: 0.55 },
        {
          opacity: 1,
          scaleY: 1,
          transformOrigin: 'center bottom',
          duration: seconds(DURATION.cinematic * 0.8),
          ease: EASE.enter,
          stagger: drain,
        },
        removal + seconds(DURATION.normal * 0.7),
      );

    // Every score moves a little, and not one of them moves past its neighbour.
    const drift = removal + seconds(DURATION.cinematic * 0.85) + gone.length * seconds(STAGGER * 1.5);
    for (const row of rows) {
      const before = SHOWCASE.scores[row.id];
      const after = SHOWCASE.uncertain[row.id];
      const low = Math.min(before, after);
      const width = Math.abs(after - before) * BAR_MAX + 8;

      line
        .to(
          row.bar,
          {
            attr: { width: after * BAR_MAX },
            duration: seconds(DURATION.cinematic * 0.7),
            ease: 'power2.inOut',
          },
          drift + row.rank * seconds(STAGGER),
        )
        .fromTo(
          row.spread,
          { opacity: 0, attr: { x: BAR_X + before * BAR_MAX, width: 0 } },
          {
            opacity: 1,
            attr: { x: BAR_X + low * BAR_MAX - 4, width },
            duration: seconds(DURATION.cinematic * 0.7),
            ease: 'power2.inOut',
          },
          drift + row.rank * seconds(STAGGER),
        );
    }

    line.fromTo(
      hold,
      { opacity: 0, scaleX: 0.82 },
      {
        opacity: 1,
        scaleX: 1,
        transformOrigin: 'center center',
        duration: seconds(DURATION.cinematic * 0.7),
        ease: 'back.out(1.7)',
      },
      drift + seconds(DURATION.cinematic * 0.8),
    );
  };

  return { element, build, settle, clear };
}

/* ---- The panel -------------------------------------------------------------------- */

/**
 * Three cards over three beats on one held composition.
 *
 * The three cards arrive together on the first beat and never move again. Each
 * later beat runs exactly one figure and touches nothing else on the wall.
 */
export function createEnables(): Enables {
  const arts = [profileArt(), decisionArt(), incompleteArt()];

  const cards = ENABLES.map((claim, index) =>
    el('article', {
      className: 'en-card',
      attrs: { 'data-key': claim.key },
      children: [
        el('p', { className: 'en-title', text: claim.title }),
        el('p', { className: 'en-body', text: claim.body }),
        el('div', { className: 'en-stage', children: [arts[index]!.element] }),
      ],
    }),
  );

  const eyebrow = el('p', { className: 'en-eyebrow', text: ENABLES_EYEBROW });
  const element = el('div', {
    className: 'c5 en',
    children: [eyebrow, el('div', { className: 'en-cards', children: cards })],
  });

  const writeState = (step: number): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([eyebrow, ...cards], { opacity: 1, y: 0, scale: 1 });
    for (const [index, piece] of arts.entries()) {
      if (index <= step) piece.settle();
      else piece.clear();
    }
  };

  return {
    element,
    beats: ENABLES.length,

    play(step, settle) {
      if (settle) {
        writeState(step);
        return null;
      }

      writeState(step - 1);
      const line = gsap.timeline();

      if (step === 0) {
        line
          .from(eyebrow, { opacity: 0, y: 12, duration: seconds(DURATION.slow), ease: EASE.enter }, 0)
          .from(
            cards,
            {
              opacity: 0,
              y: 28,
              duration: seconds(DURATION.cinematic * 0.7),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 3),
            },
            seconds(DURATION.quick),
          );
      }

      arts[step]!.build(line, step === 0 ? seconds(DURATION.slow * 0.9) : 0);
      return line;
    },
  };
}
