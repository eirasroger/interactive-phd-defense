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
  /** Attribution, and anything else the figure states about itself. */
  readonly source?: string;
  readonly note?: string;
}

export interface CardSpec {
  /** Named above the drawing. A card with no label gives the row back. */
  readonly label?: string;
  readonly note?: string;
  readonly accent?: Accent;
}

export interface Card {
  readonly element: HTMLElement;
  /** Where the drawing goes. Already declared as a row, so an SVG cannot size it. */
  readonly body: HTMLElement;
  reveal(settle?: boolean): gsap.core.Timeline;
}

export interface Claims {
  readonly element: HTMLElement;
  /**
   * Lights the claims named in `live`, leaves everything before them made, and
   * holds everything after them pending.
   *
   * **A beat may carry more than one claim, and it usually does.** Passing a
   * single index made the last claim of a merged beat live and left the one
   * beside it at `made`, which on screen is indistinguishable from a claim that
   * was skipped: two lines arrive on the same click and only one of them lights.
   * The scene says which claims that click is about, and a beat carrying one
   * still passes one number.
   *
   * The whole state is written every time rather than the difference from the
   * beat before, so stepping backwards, jumping in from the deck and walking
   * forwards all land on the same frame.
   */
  show(live: number | readonly number[], settle?: boolean): gsap.core.Timeline;
}

export interface ClaimsSpec extends CardSpec {
  /**
   * `stack` reads down a narrow column beside a figure; `row` reads across the
   * full width underneath one.
   *
   * The column is right where the figure is tall enough to leave a column
   * beside it. Where the drawing wants the whole width, three claims in a
   * 30rem sidecar force it into a third of the frame, and the composition is
   * the same two-card split as every other slide in the act.
   */
  readonly flow?: 'stack' | 'row';
}

export interface Brief {
  readonly element: HTMLElement;
  /** The evidence region. Cards are appended here in column order. */
  readonly stage: HTMLElement;
  /** Everything the entry timeline moves, so a killed entry can be settled. */
  readonly head: readonly HTMLElement[];
  revealHead(settle?: boolean): gsap.core.Timeline;
  addCard(spec?: CardSpec): Card;
  /** A claims run on a card of its own, in the evidence region. */
  addClaims(lines: readonly string[], spec?: ClaimsSpec): Claims;
}

/**
 * A numbered claims run, without a card around it.
 *
 * Separate from `Brief.addClaims` so a scene can put the run inside a card it
 * already owns — under a figure that wants the full width, rather than beside
 * one that does not.
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
   * The run stands whole and only its light advances.
   *
   * Opacity is left to CSS through `data-state` rather than tweened here, for
   * the reason `conditions.css` records: a quantity driven from one declaration
   * cannot drift out of step with the others, and a transition on a class is one
   * declaration.
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

/**
 * The card both a figure and a claims run stand on.
 *
 * One builder rather than two, so the drawing and the argument beside it are
 * plainly the same object at the same elevation. They were diverging within an
 * hour of the first being written: only one of them had a head, and a card with
 * a label sitting next to one without reads as a panel next to a note.
 */
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
 * Act I's standard composition.
 *
 * A claim across the top and the evidence underneath it, which is the shape
 * Act II and Act III both use and the one thing Act I did not. Scenes compose
 * this rather than laying themselves out, so the register, the card treatment
 * and the reveal timing are identical across the act.
 *
 * **What it replaces.** `Slide` put the claim in a five-column well beside a
 * seven-column figure and centred both, and its beat material was paragraphs
 * accreting down that well. Long prose on a defence slide is read instead of
 * listened to, so the claims are short, numbered and lit one at a time here,
 * and the figure gets the width it was drawn for.
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

          // `fromTo` rather than `from`: the card may be revealed more than once
          // across a walk, and a second `from` on an element already carrying
          // one resolves its destination to the first one's start value —
          // `learnings.md` §31c.
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
