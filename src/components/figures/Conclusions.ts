import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CONCLUSION_PANELS, type ConclusionPanel } from '@/content/act3';
import { el, svg } from '@/utilities/dom';
import './conclusions.css';

export interface Conclusions {
  readonly element: HTMLElement;
  /**
   * Sets the frame to beat `index`: panels up to it are open, later panels are
   * shut with their claim showing. Writes the full state so stepping backwards
   * works.
   */
  reveal(index: number, settle: boolean): gsap.core.Timeline;
}

/* ---- Drawing helpers ---------------------------------------------------------------- */

/** Shared SVG board size for all four drawings, so they sit in one frame. */
const BOARD = { width: 420, height: 240 } as const;

const mark = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const written: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) written[name] = String(value);
  return svg(tag, written);
};

const label = (text: string, attrs: Record<string, string | number>): SVGTextElement => {
  const node = mark('text', attrs);
  node.textContent = text;
  return node;
};

const board = (): SVGSVGElement =>
  mark('svg', {
    class: 'cc-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
    'aria-hidden': 'true',
  });

interface Drawing {
  readonly element: SVGSVGElement;
  /** Adds this drawing's build to the beat's timeline. */
  build(timeline: gsap.core.Timeline, at: number, motion: number): void;
  /**
   * Resets the drawing to its unbuilt state. Used for shut panels and when
   * stepping back, so the build can run again.
   */
  clear(): void;
  /** Every element the build animates, for `killTweensOf`. */
  readonly parts: readonly Element[];
}

/**
 * Measures the stroke length and sets it as a fully retracted dash. Returns 0
 * if `getTotalLength` throws, so the line just fades in.
 */
const retract = (node: SVGGeometryElement): number => {
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
  return length;
};

/* ---- 01 · Relative comparison ------------------------------------------------------ */

/**
 * Four candidates as overlapping value ranges with ordered markers. The values
 * cannot be separated, but their order can. Ranges are plain rounded bands
 * because they are not statistical error bars.
 */
const drawComparison = (): Drawing => {
  const element = board();

  const rows = [
    { y: 46, from: 150, to: 352, at: 252 },
    { y: 94, from: 104, to: 324, at: 216 },
    { y: 142, from: 96, to: 266, at: 180 },
    { y: 190, from: 38, to: 250, at: 142 },
  ] as const;

  const bands = rows.map((row) =>
    mark('rect', {
      class: 'cc-band',
      x: row.from,
      y: row.y - 8,
      width: row.to - row.from,
      height: 16,
      rx: 8,
    }),
  );

  const dots = rows.map((row) =>
    mark('circle', { class: 'cc-point', cx: row.at, cy: row.y, r: 5 }),
  );

  const ranks = rows.map((row, index) =>
    label(String(index + 1), {
      class: 'cc-rank',
      x: 16,
      y: row.y + 5,
      'text-anchor': 'middle',
    }),
  );

  const order = mark('polyline', {
    class: 'cc-order',
    points: rows.map((row) => `${row.at},${row.y}`).join(' '),
  });

  for (const node of [...bands, order, ...dots, ...ranks]) element.appendChild(node);
  const length = retract(order);

  return {
    element,
    parts: [...bands, ...dots, ...ranks, order],

    clear() {
      bands.forEach((node, index) =>
        gsap.set(node, { attr: { x: rows[index]!.at, width: 0 } }),
      );
      gsap.set([...dots], { opacity: 0, scale: 0 });
      gsap.set(ranks, { opacity: 0 });
      gsap.set(order, { strokeDashoffset: length });
    },

    build(timeline, at, motion) {
      // Each band grows outward from its marker.
      bands.forEach((node, index) => {
        const row = rows[index]!;
        timeline.fromTo(
          node,
          { attr: motion ? { x: row.at, width: 0 } : { x: row.from, width: row.to - row.from } },
          {
            attr: { x: row.from, width: row.to - row.from },
            duration: seconds(DURATION.cinematic) * motion,
            ease: 'power3.out',
          },
          at + index * seconds(STAGGER) * motion,
        );
      });

      timeline.fromTo(
        dots as gsap.TweenTarget,
        { opacity: motion ? 0 : 1, scale: motion ? 0 : 1 },
        {
          opacity: 1,
          scale: 1,
          duration: seconds(DURATION.slow) * motion,
          ease: 'back.out(2.4)',
          stagger: seconds(STAGGER) * motion,
        },
        at,
      );

      timeline.fromTo(
        order,
        { strokeDashoffset: motion ? length : 0 },
        {
          strokeDashoffset: 0,
          duration: seconds(DURATION.cinematic) * motion,
          ease: 'power2.inOut',
        },
        at + seconds(0.5) * motion,
      );

      timeline.fromTo(
        ranks as gsap.TweenTarget,
        { opacity: motion ? 0 : 1 },
        {
          opacity: 1,
          duration: seconds(DURATION.slow) * motion,
          ease: EASE.enter,
          stagger: seconds(STAGGER) * motion,
        },
        at + seconds(0.7) * motion,
      );
    },
  };
};

