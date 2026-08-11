import gsap from 'gsap';
import { EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import { splitLines } from './splitLines';
import './gap-cards.css';

export interface GapCard {
  /** Shown large in the card, and the number the objectives scene regroups. */
  readonly key: string;
  readonly title: string;
  readonly body: string;
}

export interface GapCardsSpec {
  readonly items: readonly GapCard[];
}

export interface GapCards {
  readonly element: HTMLElement;
  /** The card frames, for the scene's own entrance stagger. */
  readonly frames: readonly HTMLElement[];
  /**
   * Splits the titles into their rendered lines. Must be called once the cards
   * are in the document, and again if the webfont resolves after that.
   */
  measure(): void;
  /** `-1` for the empty frames, then the index of the card being spoken about. */
  show(active: number, settle?: boolean): gsap.core.Timeline;
}

/*
 * Six gaps, as a three-by-two field of cards filled one at a time.
 *
 * **The frames stand empty from the first frame.** Only the numbers are in them
 * until a card is reached, which establishes the count before the first gap is
 * spoken — six cards arriving out of nothing leaves the audience counting
 * instead of listening, and six is load-bearing: the next scene regroups it
 * into four.
 *
 * **Three across rather than six down.** A six-row stack at this measure sets
 * each gap as a line of a list, and a list is read ahead of the speaker. A card
 * is a block with edges, so the eye rests inside the one being spoken about.
 *
 * **Three states, and the accent belongs to the middle one.** A card is pending,
 * then active, then settled, and the amber travels with the active card rather
 * than being a property of any gap. That is what keeps six equal claims looking
 * like six equal claims, and it also gives the room an unmistakable answer to
 * *which one is he on*.
 *
 * Colours are resolved from tokens here rather than left as `var()` in the tween:
 * GSAP interpolates colour values, not custom-property references, and a tween
 * to `var(--x)` lands on the final frame instead of animating.
 */

/**
 * The choreography, in seconds from the start of a beat.
 *
 * **A beat is a hand-off, not a cross-fade, and the offsets are what say so.**
 * The card losing the accent starts letting go at zero and is done in a third of
 * a second; the card taking it does not begin until that release is most of the
 * way through. Everything running from t=0 at one duration — which is what this
 * was — is why it read as soft: six parts arriving together is one event, and a
 * beat should be a short sequence the eye can follow.
 *
 * Reading order down the card: frame, then the mark that says *this one*, then
 * the number, then the statement line by line, then the description.
 */
const CUE = {
  release: 0,
  frame: 0.1,
  glow: 0.13,
  rule: 0.17,
  key: 0.21,
  title: 0.27,
  body: 0.46,
} as const;

const SPAN = {
  release: 0.34,
  frame: 0.58,
  glow: 0.66,
  rule: 0.7,
  key: 0.45,
  title: 0.82,
  body: 0.62,
} as const;

/**
 * One ease for everything was the other half of the softness. Roles move
 * differently: a frame settles, a rule is drawn, type arrives.
 */
const MOVE = {
  /** Unfussy, and over before the eye follows it. */
  release: 'power2.out',
  /** Decelerating into place, without `expo`'s long tail on a moving box. */
  arrive: 'power3.out',
  /** A rule being drawn, not thrown. */
  rule: 'power4.out',
  /** Type. `expo.out` is the deck's own enter, and it is right for a wipe. */
  type: EASE.enter,
} as const;

/** Line-to-line delay inside one statement. */
const LINE_STEP = 0.07;

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

export function createGapCards(spec: GapCardsSpec): GapCards {
  const colours = {
    edge: token('--c-border'),
    edgeLit: token('--c-border-strong'),
    accent: token('--c-emphasis'),
    keyPending: token('--c-text-faint'),
    keySettled: token('--c-text'),
  };

  const cards = spec.items.map((item) => {
    const rule = el('span', { className: 'gap-card-rule' });
    const glow = el('span', { className: 'gap-card-glow' });
    const key = el('span', { className: 'gap-card-key', text: item.key });
    const title = el('h3', { className: 'gap-card-title', text: item.title });
    const body = el('p', { className: 'gap-card-body', text: item.body });

    const element = el('article', {
      className: 'gap-card',
      children: [glow, rule, key, title, body],
    });

    // Replaced by the measured lines; until then the whole statement is one.
    return {
      element,
      rule,
      glow,
      key,
      title,
      body,
      source: item.title,
      lines: [title] as HTMLElement[],
    };
  });

  const element = el('div', {
    className: 'gap-cards',
    children: cards.map((card) => card.element),
  });

  const phaseOf = (index: number, active: number): Phase =>
    index === active ? 'active' : index < active ? 'settled' : 'pending';

  const plan = (active: number): Step[] =>
    cards.flatMap((card, index) => {
      const phase = phaseOf(index, active);
      const shown = phase !== 'pending';
      const lit = phase === 'active';

      // Anything not being handed the accent moves at once and quickly. Running
      // a release through the arrival choreography would take a second to undo
      // what the next card is spending a second doing.
      const quick = !lit;
      const at = (cue: number): number => (quick ? 0 : cue);
      const span = (length: number): number => (quick ? SPAN.release : length);
      const ease = quick ? MOVE.release : MOVE.arrive;

      return [
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
          node: card.body,
          vars: { opacity: shown ? 1 : 0, y: shown ? 0 : 10 },
          at: at(CUE.body),
          duration: span(SPAN.body),
          ease: quick ? MOVE.release : MOVE.arrive,
        },
      ];
    });

  let current = -1;

  const api: GapCards = {
    element,
    frames: cards.map((card) => card.element),

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
