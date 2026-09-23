import gsap from 'gsap';
import { EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import { splitLines } from './splitLines';
import './gap-cards.css';

export interface GapCard {
  /** Large number on the card. The objectives scene regroups by it. */
  readonly key: string;
  readonly title: string;
  readonly body: string;
}

export interface GapCardsSpec {
  readonly items: readonly GapCard[];
}

export interface GapCards {
  readonly element: HTMLElement;
  /** Card frames, for the scene's entrance stagger. */
  readonly frames: readonly HTMLElement[];
  /**
   * Splits titles into rendered lines. Call once the cards are in the document,
   * and again after the webfont loads.
   */
  measure(): void;
  /** Index of the active card, or `-1` for empty frames. */
  show(active: number, settle?: boolean): gsap.core.Timeline;
}

/*
 * Six gaps as a three-by-two grid of cards, filled one at a time. Empty frames
 * with numbers show from the start, so the count of six is clear. The next
 * scene regroups it into four.
 *
 * Each card is pending, active or settled. Only the active card gets the amber
 * accent.
 *
 * Colours are resolved from tokens because GSAP cannot animate to `var(--x)`.
 * It jumps to the final value.
 */

/**
 * Start times in seconds from the start of a beat. The previous card releases
 * the accent first, then the new card animates in order: frame, glow, rule,
 * number, title lines, body.
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

/** Eases per role. */
const MOVE = {
  release: 'power2.out',
  /** Avoids the long tail of `expo` on a moving box. */
  arrive: 'power3.out',
  rule: 'power4.out',
  type: EASE.enter,
} as const;

/** Delay between title lines, in seconds. */
const LINE_STEP = 0.07;

/** Reads a CSS custom property from `:root`. */
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

    // `lines` holds the whole title until `measure` splits it.
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

      // Cards losing or lacking the accent change at once, with the short release timing.
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
            // Active card lifts 4px.
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
          // Past 100% so hidden lines sit fully below their mask.
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
      // New line elements have no tween state, so reapply the current one.
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
