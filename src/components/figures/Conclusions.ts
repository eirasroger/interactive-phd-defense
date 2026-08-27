import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { CONCLUSION_PANELS, type ConclusionPanel } from '@/content/act3';
import { el, svg } from '@/utilities/dom';
import './conclusions.css';

export interface Conclusions {
  readonly element: HTMLElement;
  /**
   * Set the frame to beat `index`: panels up to and including it stand open,
   * and the ones after it stand shut with their claim showing.
   *
   * Every beat writes the whole state rather than the difference from the one
   * before it. A beat that trusts its predecessor renders wrong the first time
   * the presenter steps backwards, and a defence is not walked in a straight
   * line.
   */
  reveal(index: number, settle: boolean): gsap.core.Timeline;
}

/* ---- Drawing helpers ---------------------------------------------------------------- */

/**
 * The board every finding is drawn on.
 *
 * One size for all four, because four drawings that share a slide and do not
 * share a frame read as four pictures rather than as one set of evidence.
 */
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
   * Writes the state the drawing waits in before its panel is reached.
   *
   * Needed as its own operation rather than as `build` run backwards: a panel
   * that is shut has never been built, and a beat stepped back to has to put
   * every drawing after it back into a state that can be built again.
   */
  clear(): void;
  /** Everything the build writes, for one `killTweensOf` that misses nothing. */
  readonly parts: readonly Element[];
}

/**
 * Length, measured once and written as a retracted dash.
 *
 * `getTotalLength` is defined for every geometry element, but a browser that
 * disagrees should degrade to a line that fades rather than to a scene that
 * throws on entry.
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

/* ---- 01 · The ordering holds where the values do not -------------------------------- */

/**
 * Four candidates, drawn as what is actually known about them.
 *
 * Each one is an interval rather than a number, and the four intervals overlap
 * so heavily that no absolute reading separates them. The markers inside them
 * are ordered, and the line through the markers is monotonic. That is the whole
 * conclusion in one picture: the values cannot be resolved at this stage and the
 * comparison across them still can.
 *
 * **The intervals are not error bars and are deliberately not drawn as any.** A
 * whisker with a cap is a statistical claim about a distribution, and what is
 * being drawn is the far cruder fact that the value is somewhere in a range. A
 * plain rounded band says exactly that and no more.
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
      // The band grows out of its own marker, so the interval reads as
      // uncertainty opening around a value rather than as a bar arriving.
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

/* ---- 02 · Admissible first, preferred second ---------------------------------------- */

/**
 * Nine candidates, a threshold, and a ranking of what survives it.
 *
 * The two operations are drawn as two regions with a rule between them, and the
 * tokens cross it. Four do not, and they are left where they stopped in the
 * fail tone C3 declared, because a candidate that is screened out is not removed
 * from the world, it is removed from the comparison.
 *
 * The bars grow out of the tokens that reached them rather than appearing
 * beside them: the ranking is what the survivors became, and that is the
 * sequence the conclusion is about.
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

  // The socket each candidate started in, left behind when it crosses.
  //
  // Without them the left column loses four of its nine and reads as a sparse
  // scatter rather than as a set that has been filtered. The sockets keep the
  // shape of the original set on the page, which is the whole point of drawing
  // a screening step: nothing was deleted, the comparison was narrowed.
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

      // The five that pass cross the rule and take their rank. Written to the
      // geometry rather than to a transform, so the token's own centre is where
      // the bar starts and the two cannot drift apart.
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

      // Each bar carries its own width, so the retracted state is per element
      // and cannot be one shared value.
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

/* ---- 03 · What is missing, and what is recovered ------------------------------------ */

/**
 * The corpus, as a field of declared and undeclared values.
 *
 * Nine fields across, five products down. The absences are drawn in the dash the
 * candidate set and the declaration have used since Act I, and they are placed
 * in the clusters the analysis found rather than scattered: the finding is that
 * missingness has structure, and noise sprinkled evenly says the opposite.
 *
 * Three of the absences resolve to an inferred value, in C4's violet and never
 * in the tone a declared value carries. A recovered attribute that looked
 * identical to a reported one would be the pipeline claiming more than it has.
 *
 * The bars under the field are how often each column is reported, which is the
 * measurement the conclusion turns on.
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

      // The recovered values arrive last and arrive differently, which is the
      // only place in the drawing where the order of events is an argument.
      //
      // Short, and the scale barely travels. `back.out` reaches full strength in
      // the first sixth of its duration, so over `DURATION.slow` from 0.6 the
      // cell was solid at roughly seven tenths of its size and then crept to
      // full for another three quarters of a second: it read as a mark that had
      // landed in the wrong place and was correcting itself. Landing takes
      // `DURATION.quick` from 0.88, where the overshoot still gives the arrival
      // its snap and there is no travel left to watch.
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

      // Grown from the baseline by writing the geometry rather than scaling:
      // a scaled rect takes its corner radius with it, so a bar animated by
      // transform arrives at a different shape than it settles on.
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

/* ---- 04 · The same set, ranked twice ------------------------------------------------ */

