import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import type { Accent } from '@/components/accent';
import { el } from '@/utilities/dom';
import './brief.css';

export interface BriefSpec {
  readonly eyebrow: string;
  readonly heading: string;
  readonly accent?: Accent;
  /** `claims` reserves a fixed column beside the figure; `even` splits in half. */
  readonly split?: 'claims' | 'even';
  /** Attribution for the figure. */
  readonly source?: string;
  readonly note?: string;
}

export interface CardSpec {
  /** Shown above the drawing. Without a label the card has no head row. */
  readonly label?: string;
  readonly note?: string;
  readonly accent?: Accent;
}

export interface Card {
  readonly element: HTMLElement;
  /** Container for the drawing. Its grid row is fixed, so an SVG inside cannot resize it. */
  readonly body: HTMLElement;
  reveal(settle?: boolean): gsap.core.Timeline;
}

export interface Claims {
  readonly element: HTMLElement;
  /**
   * Marks the claims in `live` as live, earlier ones as made, and later ones as
   * pending. A beat can light several claims at once.
   *
   * Writes the full state each call, so forward, backward and jump navigation
   * all end in the same frame.
   */
  show(live: number | readonly number[], settle?: boolean): gsap.core.Timeline;
}

export interface ClaimsSpec extends CardSpec {
  /**
   * `stack`: a narrow column beside the figure. `row`: full width below it,
   * for figures that need the whole width.
   */
  readonly flow?: 'stack' | 'row';
}

export interface Brief {
  readonly element: HTMLElement;
  /** The evidence region. Cards are appended here in column order. */
  readonly stage: HTMLElement;
  /** Elements the entry timeline animates, so a killed entry can be settled. */
  readonly head: readonly HTMLElement[];
  revealHead(settle?: boolean): gsap.core.Timeline;
  addCard(spec?: CardSpec): Card;
  /** Adds a claims list on its own card in the evidence region. */
  addClaims(lines: readonly string[], spec?: ClaimsSpec): Claims;
}

/**
 * A numbered claims list with no card, so a scene can place it inside a card
 * it already owns (for example under a full-width figure).
 */
export function createClaims(lines: readonly string[], spec: ClaimsSpec = {}): Claims {
  const items = lines.map((line, index) => {
    const key = el('span', {
      className: 'brief-claim-index',
      text: String(index + 1).padStart(2, '0'),
    });
    const text = el('p', { className: 'brief-claim-text', text: line });
    return el('li', { className: 'brief-claim', children: [key, text] });
  });

  const element = el('ol', { className: 'brief-claims', children: items });
  element.dataset['flow'] = spec.flow ?? 'stack';

  /*
   * All claims stay visible; only their state changes. Opacity is handled in
   * CSS via `data-state` (see `conditions.css`).
   */
  return {
    element,

    show(live, settle = false) {
      const lit = new Set(
        (typeof live === 'number' ? [live] : live).map((index) =>
          Math.min(Math.max(index, 0), items.length - 1),
        ),
      );
      const last = Math.max(...lit);

      for (const [position, item] of items.entries()) {
        item.dataset['state'] = lit.has(position)
          ? 'live'
          : position < last
            ? 'made'
            : 'pending';
      }

      const timeline = gsap.timeline();
      if (settle) gsap.set(element, { opacity: 1, y: 0 });
      return timeline;
    },
  };
}

/** Shared card for figures and claims lists, so both look identical. */
function surface(spec: CardSpec, body: HTMLElement, fallback: Accent): HTMLElement {
  const children: HTMLElement[] = [];

  if (spec.label || spec.note) {
    const parts: HTMLElement[] = [];
    if (spec.label) parts.push(el('p', { className: 'brief-card-label', text: spec.label }));
    if (spec.note) parts.push(el('p', { className: 'brief-card-note', text: spec.note }));
    children.push(el('div', { className: 'brief-card-head', children: parts }));
  }
  children.push(body);

  const card = el('div', {
    className: 'brief-card',
    attrs: { 'data-accent': spec.accent ?? fallback },
    children,
  });
  if (!spec.label && !spec.note) card.dataset['bare'] = '';

  gsap.set(card, { opacity: 0, y: 22 });
  return card;
}

/**
 * Act I's standard slide layout: heading on top, evidence cards below, and
 * short numbered claims lit one at a time. Scenes use this so type, cards and
 * reveal timing match across the act.
 */
export function createBrief(spec: BriefSpec): Brief {
  const accent = spec.accent ?? 'circular';

  const eyebrow = el('p', { className: 'brief-eyebrow', text: spec.eyebrow });
  const heading = el('h2', { className: 'brief-heading', text: spec.heading });
  const head = el('div', { className: 'brief-head', children: [eyebrow, heading] });

  const stage = el('div', { className: 'brief-stage' });
  if (spec.split) stage.dataset['split'] = spec.split;

  const children: HTMLElement[] = [head, stage];

  if (spec.source || spec.note) {
    const parts: HTMLElement[] = [];
    if (spec.source) parts.push(el('span', { text: spec.source }));
    if (spec.note) parts.push(el('span', { className: 'brief-foot-note', text: spec.note }));
    children.push(el('div', { className: 'brief-foot', children: parts }));
  }

  const element = el('div', {
    className: 'brief',
    attrs: { 'data-accent': accent },
    children,
  });
  if (spec.source || spec.note) element.dataset['foot'] = '';

  return {
    element,
    stage,
    head: [eyebrow, heading],

    revealHead(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set([eyebrow, heading], { opacity: 1, y: 0 });
        return timeline;
      }

      return timeline.from([eyebrow, heading], {
        y: 26,
        opacity: 0,
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        stagger: seconds(STAGGER),
      });
    },

    addCard(cardSpec = {}) {
      const body = el('div', { className: 'brief-figure' });
      const card = surface(cardSpec, body, accent);
      stage.appendChild(card);

      return {
        element: card,
        body,

        reveal(settle = false) {
          const timeline = gsap.timeline();

          if (settle) {
            gsap.set(card, { opacity: 1, y: 0 });
            return timeline;
          }

          // `fromTo`: the card can be revealed more than once, and a repeated
          // `from` ends at the previous start value (`learnings.md` §31c).
          return timeline.fromTo(
            card,
            { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
          );
        },
      };
    },

    addClaims(lines, claimsSpec = {}) {
      const run = createClaims(lines, claimsSpec);
      const card = surface(claimsSpec, run.element, accent);
      stage.appendChild(card);

      return {
        element: card,

        show(live, settle = false) {
          run.show(live, settle);

          const timeline = gsap.timeline();
          if (settle) {
            gsap.set(card, { opacity: 1, y: 0 });
            return timeline;
          }

          return timeline.to(card, {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
          });
        },
      };
    },
  };
}
