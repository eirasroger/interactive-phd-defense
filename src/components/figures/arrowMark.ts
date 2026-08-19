import { el } from '@/utilities/dom';
import './arrow-mark.css';

export interface ArrowMark {
  readonly element: HTMLElement;
  /** Scaled from its tail, so the arrow is drawn rather than revealed. */
  readonly shaft: HTMLElement;
  /** A sibling, never a child: a head inside the shaft is squashed by the scale. */
  readonly head: HTMLElement;
}

/**
 * The mark that carries a value from one column to the next.
 *
 * The head is a sibling of the shaft rather than a pseudo-element on it,
 * because a transform applies to a pseudo-element too: scaling the shaft from
 * zero flattened the head against the tail and then stretched it back, which is
 * exactly the cheap look the beats are trying to avoid. Drawn this way the
 * shaft extends at constant thickness and the head lands on its point.
 */
export function createArrow(tone: 'ink' | 'field' = 'ink'): ArrowMark {
  const shaft = el('span', { className: 'mk-shaft' });
  const head = el('span', { className: 'mk-head' });

  return {
    shaft,
    head,
    element: el('span', {
      className: 'mk-arrow',
      attrs: { 'data-tone': tone },
      children: [shaft, head],
    }),
  };
}
