import type { LoopSpec } from '@/components/figures/Loop';

/**
 * Scene 4 — circular economy in construction.
 *
 * Two beats, because the argument has two halves and nothing else. The
 * hierarchy is on screen from the moment the scene opens; the click is spent
 * on the turn, not on assembling the picture.
 *
 * The turn is **not** that the loops fail physically — that is a different
 * literature and a different slide. Nor is it that teams are unable to assess
 * circularity: they are able, and an earlier draft saying otherwise drew the
 * correction that produced this wording. The turn is that assessing it by hand
 * across a candidate set is exhaustive work, so with no tooling to carry it the
 * criterion is dropped, and the documentation that does exist describes whole
 * buildings after the products are chosen. The gap is systematisation, which is
 * what gap 02 claims verbatim. What *does* decide instead is scene 8's
 * argument, and stays there.
 */
export const CIRCULAR_ECONOMY = {
  eyebrow: 'State of the art · 01',
  heading: 'Circular economy: a way of keeping materials at their highest value.',

  /**
   * Three claims, and the first is the one that reads the figure.
   *
   * The run length encoding is now stated on the drawing itself, down the free
   * margin, so this line is free to say what the hierarchy is *for* rather than
   * how to look at it.
   */
  claims: [
    'It replaces take, make, waste. The tighter the return, the more value survives.',
    'The barrier is effort. Assessing every candidate product by hand is exhaustive work, and without tooling for it the criterion drops out of the decision.',
    'It is defined for the whole building and measured after the products are chosen, through indicators early design can only estimate.',
  ],

  loop: {
    stages: ['Materials', 'Products', 'Building', 'End of life'],
    // Tightest first, which is also the order value is lost in.
    returns: [
      { to: 2, label: 'Reuse' },
      { to: 1, label: 'Remanufacture' },
      { to: 0, label: 'Recycle' },
    ],
    // The mismatch the second beat is about, marked on the two stages it falls
    // between. Both are hedged on purpose: the assessment is usually made of
    // the building, not always, and naming the two stages plainly is what
    // makes the distance between them read.
    marks: [
      { at: 1, lines: ['Where a product', 'is chosen'] },
      { at: 2, lines: ['Where circularity is', 'usually assessed'] },
    ],
  } satisfies LoopSpec,
} as const;