/**
 * One candidate set, two contexts, two orders.
 *
 * A slope between two rankings is the only figure that carries the relational
 * claim without a word attached to it: the same five tokens, the same five
 * colours, a different order on the right, and the crossings are the argument.
 * Three of the five change rank and the leader changes, because a slope chart
 * where the order barely moves says preference is roughly stable, which is the
 * opposite of the conclusion.
 *
 * The two contexts are marked by a swatch over each column and nothing else. A
 * legend on a drawing this small is a paragraph explaining a picture that was
 * supposed to save one.
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
   * The panel's opening scalar, held as a plain object and written to the
   * element by hand.
   *
   * **Not tweened as a CSS variable.** `gsap.to(element, { '--open': 1 })`
   * builds a tween that reports a duration and a parent and then never writes
   * anything to the property, so the panel sits at its shut height for the whole
   * beat while the timeline around it runs normally. Nothing errors. Tweening a
   * number and setting the property in `onUpdate` is the same gesture with no
   * dependency on how a custom property is parsed.
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

  // The note is not in `words`, and that is load-bearing.
  //
  // `words` is what the beat's own tweens write, and a tween writes an inline
  // opacity that outranks the sheet. The note is lit by `--open` in CSS so that
  // it stays dark while its panel is shut; handed to the same stagger as the
  // claim it arrives at full strength on a shut panel and is then clipped by the
  // panel's own height, which looks exactly like a layout bug.
  return { element, words: [index, lead], rule, drawing, scalar };
};

/**
 * A panel opens on one scalar, and everything about it is a function of it.
 *
 * The height, the ground, the inset hairline, the shadow, the texture and the
 * light on the note and the drawing are all derived from `--open` in the sheet.
 * Six properties on six clocks cannot be made to read as one surface opening,
 * which is the lesson the conditions card already paid for.
 *
 * **The ease is not `expo.out`.** `expo` spends about nine tenths of its
 * distance in the first quarter of its duration, which on a small element reads
 * as crisp and on a card the width of half the frame reads as a snap followed by
 * a crawl. `power2.out` answers the click at once and still settles.
 */
const OPENING = { seconds: 1.55, ease: 'power2.out' } as const;

/** Writes the scalar to the element, which is the only place it is set. */
const writeOpen = (panel: Panel): void => {
  panel.element.style.setProperty('--open', panel.scalar.value.toFixed(4));
};

const setScalar = (panel: Panel, value: number): void => {
  panel.scalar.value = value;
  writeOpen(panel);
};

/**
 * The closing frame: four findings, each opened on its own beat.
 *
 * **The composition is whole before the first beat.** All four panels stand on
 * the surface from the moment the scene is entered, each holding the full room
 * it will need, each showing its claim. A frame that grew a panel per click
 * would be a slide being assembled in front of the committee; a frame whose
 * architecture is visible from the start and fills in is the argument arriving
 * inside a shape that was already stated. Nothing outside a panel ever moves.
 *
 * **Every drawing is the finding, not a picture of its subject.** Four
 * overlapping intervals whose markers are still ordered *is* relative
 * comparison; a rule that four tokens do not cross *is* admissibility resolved
 * before preference; a field of declared and undeclared values with three
 * recovered *is* the evidence condition; a slope between two orders *is*
 * relational preference. None of them needs a legend, and none of them is the
 * pipeline drawn again.
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

  /** The state a panel rests in once it has been opened, written without motion. */
  const setOpen = (panel: Panel): void => {
    setScalar(panel, 1);
    gsap.set([...panel.words], { opacity: 1, y: 0 });
    gsap.set(panel.rule, { opacity: 1, scaleX: 1 });
    // `motion: 0` collapses every tween in the build to zero duration at time
    // zero, so the timeline it is handed describes the settled drawing.
    //
    // **And it is forced to render here rather than left to the next tick.** A
    // detached timeline renders on the following frame, and the next beat opens
    // with `killTweensOf`, so two clicks in quick succession killed these before
    // they had written anything: the panel two beats back stayed shut with its
    // drawing retracted. `progress(1).kill()` writes the end state now and then
    // only releases the tween, which is the same treatment every scene gives its
    // outgoing timeline.
    const written = gsap.timeline();
    panel.drawing.build(written, 0, 0);
    written.progress(1).kill();
  };

  /**
   * The state a panel rests in before its beat.
   *
   * Not empty. The number, the rule and the claim stay at full strength, so a
   * panel that has not been reached is a finding waiting rather than a hole in
   * the grid, and the audience can read the shape of the argument from the
   * first frame.
   */
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

        // Behind the opening edge, so the drawing is built in room that already
        // exists rather than growing alongside it.
        panel.drawing.build(timeline, seconds(0.55), 1);
      });

      return timeline;
    },
  };
}
