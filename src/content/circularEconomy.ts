import type { LoopSpec } from '@/components/figures/Loop';

/**
 * Scene 4: circular economy in construction. Two beats. The hierarchy shows
 * from the start; the click reveals the barrier. The barrier is the manual
 * effort of assessing every candidate, which matches gap 02.
 */
export const CIRCULAR_ECONOMY = {
  eyebrow: 'State of the art · 01',
  heading: 'Circular economy: a way of keeping materials at their highest value.',

  /** The first claim explains the figure. */
  claims: [
    'It replaces take, make, waste. The tighter the return, the more value survives.',
    'The barrier is effort. Assessing every candidate product by hand is exhaustive work, and without tooling for it the criterion drops out of the decision.',
    'It is defined for the whole building and measured after the products are chosen, through indicators early design can only estimate.',
  ],

  loop: {
    stages: ['Materials', 'Products', 'Building', 'End of life'],
    // Tightest loop first, which is also the order value is lost.
    returns: [
      { to: 2, label: 'Reuse' },
      { to: 1, label: 'Remanufacture' },
      { to: 0, label: 'Recycle' },
    ],
    // Second beat: the two stages where products are chosen and where
    // circularity is usually assessed. The wording is hedged on purpose.
    marks: [
      { at: 1, lines: ['Where a product', 'is chosen'] },
      { at: 2, lines: ['Where circularity is', 'usually assessed'] },
    ],
  } satisfies LoopSpec,
} as const;
