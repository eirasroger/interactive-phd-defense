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
 * circular economy, sustainability assessment, EPDs, early design, artificial
 * intelligence — each with the piece of the site that argues it. One caption
 * listing all six asks a single frame to carry a literature review. See
 * `scenes/act1/index.ts` for the walk.
 *
 * The environmental burden itself is not one of the five: it is made in the
 * motivation beat (`content/motivation.ts`) and would be repetition here, so
 * stream 1's slot went to circularity instead — see `content/circularEconomy.ts`
 * and `scenes/act1/CircularEconomyScene.ts`.
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

  /** 5 · Supporting · 0:50 — stream 4, on the building it would describe. */
  data: {
    eyebrow: 'State of the art · 03',
    heading: 'EPDs as the data early design is expected to decide from.',
    body: [TO_WRITE(28)],
    accent: 'emphasis',
  },

  /* Scene 6 (stream 5) is a composition, not a caption — the influence /
   * information crossing. See `content/earlyDesign.ts` and
   * `scenes/act1/EarlyDesignScene.ts`. */

  /** 7 · Hero · 0:55 — stream 6, standing in front of the four options. */
  alternatives: {
    eyebrow: 'State of the art · 05',
    heading: 'So cost and availability decide instead — and what AI has offered so far.',
    body: [TO_WRITE(30)],
    accent: 'ai',
  },

  /**
   * 8 · Supporting · recessed · 1:00
   *
   * Six gaps, one per stream, in the order the streams were walked through.
   * The pairing is the point of the scene and the body must preserve it.
   */
  gaps: {
    eyebrow: 'Research gaps',
    heading: 'Six gaps, and the open challenges they leave.',
    body: [
      TO_WRITE(12),
      TO_WRITE(12),
      TO_WRITE(12),
      TO_WRITE(12),
      TO_WRITE(12),
      TO_WRITE(12),
    ],
    accent: 'emphasis',
  },

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
