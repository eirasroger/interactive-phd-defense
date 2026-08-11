import gsap from 'gsap';
import { EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
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
   * `-1` for the empty frames, then the index of the card being spoken about.
   * Past the last index every card is settled and no accent is held, which is
   * the state the scene rests in.
   */
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
 * *which one is he on* — the reason this reads as directed rather than as a grid
 * that fades in.
 *
 * Colours are resolved from tokens here rather than left as `var()` in the tween:
 * GSAP interpolates colour values, not custom-property references, and a tween
 * to `var(--x)` lands on the final frame instead of animating.
 */

/**
 * Durations are the figure's own rather than the deck's shared ramp.
 *
 * A presenter clicks faster than a design system's `slow`, and every part of
 * this moving at one duration is what made the first pass feel soft: the card
 * being handed the accent has to arrive after the previous one has let it go,
 * which is a relationship between two durations and cannot be expressed with
 * one. The hand-off is the quickest thing on screen; the wipe is the slowest.
 */
const TIMING = {
  handoff: 0.34,
  frame: 0.5,
  key: 0.42,
  rule: 0.62,
  wipe: 0.78,
  body: 0.62,
} as const;

/** Tokens are the source of truth for colour, and GSAP needs resolved values. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

type Phase = 'pending' | 'active' | 'settled';

interface Step {
  readonly node: Element | readonly Element[];
  readonly vars: gsap.TweenVars;
  readonly at: number;
  readonly duration: number;
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
    // Wrapped so the title can be wiped up behind its own edge. A masked reveal
    // reads as typesetting; the same text fading in reads as a web page.
    const line = el('span', { className: 'gap-card-title-line', text: item.title });
    const title = el('h3', { className: 'gap-card-title', children: [line] });
    const body = el('p', { className: 'gap-card-body', text: item.body });

    const element = el('article', {
      className: 'gap-card',
      children: [glow, rule, key, title, body],
    });

    return { element, rule, glow, key, line, body };
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

      // Letting go is quicker than being handed it, so the accent is never on
      // two cards at once for long enough to be seen on two cards.
      const pace = phase === 'settled' ? TIMING.handoff : undefined;

      return [
        {
          node: card.element,
          vars: {
            borderColor: shown ? colours.edgeLit : colours.edge,
            scale: lit ? 1.018 : 1,
            opacity: phase === 'settled' ? 0.88 : 1,
          },
          at: 0,
          duration: pace ?? TIMING.frame,
        },
        {
          node: card.glow,
          vars: { opacity: lit ? 1 : 0 },
          at: 0,
          duration: pace ?? TIMING.frame,
        },
        {
          node: card.rule,
          vars: {
            scaleX: shown ? 1 : 0,
            backgroundColor: lit ? colours.accent : colours.edgeLit,
          },
          at: 0.04,
          duration: pace ?? TIMING.rule,
        },
        {
          node: card.key,
          vars: {
            color: lit ? colours.accent : shown ? colours.keySettled : colours.keyPending,
          },
          at: 0,
          duration: pace ?? TIMING.key,
        },
        {
          node: card.line,
          vars: { yPercent: shown ? 0 : 100 },
          at: 0.1,
          duration: TIMING.wipe,
        },
        {
          node: card.body,
          vars: { opacity: shown ? 1 : 0, y: shown ? 0 : 10 },
          at: 0.2,
          duration: TIMING.body,
        },
      ];
    });

  return {
    element,
    frames: cards.map((card) => card.element),

    show(active, settle = false) {
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
            ease: EASE.enter,
            overwrite: 'auto',
          },
          step.at,
        );
      }

      return timeline;
    },
  };
}
