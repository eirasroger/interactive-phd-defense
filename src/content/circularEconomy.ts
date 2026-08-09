import type { LoopSpec } from '@/components/figures/Loop';

/**
 * Scene 3 — circular economy in construction.
 *
 * Two beats, because the argument has two halves and nothing else. The
 * hierarchy is on screen from the moment the scene opens; the click is spent
 * on the turn, not on assembling the picture.
 *
 * The turn is **not** that the loops fail physically — that is a different
 * literature and a different slide. It is that circularity is not assessed in
 * a form a designer can decide with: the documentation defines it for whole
 * buildings, or through indicators nothing can supply at early design, so it
 * survives as a certification line rather than as an input to a choice. What
 * *does* decide instead is scene 7's argument, and stays there.
 */
export const CIRCULAR_ECONOMY = {
  eyebrow: 'State of the art · 01',
  heading: 'Circular economy: a way of keeping materials at their highest value.',

  /** Reads the figure's encoding — run length is value lost. */
  principle: 'It replaces take, make, waste. The tighter the return, the more value survives.',

  /** The turn. Short claim, then the reason and what it leaves behind. */
  practice: [
    'In practice it is rarely assessed, and rarely used to decide.',
    'It is usually defined for a whole building, or through indicators early design cannot yet quantify. So it tends to appear only where a certification asks for it.',
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
