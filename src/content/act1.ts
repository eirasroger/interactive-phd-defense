import logoUpc from '@/assets/presentation/logoupc.png';
import type { CaptionContent } from '@/components/Caption';

/**
 * Act I: Exterior. Captions for the two scenes that use one; every other scene
 * is a composition with its own content file.
 *
 * State-of-the-art streams are spread over five scenes (see `scenes/act1/index.ts`).
 * The burden stream lives in `content/motivation.ts`, so stream 1's slot shows
 * circular economy. Stream 6 (AI) has no scene: it is spoken over the
 * `alternatives` beat and first written as the sixth row of the gaps figure.
 */

export const act1Captions = {
  /** 1 · Connective · 0:30. Establishing shot and title card. */
  overview: {
    logo: { src: logoUpc, alt: 'Universitat Politècnica de Catalunya · BarcelonaTech' },
    // The logo names the institution, so the eyebrow names the document.
    eyebrow: 'Doctoral thesis · Defence',
    heading: 'Artificial Intelligence for Circular and Sustainable Product Decision-Support in Construction',
    body: ['Author: Roger Vergés Eiras · Supervisors: Núria Forcada, Kàtia Gaspar'],
    accent: 'circular',
    align: 'center',
  },

  /* Scene 2: composition in `content/motivation.ts`. */

  /* Scene 3 (stream 1's slot): circular economy as the value-retention
   * hierarchy. See `content/circularEconomy.ts`. */

  /* Scene 4 (stream 3): sustainability assessment as a life-cycle band over
   * five beats. See `content/assessment.ts`. */

  /* Scene 5 (stream 4): the EPD and the source of its numbers. See
   * `content/epd.ts`. */

  /**
   * 7 · Supporting · 0:40. Close on the scaffold. The 3D scene is the figure:
   * one bay has no cladding panel, showing the specification is still open.
   */
  decision: {
    eyebrow: 'State of the art · 04',
    heading: 'On what basis is a construction product selected?',
    body: [
      'A building is the accumulation of that decision, taken for every element and repeated throughout the project.',
    ],
    accent: 'emphasis',
  },

  /* Scene 8 (stream 5's gap): the four candidates and what is known about
   * each. See `content/practice.ts`. */

  /* Scene 9: the six gaps, struck one at a time. See `content/gaps.ts`. */

  /* Scene 10: the six gaps regrouped into four objectives. See
   * `content/objectives.ts`. */

  /* Scene 11 ends the act: the five papers, then the pipeline they form. See
   * `content/contributions.ts`. Act II starts with the doors opening, a
   * transition with no text. */
} as const satisfies Record<string, CaptionContent>;