/* ---- 02 · Screening, then ranking --------------------------------------------------- */

/**
 * Nine candidates, a threshold rule, and a ranking of the five that pass. The
 * four that fail stay in place in C3's fail tone. Rank bars grow from the
 * tokens that crossed.
 */
const PASSING = [1, 2, 4, 6, 7] as const;

const drawSequence = (): Drawing => {
  const element = board();

  const start = { x: 40, top: 30, step: 22.5 } as const;
  const barY = [54, 88, 122, 156, 190] as const;
  const barW = [150, 126, 102, 78, 56] as const;
  const gateX = 116;
  const landX = 178;

  const gate = mark('line', {
    class: 'cc-gate',
    x1: gateX,
    y1: 18,
    x2: gateX,
    y2: 222,
  });

  // Empty sockets left behind when a token crosses, so the original set of
  // nine stays visible.
  const sockets = Array.from({ length: 9 }, (_, index) =>
    mark('circle', {
      class: 'cc-socket',
      cx: start.x,
      cy: start.top + index * start.step,
      r: 7.5,
    }),
  );

  const tokens = Array.from({ length: 9 }, (_, index) =>
    mark('circle', {
      class: PASSING.includes(index as (typeof PASSING)[number]) ? 'cc-token' : 'cc-token is-out',
      cx: start.x,
      cy: start.top + index * start.step,
      r: 7.5,
    }),
  );

  const bars = barW.map((width, index) =>
    mark('rect', {
      class: 'cc-bar',
      x: landX + 12,
      y: barY[index]! - 6,
      width,
      height: 12,
      rx: 6,
    }),
  );

  for (const node of [gate, ...sockets, ...bars, ...tokens]) element.appendChild(node);
  const gateLength = retract(gate);

  return {
    element,
    parts: [gate, ...sockets, ...tokens, ...bars],

    clear() {
      gsap.set(gate, { strokeDashoffset: gateLength });
      gsap.set([...sockets, ...tokens], { opacity: 0, scale: 0 });
      tokens.forEach((token, index) =>
        gsap.set(token, { attr: { cx: start.x, cy: start.top + index * start.step } }),
      );
      bars.forEach((bar) => gsap.set(bar, { attr: { width: 0 } }));
    },

    build(timeline, at, motion) {
      timeline.fromTo(
        gate,
        { strokeDashoffset: motion ? gateLength : 0 },
        {
          strokeDashoffset: 0,
          duration: seconds(DURATION.slow) * motion,
          ease: 'power2.inOut',
        },
        at,
      );

      timeline.fromTo(
        [...sockets, ...tokens] as gsap.TweenTarget,
        { opacity: motion ? 0 : 1, scale: motion ? 0 : 1 },
        {
          opacity: 1,
          scale: 1,
          duration: seconds(DURATION.normal) * motion,
          ease: 'back.out(2)',
          stagger: seconds(STAGGER * 0.5) * motion,
        },
        at + seconds(0.1) * motion,
      );

      // Passing tokens move to their rank. Animating cx/cy keeps each token's
      // centre aligned with its bar start.
      PASSING.forEach((index, order) => {
        timeline.fromTo(
          tokens[index]!,
          {
            attr: motion
              ? { cx: start.x, cy: start.top + index * start.step }
              : { cx: landX, cy: barY[order]! },
          },
          {
            attr: { cx: landX, cy: barY[order]! },
            duration: seconds(DURATION.cinematic) * motion,
            ease: 'power2.inOut',
          },
          at + seconds(0.62 + order * 0.06) * motion,
        );
      });

      // Per-bar tweens because each bar has its own width.
      bars.forEach((bar, index) => {
        timeline.fromTo(
          bar,
          { attr: { width: motion ? 0 : barW[index]! } },
          {
            attr: { width: barW[index]! },
            duration: seconds(DURATION.slow) * motion,
            ease: 'power3.out',
          },
          at + seconds(1.35 + index * 0.06) * motion,
        );
      });
    },
  };
};

