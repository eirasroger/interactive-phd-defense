import logoUpc from '@/assets/presentation/logoupc.png';
import type { CaptionContent } from '@/components/Caption';

/**
 * Act I — Exterior.
 *
 * Structure only. Headings are the scene claims from the narrative manifest and
 * are architecture, not copy. Body text is **placeholder**, sized to the length
 * the final copy should occupy so the typographic composition can be judged
 * against a real block rather than an empty one.
 *
 * Every `TO WRITE` marker is meant to be visible on screen. Placeholder copy
 * that reads as plausible is how a draft sentence survives into a defence.
 *
 * The six state-of-the-art streams are **distributed across five scenes** —
 * circular economy, sustainability assessment, EPDs, the decision itself, and
 * what decides it in practice — each with the piece of the site that argues it.
 * One caption listing all six asks a single frame to carry a literature review.
 * See `scenes/act1/index.ts` for the walk.
 *
 * The environmental burden itself is not one of the five: it is made in the
 * motivation beat (`content/motivation.ts`) and would be repetition here, so
 * stream 1's slot went to circularity instead — see `content/circularEconomy.ts`
 * and `scenes/act1/CircularEconomyScene.ts`.
 *
 * **Stream 6 — artificial intelligence — has no scene, by decision.** Decision
 * tools and the computational work attempted on this problem are delivered
 * verbally over the `alternatives` beat. Its eyebrow number is therefore never
 * seen: the on-screen run is `01` to `05`, and `06` first appears as the sixth
 * row of the gaps figure. That row is the only place the stream is written down,
 * which is why its provenance label is load-bearing rather than decorative.
 */

const TO_WRITE = (words: number): string =>
  `TO WRITE · ${words} words. ${'· '.repeat(Math.max(words - 4, 1)).trim()}`;

export const act1Captions = {
  /** 1 · Connective · 0:30 — the establishing shot, and the title card. */
  overview: {
    logo: { src: logoUpc, alt: 'Universitat Politècnica de Catalunya · BarcelonaTech' },
    // The mark already says the institution, so the eyebrow says what the
    // document is instead of repeating it.
    eyebrow: 'Doctoral thesis · Defence',
    heading: 'Artificial Intelligence for Circular and Sustainable Product Decision-Support in Construction',
    body: ['Author: Roger Vergés Eiras · Supervisors: Núria Forcada, Kàtia Gaspar'],
    accent: 'circular',
    align: 'center',
  },

  /* Scene 2 is a composition, not a caption — see `content/motivation.ts`. */

  /* Scene 3 (stream 1's slot) is a composition, not a caption — circular
   * economy, built as the value-retention hierarchy. See
   * `content/circularEconomy.ts` and `scenes/act1/CircularEconomyScene.ts`. */

  /* Scene 4 (stream 3) is a composition, not a caption — sustainability
   * assessment, built as the life-cycle band that widens across five beats.
   * See `content/assessment.ts` and `scenes/act1/AssessmentScene.ts`. */

  /* Scene 5 (stream 4) is a composition, not a caption — the declaration, and
   * where its numbers come from. See `content/epd.ts` and
   * `scenes/act1/EpdScene.ts`. */

  /**
   * 7 · Supporting · 0:40 — close on the scaffold, and the object the rest of
   * the act is about.
   *
   * The world is the figure here. One bay of the elevation carries no cladding
   * panel, the camera is standing on the access that will come down two scenes
   * later, and both of those say the thing the beat is for: the specification
   * is open, briefly, and what goes in stands for the life of the building. A
   * diagram laid over that would be arguing with the picture.
   */
  decision: {
    eyebrow: 'State of the art · 04',
    heading: 'On what basis is a construction product selected?',
    body: [
      'A building is the accumulation of that decision, taken for every element and repeated throughout the project.',
    ],
    accent: 'emphasis',
  },

  /* Scene 8 (stream 5's gap) is a composition, not a caption — the four
   * candidates and what is known about each. See `content/practice.ts` and
   * `scenes/act1/PracticeScene.ts`. */

  /* Scene 9 is a composition, not a caption — the six gaps, struck one at a
   * time across the coverage they are read against. See `content/gaps.ts` and
   * `scenes/act1/GapsScene.ts`. */

  /** 9 · Hero · 0:50 — the 6 → 4 regrouping, shown down a terminated vista. */
  objectives: {
    eyebrow: 'Objectives',
    heading: 'The six regroup into four things that must be built.',
    body: [TO_WRITE(30)],
    accent: 'emphasis',
  },

  /** 10 · Supporting · recessed · 0:40 — walked, because the method is a route. */
  method: {
    eyebrow: 'Research structure',
    heading: 'TO WRITE · how the objectives shape the work.',
    body: [TO_WRITE(32)],
    accent: 'circular',
  },

  /** 11 · Connective · 0:20 — nearly wordless; this is the doorway. */
  entrance: {
    eyebrow: 'Act II',
    heading: 'Five papers. One pipeline.',
    accent: 'ai',
  },
} as const satisfies Record<string, CaptionContent>;
