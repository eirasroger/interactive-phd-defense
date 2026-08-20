import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  APPLICATIONS,
  APPROACH,
  CONTEXT_INPUTS,
  OPENING,
  OUTPUT,
  PRODUCTS,
  STAGE,
  UPSTREAM,
  type ProductId,
} from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import { createWipe, hidden, shown } from './wipeMask';
import './c5-palette.css';
import './converge.css';

export interface Converge {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/* ---- The board ------------------------------------------------------------- */

/**
 * One measured board, and every mark on the beat placed against it.
 *
 * The first build laid this out as five CSS grid columns, each of which had to
 * guess where the others resolved. The outflow left the middle of the card, the
 * strands stopped short of the edge they were flowing into, and the card's
 * centre missed the centre of the column feeding it. Geometry that has to agree
 * across four independent boxes will not agree.
 *
 * So the SVG owns the geometry and the HTML anchors to it: `atBoard` places a
 * label at a board coordinate as a percentage, and the frame carries the board's
 * aspect ratio, so text and drawing scale together and land on the same points
 * at any stage size.
 */
const BOARD = { width: 1420, height: 424 } as const;

/** Column boundaries. The readout is the widest, because it is the product. */
const LEDGER_END = 252;
const CARD_LEFT = 556;
const CARD_RIGHT = 900;
const READOUT_LEFT = 1010;

/** The four contributions, and the axis their centre defines. */
const ROW_STEP = 70;
const ROW_FIRST = 92;
const AXIS = ROW_FIRST + (ROW_STEP * (UPSTREAM.length - 1)) / 2;

const sourceY = (index: number): number => ROW_FIRST + index * ROW_STEP;

/** Where each contribution enters the card. */
const PORT_STEP = 24;
const portY = (index: number): number =>
  AXIS + (index - (UPSTREAM.length - 1) / 2) * PORT_STEP;

const CARD_HEIGHT = 178;
const CARD_TOP = AXIS - CARD_HEIGHT / 2;
const CARD_BOTTOM = CARD_TOP + CARD_HEIGHT;

/** The context ports, and the label blocks that hang under them. */
const CONTEXT_SPAN = 172;
const CONTEXT_WIDTH = 168;
const contextX = (index: number): number =>
  (CARD_LEFT + CARD_RIGHT) / 2 + (index - (CONTEXT_INPUTS.length - 1) / 2) * CONTEXT_SPAN;
const RISER_BOTTOM = CARD_BOTTOM + 34;
const CONTEXT_TOP = RISER_BOTTOM + 4;
const CONTEXT_INDEX_Y = 388;

/** The readout, five rows of equal height sharing the card's axis. */
const OUT_STEP = 46;
const outY = (index: number): number =>
  AXIS + (index - (PRODUCTS.length - 1) / 2) * OUT_STEP;
const READOUT_TOP = outY(0) - OUT_STEP / 2;
const READOUT_HEIGHT = OUT_STEP * PRODUCTS.length;

const HEAD_TOP = 4;

/** A board coordinate as a percentage, so HTML text lands on SVG geometry. */
const atBoard = (x: number, y: number): string =>
  `left: ${((x / BOARD.width) * 100).toFixed(3)}%; top: ${((y / BOARD.height) * 100).toFixed(3)}%`;

const spanBoard = (width: number): string =>
  `width: ${((width / BOARD.width) * 100).toFixed(3)}%`;

const boxBoard = (x: number, y: number, width: number, height: number): string =>
  `${atBoard(x, y)}; ${spanBoard(width)}; height: ${((height / BOARD.height) * 100).toFixed(3)}%`;

/* ---- The evidence, drawn as a flow ------------------------------------------ */

/** Half the thickness of a contribution where it leaves, and where it arrives. */
const RIBBON_ORIGIN = 15;
const RIBBON_ENTRY = 8;

/**
 * Product evidence, drawn as a band rather than a count of lines.
 *
 * A profile carries many indicators and how many depends on the product
 * category, so the drawing has to say *many* without saying a number. A band
 * has width, which is the honest reading: the model takes a wide profile in,
 * and the width itself is not a claim this station makes.
 */
const ribbonPath = (index: number): string => {
  const start = sourceY(index);
  const end = portY(index);
  const bend = (CARD_LEFT - LEDGER_END) * 0.5;
  const x1 = LEDGER_END;
  const x2 = CARD_LEFT;

  return (
    `M ${x1} ${start - RIBBON_ORIGIN} ` +
    `C ${x1 + bend} ${start - RIBBON_ORIGIN}, ${x2 - bend} ${end - RIBBON_ENTRY}, ` +
    `${x2} ${end - RIBBON_ENTRY} ` +
    `L ${x2} ${end + RIBBON_ENTRY} ` +
    `C ${x2 - bend} ${end + RIBBON_ENTRY}, ${x1 + bend} ${start + RIBBON_ORIGIN}, ` +
    `${x1} ${start + RIBBON_ORIGIN} Z`
  );
};

/** The band's own centre line, so the flow has a direction inside its width. */
const filamentPath = (index: number): string => {
  const start = sourceY(index);
  const end = portY(index);
  const bend = (CARD_LEFT - LEDGER_END) * 0.5;
  return (
    `M ${LEDGER_END} ${start} ` +
    `C ${LEDGER_END + bend} ${start}, ${CARD_LEFT - bend} ${end}, ${CARD_LEFT} ${end}`
  );
};

/**
 * The single output, resolving into an ordered set of scores.
 *
 * Every leader leaves the same port on the card's right edge, which is the
 * reading the beat needs: one pass of the model returns the whole ordering at
 * once, and no candidate is scored on its own.
 */
const OUT_PORT_SPREAD = 3.2;

const leaderPath = (index: number): string => {
  const start = AXIS + (index - (PRODUCTS.length - 1) / 2) * OUT_PORT_SPREAD;
  const end = outY(index);
  const bend = (READOUT_LEFT - CARD_RIGHT) * 0.55;
  return (
    `M ${CARD_RIGHT} ${start} ` +
    `C ${CARD_RIGHT + bend} ${start}, ${READOUT_LEFT - bend} ${end}, ${READOUT_LEFT} ${end}`
  );
};

/* ---- What the model returns -------------------------------------------------- */

/**
 * The ordering the station produces, taken from the published case.
 *
 * Bar lengths are the standard structural column of Fig. 8, so the shape is a
 * measurement even though no score is printed on the opening beat. The values
 * themselves belong to the beats that report them; what is printed here is the
 * rank, which the ordering already states.
 */
const ranked = (): readonly { readonly id: ProductId; readonly score: number }[] => {
  const standard = APPLICATIONS.find((entry) => entry.key === 'standard');
  if (!standard) throw new Error('C5: the opening beat needs the standard structural scores.');
  return PRODUCTS.map((id) => ({ id, score: standard.scores[id] })).sort(
    (left, right) => right.score - left.score,
  );
};

/* ---- The panel ----------------------------------------------------------------- */

/**
 * The station's establishing shot.
 *
 * The paper's overview figure drawn at scale. Four contributions deliver
 * evidence from the corridor, the decision's own context plugs in from
 * underneath, and one pass of the model returns an ordering to the right.
 * Everything the beat has to say is in that shape, so the writing stays at
 * label size and the composition carries the argument.
 */
export function createConverge(): Converge {
  /* -- The drawing -- */

  const board = svg('svg', {
    class: 'cv-board',
    viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
  });

  const defs = svg('defs');

  const flowGradient = svg('linearGradient', {
    id: 'cv-flow',
    gradientUnits: 'userSpaceOnUse',
    x1: String(LEDGER_END),
    x2: String(CARD_LEFT),
  });
  // `stop-color` comes from the sheet, not from `currentColor`. A stop resolves
  // `currentColor` against its own inherited `color`, and a `<stop>` inherits
  // down the `<defs>` subtree, where the panel's `color` is the ink the text is
  // set in. The gradient came out the grey of body copy with nothing to show it
  // had missed the accent.
  for (const [offset, opacity] of [
    ['0', '0'],
    ['0.18', '0.12'],
    ['1', '0.42'],
  ] as const) {
    flowGradient.appendChild(
      svg('stop', { class: 'cv-flow-stop', offset, 'stop-opacity': opacity }),
    );
  }
  defs.appendChild(flowGradient);

  // The travelling highlight's profile. Soft at both ends, so the sweep reads
  // as light moving through the band and never as an edge crossing it.
  const sweepGradient = svg('linearGradient', { id: 'cv-sweep-profile' });
  for (const [offset, opacity] of [
    ['0', '0'],
    ['0.5', '1'],
    ['1', '0'],
  ] as const) {
    sweepGradient.appendChild(svg('stop', { offset, 'stop-color': '#ffffff', 'stop-opacity': opacity }));
  }
  defs.appendChild(sweepGradient);

  const sweepMask = svg('mask', {
    id: 'cv-sweep',
    maskUnits: 'userSpaceOnUse',
    x: '0',
    y: '0',
    width: String(BOARD.width),
    height: String(BOARD.height),
  });
  sweepMask.appendChild(
    svg('rect', {
      class: 'cv-sweep-band',
      x: String(LEDGER_END - 240),
      y: '0',
      width: '240',
      height: String(BOARD.height),
      fill: 'url(#cv-sweep-profile)',
    }),
  );
  defs.appendChild(sweepMask);
  board.appendChild(defs);

  const flowWipe = createWipe(board, BOARD.width, BOARD.height, 'x');
  const flow = svg('g', { class: 'cv-flow-group', 'clip-path': flowWipe.clip });

  const ribbons = svg('g', { class: 'cv-ribbons' });
  const filaments = svg('g', { class: 'cv-filaments' });
  for (const [index] of UPSTREAM.entries()) {
    ribbons.appendChild(svg('path', { class: 'cv-ribbon', d: ribbonPath(index) }));
    filaments.appendChild(
      svg('path', {
        class: 'cv-filament',
        'vector-effect': 'non-scaling-stroke',
        d: filamentPath(index),
      }),
    );
  }
  flow.appendChild(ribbons);
  flow.appendChild(filaments);

  const sweep = svg('g', { class: 'cv-sweep', mask: 'url(#cv-sweep)' });
  for (const [index] of UPSTREAM.entries()) {
    sweep.appendChild(svg('path', { class: 'cv-ribbon cv-ribbon-lit', d: ribbonPath(index) }));
  }
  flow.appendChild(sweep);
  board.appendChild(flow);

  /* Ports. Drawn after the flow so an entry reads as a fitting on the card. */
  const entryPorts = UPSTREAM.map((_, index) =>
    svg('rect', {
      class: 'cv-port',
      x: String(CARD_LEFT - 2),
      y: String(portY(index) - RIBBON_ENTRY),
      width: '4',
      height: String(RIBBON_ENTRY * 2),
      rx: '2',
    }),
  );

  const contextPorts = CONTEXT_INPUTS.map((entry, index) =>
    svg('rect', {
      class: 'cv-port cv-port-context',
      'data-input': entry.channel,
      x: String(contextX(index) - 9),
      y: String(CARD_BOTTOM - 2),
      width: '18',
      height: '4',
      rx: '2',
    }),
  );

  const outPort = svg('rect', {
    class: 'cv-port cv-port-out',
    x: String(CARD_RIGHT - 2),
    y: String(AXIS - OUT_PORT_SPREAD * 2 - 3),
    width: '4',
    height: String(OUT_PORT_SPREAD * 4 + 6),
    rx: '2',
  });

  const risers = CONTEXT_INPUTS.map((entry, index) =>
    svg('line', {
      class: 'cv-riser',
      'data-input': entry.channel,
      'vector-effect': 'non-scaling-stroke',
      x1: String(contextX(index)),
      y1: String(RISER_BOTTOM),
      x2: String(contextX(index)),
      y2: String(CARD_BOTTOM),
    }),
  );

  const riserGroup = svg('g', { class: 'cv-risers' });
  for (const riser of risers) riserGroup.appendChild(riser);
  board.appendChild(riserGroup);

  const portGroup = svg('g', { class: 'cv-ports' });
  for (const port of [...entryPorts, ...contextPorts, outPort]) portGroup.appendChild(port);
  board.appendChild(portGroup);

  const outWipe = createWipe(board, BOARD.width, BOARD.height, 'x');
  const outGroup = svg('g', { class: 'cv-leaders', 'clip-path': outWipe.clip });
  const leaders = ranked().map((_entry, index) =>
    svg('path', {
      class: 'cv-leader',
      'data-standing': index === 0 ? 'lead' : 'trailing',
      'vector-effect': 'non-scaling-stroke',
      d: leaderPath(index),
    }),
  );
  for (const leader of leaders) outGroup.appendChild(leader);
  board.appendChild(outGroup);

  /*
   * Drawn as a rectangle that grows, because GSAP's `transformOrigin` cannot be
   * trusted on SVG geometry. Chrome resolves `transform-box` to the view box, so
   * `'center center'` is the centre of the *board* rather than of the element,
   * and a `scaleY: 1` that should be identity emits `matrix(1,0,0,1,0,-105)`.
   * An attribute reveal is written in the same units the mark is, so it cannot
   * disagree with it. Same reason the risers below animate `y2`.
   */
  const spine = svg('rect', {
    class: 'cv-spine',
    x: String(READOUT_LEFT - 0.75),
    y: String(READOUT_TOP),
    width: '1.5',
    height: String(READOUT_HEIGHT),
    rx: '0.75',
  });
  board.appendChild(spine);

  /* -- What the corridor delivers -- */

  const sources = UPSTREAM.map((entry) =>
    el('div', {
      className: 'cv-source',
      attrs: { 'data-key': entry.key },
      children: [
        el('div', {
          className: 'cv-source-head',
          children: [
            el('span', { className: 'cv-source-code', text: entry.station }),
            el('p', { className: 'cv-source-label', text: entry.label }),
          ],
        }),
        el('p', { className: 'cv-source-note', text: entry.note }),
      ],
    }),
  );

  const ledger = el('div', {
    className: 'cv-ledger',
    attrs: {
      style: boxBoard(0, sourceY(0) - ROW_STEP / 2, LEDGER_END, ROW_STEP * UPSTREAM.length),
    },
    children: sources,
  });

  /* -- The model -- */

  const stageName = el('p', { className: 'cv-stage-name', text: STAGE.name });
  const stageLine = el('p', { className: 'cv-stage-line', text: STAGE.line });
  const card = el('div', {
    className: 'c5-field cv-card',
    attrs: { style: boxBoard(CARD_LEFT, CARD_TOP, CARD_RIGHT - CARD_LEFT, CARD_HEIGHT) },
    children: [
      el('p', { className: 'cv-stage-index', text: STAGE.index }),
      stageName,
      stageLine,
    ],
  });

  /* -- The context, plugging in from underneath -- */

  const contexts = CONTEXT_INPUTS.map((entry, index) =>
    el('div', {
      className: 'cv-context',
      attrs: {
        'data-input': entry.channel,
        style: `${atBoard(contextX(index) - CONTEXT_WIDTH / 2, CONTEXT_TOP)}; ${spanBoard(CONTEXT_WIDTH)}`,
      },
      children: [
        el('p', { className: 'cv-context-label', text: entry.label }),
        el('p', { className: 'cv-context-note', text: entry.note }),
      ],
    }),
  );

  /* -- The readout -- */

  const bars: HTMLElement[] = [];
  const tokens: HTMLElement[] = [];
  const rows = ranked().map((entry, index) => {
    const standing = index === 0 ? 'lead' : 'trailing';
    const fill = el('span', {
      className: 'cv-bar-fill',
      attrs: { style: `--extent: ${(entry.score * 100).toFixed(2)}%` },
    });
    const token = el('span', {
      className: 'c5-token cv-token',
      text: entry.id,
      attrs: { 'data-standing': standing },
    });
    bars.push(fill);
    tokens.push(token);

    return el('div', {
      className: 'cv-row',
      attrs: { 'data-id': entry.id, 'data-standing': standing },
      children: [
        el('span', {
          className: 'c5-figure cv-rank',
          text: String(index + 1).padStart(2, '0'),
        }),
        token,
        el('span', { className: 'cv-bar', children: [fill] }),
      ],
    });
  });

  const readout = el('div', {
    className: 'cv-readout',
    attrs: {
      style: boxBoard(READOUT_LEFT, READOUT_TOP, BOARD.width - READOUT_LEFT, READOUT_HEIGHT),
    },
    children: rows,
  });

  /* -- Locators -- */

  const upstreamIndex = el('p', {
    className: 'c5-index cv-locator',
    text: OPENING.upstream,
    attrs: { style: `${atBoard(0, HEAD_TOP)}; ${spanBoard(LEDGER_END)}` },
  });

  const outIndex = el('p', {
    className: 'c5-index cv-locator cv-locator-out',
    text: OUTPUT.label,
    attrs: { style: `${atBoard(READOUT_LEFT, HEAD_TOP)}; ${spanBoard(BOARD.width - READOUT_LEFT)}` },
  });

  const contextIndex = el('p', {
    className: 'c5-index cv-locator cv-locator-context',
    text: OPENING.context,
    attrs: {
      style: `${atBoard(CARD_LEFT, CONTEXT_INDEX_Y)}; ${spanBoard(CARD_RIGHT - CARD_LEFT)}`,
    },
  });

  const outNote = el('p', {
    className: 'cv-out-note',
    text: OUTPUT.note,
    attrs: {
      style: `${atBoard(READOUT_LEFT, READOUT_TOP + READOUT_HEIGHT + 16)}; ${spanBoard(BOARD.width - READOUT_LEFT)}`,
    },
  });

  const frame = el('div', {
    className: 'cv-frame',
    children: [board, ledger, card, ...contexts, readout, upstreamIndex, outIndex, contextIndex, outNote],
  });

  /* -- What follows -- */

  const claim = el('p', { className: 'cv-claim', text: APPROACH.claim });
  const moves = APPROACH.moves.map((text, index) =>
    el('div', {
      className: 'cv-move',
      children: [
        el('span', { className: 'c5-figure cv-move-index', text: String(index + 1).padStart(2, '0') }),
        el('p', { className: 'cv-move-label', text }),
      ],
    }),
  );

  const element = el('div', {
    className: 'c5 cv',
    children: [
      frame,
      el('div', {
        className: 'cv-forward',
        children: [claim, el('div', { className: 'cv-moves', children: moves })],
      }),
    ],
  });

  const locators = [upstreamIndex, outIndex, contextIndex];
  const ports = [...entryPorts, ...contextPorts, outPort];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([...locators, ...sources, ...contexts, ...rows, outNote, claim, ...moves], {
      opacity: 1,
      x: 0,
      y: 0,
    });
    gsap.set([card, stageName, stageLine], { opacity: 1, y: 0, scale: 1 });
    gsap.set(flowWipe.rect, shown(flowWipe));
    gsap.set(outWipe.rect, shown(outWipe));
    gsap.set(ports, { opacity: 1 });
    for (const riser of risers) riser.setAttribute('y2', String(CARD_BOTTOM));
    spine.setAttribute('height', String(READOUT_HEIGHT));
    gsap.set(bars, { opacity: 1, scaleX: 1, transformOrigin: 'left center' });
    gsap.set(tokens, { opacity: 1, scale: 1 });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      if (settle) {
        settleTo();
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      return (
        line
          .from(
            locators,
            {
              opacity: 0,
              y: 8,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.6),
            },
            0,
          )
          // The corridor speaks first, then the evidence travels, then the model
          // it travels into. That is the order of the argument.
          .from(
            sources,
            {
              opacity: 0,
              x: -22,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.8),
            },
            seconds(DURATION.quick * 0.6),
          )
          .fromTo(
            flowWipe.rect,
            hidden(flowWipe),
            {
              ...shown(flowWipe),
              duration: seconds(DURATION.cinematic * 0.95),
              ease: EASE.standard,
            },
            seconds(DURATION.slow * 0.7),
          )
          .from(
            card,
            {
              opacity: 0,
              scale: 0.94,
              transformOrigin: 'center center',
              duration: seconds(DURATION.cinematic),
              ease: EASE.enter,
            },
            seconds(DURATION.slow * 0.95),
          )
          // The stage is named as the card settles, which is the moment the
          // beat exists for.
          .from(
            [stageName, stageLine],
            {
              opacity: 0,
              y: 12,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 2.2),
            },
            seconds(DURATION.cinematic * 0.9),
          )
          // The fittings light as the flow reaches them, so the band arrives
          // somewhere rather than stopping at a boundary.
          .from(
            entryPorts,
            {
              opacity: 0,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER),
            },
            seconds(DURATION.cinematic * 1.05),
          )
          // Context arrives from underneath, which is the one direction nothing
          // else on the wall uses.
          .fromTo(
            risers,
            { attr: { y2: RISER_BOTTOM } },
            {
              attr: { y2: CARD_BOTTOM },
              duration: seconds(DURATION.normal),
              ease: EASE.standard,
              stagger: seconds(STAGGER * 1.6),
            },
            seconds(DURATION.cinematic * 1.15),
          )
          .from(
            contextPorts,
            {
              opacity: 0,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.6),
            },
            seconds(DURATION.cinematic * 1.28),
          )
          .from(
            contexts,
            {
              opacity: 0,
              y: 14,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.6),
            },
            seconds(DURATION.cinematic * 1.2),
          )
          .from(
            outPort,
            { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
            seconds(DURATION.cinematic * 1.35),
          )
          .fromTo(
            spine,
            { attr: { height: 0 } },
            {
              attr: { height: READOUT_HEIGHT },
              duration: seconds(DURATION.slow),
              ease: EASE.standard,
            },
            seconds(DURATION.cinematic * 1.4),
          )
          .fromTo(
            outWipe.rect,
            hidden(outWipe),
            {
              ...shown(outWipe),
              duration: seconds(DURATION.slow),
              ease: EASE.standard,
            },
            seconds(DURATION.cinematic * 1.38),
          )
          .from(
            rows,
            {
              opacity: 0,
              x: 18,
              duration: seconds(DURATION.slow),
              ease: 'power3.out',
              stagger: seconds(STAGGER * 1.4),
            },
            seconds(DURATION.cinematic * 1.5),
          )
          .from(
            tokens,
            {
              scale: 0.7,
              transformOrigin: 'center center',
              duration: seconds(DURATION.slow),
              ease: 'back.out(2.2)',
              stagger: seconds(STAGGER * 1.4),
            },
            seconds(DURATION.cinematic * 1.55),
          )
          .fromTo(
            bars,
            { scaleX: 0 },
            {
              scaleX: 1,
              transformOrigin: 'left center',
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.4),
            },
            seconds(DURATION.cinematic * 1.58),
          )
          .from(
            outNote,
            { opacity: 0, y: 8, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.cinematic * 1.9),
          )
          .from(
            claim,
            { opacity: 0, y: 14, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.cinematic * 1.8),
          )
          .from(
            moves,
            {
              opacity: 0,
              y: 10,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.6),
            },
            seconds(DURATION.cinematic * 1.95),
          )
      );
    },
  };
}