/* ---- 03 · Missing and inferred values ----------------------------------------------- */

/**
 * The corpus as a grid: nine fields across, five products down. Missing cells
 * use the Act I dash and are clustered, since missingness has structure. Three
 * are filled with inferred values in C4's violet, kept distinct from declared
 * values. Bars below show how often each field is reported.
 */
const CELL = { width: 24, height: 17, pitchX: 30, pitchY: 23, x: 46, y: 26 } as const;
const COLUMNS = 9;
const ROWS = 5;
const MISSING: Readonly<Record<number, readonly number[]>> = {
  2: [2],
  3: [0, 3],
  4: [1, 2, 3],
  5: [0, 1, 2, 4],
  6: [2],
  7: [1, 3, 4],
  8: [0, 2, 3, 4],
};
const INFERRED: readonly (readonly [number, number])[] = [
  [4, 2],
  [7, 3],
  [8, 2],
];

const drawEvidence = (): Drawing => {
  const element = board();

  const known: SVGElement[] = [];
  const absent: SVGElement[] = [];
  const inferred: SVGElement[] = [];

  const isInferred = (column: number, row: number): boolean =>
    INFERRED.some(([c, r]) => c === column && r === row);

  for (let column = 0; column < COLUMNS; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const gone = (MISSING[column] ?? []).includes(row);
      const cell = mark('rect', {
        class: gone ? (isInferred(column, row) ? 'cc-cell is-inferred' : 'cc-cell is-absent') : 'cc-cell',
        x: CELL.x + column * CELL.pitchX,
        y: CELL.y + row * CELL.pitchY,
        width: CELL.width,
        height: CELL.height,
        rx: 3,
      });
      element.appendChild(cell);
      if (!gone) known.push(cell);
      else if (isInferred(column, row)) inferred.push(cell);
      else absent.push(cell);
    }
  }

  const base = 216;
  const reach = 54;
  const bars = Array.from({ length: COLUMNS }, (_, column) => {
    const gone = (MISSING[column] ?? []).length;
    const height = ((ROWS - gone) / ROWS) * reach;
    return mark('rect', {
      class: 'cc-coverage',
      x: CELL.x + column * CELL.pitchX,
      y: base - height,
      width: CELL.width,
      height,
      rx: 2,
    });
  });

  const heights = bars.map((bar) => Number(bar.getAttribute('height')));
  for (const bar of bars) element.appendChild(bar);

  return {
    element,
    parts: [...known, ...absent, ...inferred, ...bars],

    clear() {
      gsap.set([...known, ...absent], { opacity: 0 });
      gsap.set(inferred, { opacity: 0, scale: 0.88 });
      bars.forEach((bar) => gsap.set(bar, { attr: { height: 0, y: base } }));
    },

    build(timeline, at, motion) {
      timeline.fromTo(
        known as gsap.TweenTarget,
        { opacity: motion ? 0 : 1 },
        {
          opacity: 1,
          duration: seconds(DURATION.normal) * motion,
          ease: EASE.enter,
          stagger: { each: seconds(0.012) * motion, from: 'start' },
        },
        at,
      );

      timeline.fromTo(
        absent as gsap.TweenTarget,
        { opacity: motion ? 0 : 1 },
        {
          opacity: 1,
          duration: seconds(DURATION.slow) * motion,
          ease: EASE.enter,
          stagger: seconds(0.03) * motion,
        },
        at + seconds(0.42) * motion,
      );

      // Inferred values arrive last. Short duration and small scale travel,
      // since a longer `back.out` looks like the cell is correcting its position.
      timeline.fromTo(
        inferred as gsap.TweenTarget,
        { opacity: motion ? 0 : 1, scale: motion ? 0.88 : 1 },
        {
          opacity: 1,
          scale: 1,
          duration: seconds(DURATION.quick) * motion,
          ease: 'back.out(2.6)',
          stagger: seconds(STAGGER) * motion,
        },
        at + seconds(1.28) * motion,
      );

      // Animates height and y so the corner radius stays constant. Scaling
      // would distort it.
      bars.forEach((bar, index) => {
        const height = heights[index] ?? 0;
        timeline.fromTo(
          bar,
          { attr: { height: motion ? 0 : height, y: motion ? base : base - height } },
          {
            attr: { height, y: base - height },
            duration: seconds(DURATION.slow) * motion,
            ease: 'power3.out',
          },
          at + seconds(0.7 + index * 0.035) * motion,
        );
      });
    },
  };
};

