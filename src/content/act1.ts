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
 * burden, circularity and assessment, EPDs, early design, artificial
 * intelligence — each with the piece of the site that argues it. One caption
 * listing all six asks a single frame to carry a literature review. See
 * `scenes/act1/index.ts` for the walk.
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

  /** 3 · Supporting · recessed · 0:50 — stream 1. */
  burden: {
    eyebrow: 'State of the art · 01',
    heading: 'The environmental burden of the construction sector.',
    body: [TO_WRITE(30)],
    accent: 'circular',
  },

  /** 4 · Supporting · 1:00 — streams 2 and 3, argued over the same ground. */
  assessment: {
    eyebrow: 'State of the art · 02',
    heading: 'Circularity, and how construction measures sustainability.',
    body: [
      'Circular economy in construction.',
      'Sustainability assessment frameworks — LCA, levels of assessment.',
      TO_WRITE(24),
    ],
    accent: 'circular',
  },

  /** 5 · Supporting · 0:50 — stream 4, on the building it would describe. */
  data: {
    eyebrow: 'State of the art · 03',
    heading: 'EPDs as the data early design is expected to decide from.',
    body: [TO_WRITE(28)],
    accent: 'emphasis',
  },

  /** 6 · Hero · 0:50 — stream 5, at the one place the building is still open. */
  earlyDesign: {
    eyebrow: 'State of the art · 04',
    heading: 'The decisions that determine a building are taken before it exists.',
    body: [TO_WRITE(26)],
    accent: 'emphasis',
  },

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
