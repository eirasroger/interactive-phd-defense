import gsap from 'gsap';
import { EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import { iconMarkup, type ObjectiveIcon } from './objectiveIcons';
import { splitLines } from './splitLines';
import './objective-map.css';

export interface GapChip {
  readonly key: string;
  /** Two or three words. The full wording was on screen one scene ago. */
  readonly label: string;
}

export interface Objective {
  readonly key: string;
  /** The thesis's own objective statement, verbatim. */
  readonly title: string;
  /** The mark drawn in the card's foot. See `objectiveIcons.ts`. */
  readonly icon: ObjectiveIcon;
  /** Indices into `gaps` — the *Motivated by Gaps …* line, as data. */
  readonly absorbs: readonly number[];
}

export interface ObjectiveMapSpec {
  readonly gaps: readonly GapChip[];
  readonly items: readonly Objective[];
}

export interface ObjectiveMap {
  readonly element: HTMLElement;
  /** The gap chips and objective cards, for the scene's own entrance stagger. */
  readonly frames: readonly HTMLElement[];
  /**
   * Splits the statements into their rendered lines. Must be called once the
   * cards are in the document, and again if the webfont resolves after that.
   */
  measure(): void;
  /** `-1` for the six gaps alone, then the index of the objective being made. */
  show(active: number, settle?: boolean): gsap.core.Timeline;
}

/*
 * Six gaps along the top, four objectives under them.
 *
 * **The gaps never leave.** They are the row the whole scene is read against, so
 * the fold from six to four is something the audience watches happen rather than
 * a claim they are asked to accept. An earlier pass drew curved connectors from
 * each gap down to its objective; with two gaps feeding O1 and two feeding O4
 * that is four crossing bezier paths over a live 3D world, and it read as
 * decoration. Lighting the gaps an objective is motivated by says the same thing
 * with nothing added to the frame.
 *
 * The three states are `GapCards`', unchanged, because the two scenes are one
 * movement and a second visual language between them would say they are not.
 */

/**
 * The choreography, in seconds from the start of a beat.
 *
 * **A beat is a hand-off, and it runs cause before effect.** The gaps light
 * first, because they are what motivates the objective; the card forms after
 * them; the mark assembles last, once there is something for it to belong to.
 * Everything starting at t=0 — which is what this was — collapses that argument
 * into one flash.
 */
const CUE = {
  release: 0,
  chip: 0.08,
  frame: 0.22,
  glow: 0.25,
  rule: 0.29,
  key: 0.32,
  title: 0.38,
  mark: 0.6,
  stroke: 0.64,
} as const;

const SPAN = {
  release: 0.34,
  chip: 0.55,
  frame: 0.58,
  glow: 0.66,
  rule: 0.7,
  key: 0.45,
  title: 0.82,
  mark: 0.7,
  stroke: 0.7,
  dot: 0.5,
} as const;

/** One ease for everything was the other half of the softness. */
const MOVE = {
  release: 'power2.out',
  arrive: 'power3.out',
  rule: 'power4.out',
  type: EASE.enter,
  /** A line drawn by an instrument: it starts and stops, it does not fling. */
  draw: EASE.standard,
  /** The only overshoot in the deck, and it lasts 200ms on a 2px dot. */
  dot: 'back.out(2.2)',
} as const;

/** Delay between the lines of one statement, and between the strokes of a mark. */
const LINE_STEP = 0.07;
const STROKE_STEP = 0.055;
/** Delay between the two gap chips of a pair, so they arrive as two facts. */
const CHIP_STEP = 0.08;

/** Tokens are the source of truth for colour, and GSAP needs resolved values. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

type Phase = 'pending' | 'active' | 'settled';

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at: number;
  readonly duration: number;
  readonly ease: string;
  readonly stagger?: number;
}

export function createObjectiveMap(spec: ObjectiveMapSpec): ObjectiveMap {
  const ownerOf = spec.gaps.map((_, index) =>
    spec.items.findIndex((item) => item.absorbs.includes(index)),
  );
  const orphan = ownerOf.indexOf(-1);
  if (orphan >= 0) {
    throw new Error(
      `ObjectiveMap: '${spec.gaps[orphan]?.key}' is absorbed by no objective. ` +
        `Every gap folds into exactly one — that is what makes six become four.`,
    );
  }

  const colours = {
    edge: token('--c-border'),
    edgeLit: token('--c-border-strong'),
    accent: token('--c-emphasis'),
    keyPending: token('--c-text-faint'),
    keySettled: token('--c-text'),
    labelPending: token('--c-text-faint'),
    labelSettled: token('--c-text-muted'),
    /* The mark is drawn in `currentColor`, so the card tweens one property and
       every stroke, dash and dot in it follows. */
    markSettled: token('--c-text-muted'),
  };

  // ---- The six, along the top -------------------------------------------- //

  const chips = spec.gaps.map((gap) => {
    const key = el('span', { className: 'gap-chip-key', text: gap.key });
    const label = el('span', { className: 'gap-chip-label', text: gap.label });
    const element = el('div', { className: 'gap-chip', children: [key, label] });
    return { element, key, label };
  });

  const chipRow = el('div', {
    className: 'objective-gaps',
    children: chips.map((chip) => chip.element),
  });

  // ---- The four, under them ---------------------------------------------- //

  const cards = spec.items.map((item) => {
    const rule = el('span', { className: 'objective-rule' });
    const glow = el('span', { className: 'objective-glow' });
    const key = el('span', { className: 'objective-key', text: item.key });
    const title = el('h3', { className: 'objective-title', text: item.title });

    const mark = el('div', { className: 'objective-mark' });
    mark.innerHTML = iconMarkup(item.icon);

    const element = el('article', {
      className: 'objective-card',
      children: [glow, rule, key, title, mark],
    });

    // Drawn on rather than faded in. Each stroke carries its own length, so the
    // retracted state is per-element and cannot be one shared value.
    const strokes = Array.from(mark.querySelectorAll<SVGGeometryElement>('.icon-stroke')).map(
      (node) => {
        // `getTotalLength` is defined for every geometry element, but a browser
        // that disagrees should degrade to a mark that fades rather than to a
        // scene that throws on entry.
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
    const dashes = Array.from(mark.querySelectorAll<SVGGeometryElement>('.icon-dash'));
    const dots = Array.from(mark.querySelectorAll<SVGCircleElement>('.icon-dot'));

    // Replaced by the measured lines; until then the whole statement is one.
    return {
      element,
      rule,
      glow,
      key,
      title,
      source: item.title,
      lines: [title] as HTMLElement[],
      mark,
      strokes,
      dashes,
      dots,
    };
  });

  const grid = el('div', {
    className: 'objective-grid',
    children: cards.map((card) => card.element),
  });

  const element = el('div', { className: 'objective-map', children: [chipRow, grid] });

  const phaseOf = (index: number, active: number): Phase =>
    index === active ? 'active' : index < active ? 'settled' : 'pending';

  const plan = (active: number): Step[] => {
    const steps: Step[] = [];

    chips.forEach((chip, index) => {
      const owner = ownerOf[index] ?? -1;
      const phase = phaseOf(owner, active);
      const lit = phase === 'active';
      const taken = phase !== 'pending';

      const quick = !lit;
      // Where this chip sits among the ones its objective is claiming, so a
      // pair arrives as two facts rather than as one wider box lighting up.
      const order = spec.items[owner]?.absorbs.indexOf(index) ?? 0;
      const at = quick ? CUE.release : CUE.chip + order * CHIP_STEP;
      const span = quick ? SPAN.release : SPAN.chip;
      const ease = quick ? MOVE.release : MOVE.arrive;

      steps.push(
        {
          node: chip.element,
          vars: {
            borderColor: lit ? colours.accent : taken ? colours.edgeLit : colours.edge,
            // The unclaimed gaps recede rather than disappear: they are still
            // six, and the count is what the scene is about. Not below 0.6 —
            // the world behind them is lit park, and a chip at 0.44 stops being
            // dim and starts being unreadable.
            opacity: lit ? 1 : taken ? 0.82 : 0.6,
            scale: lit ? 1.03 : 1,
            y: lit ? -3 : 0,
          },
          at,
          duration: span,
          ease,
        },
        {
          node: chip.key,
          vars: { color: lit ? colours.accent : taken ? colours.keySettled : colours.keyPending },
          at,
          duration: quick ? SPAN.release : SPAN.key,
          ease: MOVE.release,
        },
        {
          node: chip.label,
          vars: { color: taken ? colours.keySettled : colours.labelPending },
          at,
          duration: quick ? SPAN.release : SPAN.key,
          ease: MOVE.release,
        },
      );
    });

    cards.forEach((card, index) => {
      const phase = phaseOf(index, active);
      const shown = phase !== 'pending';
      const lit = phase === 'active';

      // Anything not being handed the accent moves at once and quickly. Running
      // a release through the arrival choreography would take a second and a
      // half to undo what the next card is spending a second and a half doing.
      const quick = !lit;
      const at = (cue: number): number => (quick ? CUE.release : cue);
      const span = (length: number): number => (quick ? SPAN.release : length);
      const ease = quick ? MOVE.release : MOVE.arrive;

      steps.push(
        {
          node: card.element,
          vars: {
            borderColor: shown ? colours.edgeLit : colours.edge,
            scale: lit ? 1.018 : 1,
            // Rising rather than only growing. Four pixels is nothing to name
            // and everything to feel.
            y: lit ? -4 : 0,
            opacity: phase === 'settled' ? 0.88 : 1,
          },
          at: at(CUE.frame),
          duration: span(SPAN.frame),
          ease,
        },
        {
          node: card.glow,
          vars: { opacity: lit ? 1 : 0 },
          at: at(CUE.glow),
          duration: span(SPAN.glow),
          ease: quick ? MOVE.release : 'power2.out',
        },
        {
          node: card.rule,
          vars: { scaleX: shown ? 1 : 0, backgroundColor: lit ? colours.accent : colours.edgeLit },
          at: at(CUE.rule),
          duration: span(SPAN.rule),
          ease: quick ? MOVE.release : MOVE.rule,
        },
        {
          node: card.key,
          vars: { color: lit ? colours.accent : shown ? colours.keySettled : colours.keyPending },
          at: at(CUE.key),
          duration: span(SPAN.key),
          ease: MOVE.release,
        },
        {
          node: card.lines,
          // Past 100%: a line clearing its own mask by a margin arrives with
          // travel behind it rather than appearing to start at the edge.
          vars: { yPercent: shown ? 0 : 112 },
          at: at(CUE.title),
          duration: span(SPAN.title),
          ease: quick ? MOVE.release : MOVE.type,
          stagger: lit ? LINE_STEP : 0,
        },
        {
          node: card.mark,
          vars: {
            color: lit ? colours.accent : colours.markSettled,
            // The container carries the reveal, not the dash draw. Relying on
            // `strokeDashoffset` to hide a pending mark makes the whole thing
            // depend on `getTotalLength` returning a usable number for a rect
            // and a polygon — and when it returns 0, four icons sit fully drawn
            // on four cards that have not been reached yet.
            opacity: shown ? 1 : 0,
            // Assembling rather than appearing. Anchored bottom-left in CSS, so
            // it grows out of the corner it is pinned to and its baseline never
            // moves.
            scale: shown ? 1 : 0.92,
          },
          at: at(CUE.mark),
          duration: span(SPAN.mark),
          ease,
        },
      );

      // Stroke by stroke, in the order the mark should be read: scaffolding
      // first, then the form that stands on it.
      //
      // Only `strokeDashoffset` moves here. Tweening opacity as well would
      // override `icon-faint`, and the scaffolding would come up to full weight
      // and compete with what it holds.
      card.strokes.forEach((stroke, order) => {
        steps.push({
          node: stroke.node,
          vars: { strokeDashoffset: shown ? 0 : stroke.length },
          at: at(CUE.stroke + order * STROKE_STEP),
          duration: span(SPAN.stroke),
          ease: quick ? MOVE.release : MOVE.draw,
        });
      });

      const settled = at(CUE.stroke + card.strokes.length * STROKE_STEP);
      steps.push(
        {
          node: card.dashes,
          vars: { opacity: shown ? 0.8 : 0 },
          at: settled,
          duration: span(SPAN.dot),
          ease: MOVE.release,
        },
        {
          node: card.dots,
          vars: { scale: shown ? 1 : 0, opacity: shown ? 1 : 0 },
          at: settled,
          duration: span(SPAN.dot),
          // The one overshoot in the deck, and it lasts 200ms on a 2px dot.
          ease: quick ? MOVE.release : MOVE.dot,
          stagger: lit ? 0.03 : 0,
        },
      );
    });

    return steps;
  };

  let current = -1;

  const api: ObjectiveMap = {
    element,
    frames: [...chips.map((chip) => chip.element), ...cards.map((card) => card.element)],

    measure() {
      for (const card of cards) {
        const lines = splitLines(card.title, card.source);
        if (lines.length > 0) card.lines = lines;
      }
      // The freshly built lines carry none of the state the old block had.
      api.show(current, true);
    },

    show(active, settle = false) {
      current = active;
      const timeline = gsap.timeline();

      for (const step of plan(active)) {
        if (settle) {
          gsap.set(step.node as gsap.TweenTarget, step.vars);
          continue;
        }
        timeline.to(
          step.node as gsap.TweenTarget,
          {
            ...step.vars,
            duration: seconds(step.duration),
            ease: step.ease,
            stagger: seconds(step.stagger ?? 0),
            overwrite: 'auto',
          },
          step.at,
        );
      }

      return timeline;
    },
  };

  return api;
}