/* ---- 04 · Context-dependent ranking ------------------------------------------------- */

/**
 * Slope chart: the same five candidates ranked under two contexts. Three change
 * rank, including the leader. Each context is marked only by a swatch above
 * its column.
 */
const SLOPE = { left: 128, right: 296, top: 52, step: 36 } as const;
/** Where each candidate lands under the second context. */
const REORDER = [1, 3, 0, 4, 2] as const;

const drawContext = (): Drawing => {
  const element = board();

  const leftY = (index: number): number => SLOPE.top + index * SLOPE.step;
  const rightY = (index: number): number => SLOPE.top + REORDER[index]! * SLOPE.step;

  const lines = Array.from({ length: 5 }, (_, index) => {
    const y1 = leftY(index);
    const y2 = rightY(index);
    const reach = (SLOPE.right - SLOPE.left) * 0.45;
    return mark('path', {
      class: 'cc-slope',
      'data-candidate': String(index),
      d: `M ${SLOPE.left + 13} ${y1} C ${SLOPE.left + 13 + reach} ${y1} ${SLOPE.right - 13 - reach} ${y2} ${SLOPE.right - 13} ${y2}`,
    });
  });

  const from = Array.from({ length: 5 }, (_, index) =>
    mark('circle', {
      class: 'cc-cand',
      'data-candidate': String(index),
      cx: SLOPE.left,
      cy: leftY(index),
      r: 9,
    }),
  );

  const to = Array.from({ length: 5 }, (_, index) =>
    mark('circle', {
      class: 'cc-cand',
      'data-candidate': String(index),
      cx: SLOPE.right,
      cy: rightY(index),
      r: 9,
    }),
  );

  const swatches = [
    mark('rect', { class: 'cc-ctx is-a', x: SLOPE.left - 13, y: 16, width: 26, height: 5, rx: 2.5 }),
    mark('rect', { class: 'cc-ctx is-b', x: SLOPE.right - 13, y: 16, width: 26, height: 5, rx: 2.5 }),
  ];

  for (const node of [...lines, ...swatches, ...from, ...to]) element.appendChild(node);
  const lengths = lines.map(retract);

  return {
    element,
    parts: [...lines, ...from, ...to, ...swatches],

    clear() {
      gsap.set([...swatches, ...from, ...to], { opacity: 0, scale: 0 });
      lines.forEach((line, index) => gsap.set(line, { strokeDashoffset: lengths[index]! }));
    },

    build(timeline, at, motion) {
      timeline.fromTo(
        [...swatches, ...from] as gsap.TweenTarget,
        { opacity: motion ? 0 : 1, scale: motion ? 0 : 1 },
        {
          opacity: 1,
          scale: 1,
          duration: seconds(DURATION.normal) * motion,
          ease: 'back.out(2)',
          stagger: seconds(STAGGER) * motion,
        },
        at,
      );

      lines.forEach((line, index) => {
        timeline.fromTo(
          line,
          { strokeDashoffset: motion ? lengths[index]! : 0 },
          {
            strokeDashoffset: 0,
            duration: seconds(DURATION.cinematic) * motion,
            ease: 'power2.inOut',
          },
          at + seconds(0.34 + index * 0.07) * motion,
        );
      });

      timeline.fromTo(
        to as gsap.TweenTarget,
        { opacity: motion ? 0 : 1, scale: motion ? 0 : 1 },
        {
          opacity: 1,
          scale: 1,
          duration: seconds(DURATION.slow) * motion,
          ease: 'back.out(2.4)',
          stagger: seconds(STAGGER) * motion,
        },
        at + seconds(1.15) * motion,
      );
    },
  };
};

/* ---- The frame ----------------------------------------------------------------------- */

