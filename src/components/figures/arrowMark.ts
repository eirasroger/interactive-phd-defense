import { el } from '@/utilities/dom';
import './arrow-mark.css';

export interface ArrowMark {
  readonly element: HTMLElement;
  /** Animated with `scaleX` from its tail, so the arrow grows. */
  readonly shaft: HTMLElement;
  /** Sibling of the shaft, so the shaft's scale does not distort it. */
  readonly head: HTMLElement;
}

/**
 * Arrow linking one column to the next. The head is a separate element so it
 * keeps its shape while the shaft scales.
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