const DRAWINGS: Record<ConclusionPanel['key'], () => Drawing> = {
  comparison: drawComparison,
  sequence: drawSequence,
  evidence: drawEvidence,
  context: drawContext,
};

interface Panel {
  readonly element: HTMLElement;
  readonly words: readonly HTMLElement[];
  readonly rule: HTMLElement;
  readonly drawing: Drawing;
  /**
   * Opening scalar (0 to 1), written to `--open` in `onUpdate`. GSAP tweening
   * `--open` directly on the element silently writes nothing.
   */
  readonly scalar: { value: number };
}

const buildPanel = (panel: ConclusionPanel): Panel => {
  const index = el('span', { className: 'cc-index', text: panel.index });
  const rule = el('div', { className: 'cc-rule' });
  const lead = el('p', { className: 'cc-lead', text: panel.lead });
  const note = el('p', { className: 'cc-note', text: panel.note });

  const words = el('div', { className: 'cc-words', children: [index, rule, lead, note] });

  const drawing = DRAWINGS[panel.key]();
  const figure = el('div', { className: 'cc-figure', children: [drawing.element] });

  const element = el('div', {
    className: 'cc-panel',
    attrs: { 'data-panel': panel.key },
    children: [words, figure],
  });
  const scalar = { value: 1 };

  // The note stays out of `words`. Its opacity comes from `--open` in CSS, and
  // an inline tween opacity would override that and show it on a shut panel.
  return { element, words: [index, lead], rule, drawing, scalar };
};

/**
 * Panel opening timing. Height, background, hairline, shadow, texture and note
 * opacity all derive from `--open` in CSS so they move together. `power2.out`
 * suits a card this large; `expo.out` snaps and then crawls.
 */
const OPENING = { seconds: 1.55, ease: 'power2.out' } as const;

/** The only place `--open` is written. */
const writeOpen = (panel: Panel): void => {
  panel.element.style.setProperty('--open', panel.scalar.value.toFixed(4));
};

const setScalar = (panel: Panel, value: number): void => {
  panel.scalar.value = value;
  writeOpen(panel);
};

/**
 * Closing frame: four findings, each opened on its own beat. All four panels
 * are laid out and show their claim from the start, so the layout never moves.
 * Each drawing depicts its finding directly and needs no legend.
 */
export function createConclusions(): Conclusions {
  const panels = CONCLUSION_PANELS.map(buildPanel);

  const element = el('div', {
    className: 'cc',
    children: panels.map((panel) => panel.element),
  });

  const everything = [
    ...panels.flatMap((panel) => [
      panel.element,
      panel.rule,
      ...panel.words,
      ...panel.drawing.parts,
    ]),
    ...panels.map((panel) => panel.scalar),
  ];

  /** Sets a panel to its open state without motion. */
  const setOpen = (panel: Panel): void => {
    setScalar(panel, 1);
    gsap.set([...panel.words], { opacity: 1, y: 0 });
    gsap.set(panel.rule, { opacity: 1, scaleX: 1 });
    // `motion: 0` gives zero-duration tweens. `progress(1).kill()` writes the
    // end state now, so a fast next beat's `killTweensOf` cannot discard it.
    const written = gsap.timeline();
    panel.drawing.build(written, 0, 0);
    written.progress(1).kill();
  };

  /** Sets a panel to its shut state: number, rule and claim visible, drawing cleared. */
  const setShut = (panel: Panel): void => {
    setScalar(panel, 0);
    gsap.set([...panel.words], { opacity: 1, y: 0 });
    gsap.set(panel.rule, { opacity: 1, scaleX: 1 });
    panel.drawing.clear();
  };

  return {
    element,

    reveal(index, settle) {
      gsap.killTweensOf(everything);
      const timeline = gsap.timeline();
      const target = Math.max(0, Math.min(index, panels.length - 1));

      panels.forEach((panel, position) => {
        if (position > target) {
          setShut(panel);
          return;
        }
        if (position < target || settle) {
          setOpen(panel);
          return;
        }

        setShut(panel);

        timeline.to(
          panel.scalar,
          {
            value: 1,
            duration: seconds(OPENING.seconds),
            ease: OPENING.ease,
            onUpdate: () => writeOpen(panel),
          },
          0,
        );

        // Starts after the panel has partly opened, so the drawing has room.
        panel.drawing.build(timeline, seconds(0.55), 1);
      });

      return timeline;
    },
  };
}
