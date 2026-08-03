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
 */

const TO_WRITE = (words: number): string =>
  `TO WRITE · ${words} words. ${'· '.repeat(Math.max(words - 4, 1)).trim()}`;

export const act1Captions = {
  /** 1 · Connective · 0:30 */
  title: {
    eyebrow: 'Universitat Politècnica de Catalunya',
    heading: 'TO WRITE · thesis title',
    body: ['TO WRITE · author, supervisors, department, date.'],
    accent: 'circular',
    align: 'center',
  },

  /** 2 · Supporting · recessed · 1:00 */
  footprint: {
    eyebrow: 'Context · 01',
    heading: "Construction's footprint, and the targets now set against it.",
    body: [TO_WRITE(34), TO_WRITE(22)],
    accent: 'circular',
  },

  /** 3 · Hero · slot beat A · 1:15 */
  leverage: {
    eyebrow: 'Context · 02',
    heading: 'The decisions that determine a building are taken before it exists.',
    body: [TO_WRITE(30)],
    accent: 'emphasis',
  },

  /** 4 · Supporting · recessed · 0:45 — carries the crossing curve as overlay */
  tools: {
    eyebrow: 'Context · 03',
    heading: 'The tools built for this decision presuppose data completeness.',
    body: [TO_WRITE(28)],
    accent: 'circular',
  },

  /** 5 · Supporting · 0:30 */
  mismatch: {
    eyebrow: 'Context · 04',
    heading: 'Early design is structurally unable to provide it.',
    body: [TO_WRITE(24)],
    accent: 'emphasis',
  },

  /** 6 · Hero · slot beat B · 0:45 */
  practice: {
    eyebrow: 'Context · 05',
    heading: 'So cost and availability decide instead.',
    body: [TO_WRITE(26)],
    accent: 'emphasis',
  },

  /**
   * 7 · Supporting · recessed · 1:15
   *
   * Six streams, one gap each. The body is the six stream titles; the gaps they
   * produce are named in scene 8, not here.
   */
  sota: {
    eyebrow: 'State of the art',
    heading: 'What has been tried, and where each line of work stops.',
    body: [
      'Environmental burden of the construction sector.',
      'Circular economy in construction.',
      'Sustainability assessment frameworks in construction.',
      'EPDs as decision-support data.',
      'Decision-making in the early design stage.',
      'Artificial intelligence in the construction sector.',
    ],
    accent: 'ai',
  },

  /**
   * 8 · Hero · slot beat C · 1:00
   *
   * Six gaps, one per stream above, in the same order. The pairing is the point
   * of the scene and the body must preserve that order.
   */
  gaps: {
    eyebrow: 'The problem',
    heading: 'Six gaps crystallise.',
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

  /** 9 · Supporting · 0:45 — the 6 → 4 regrouping is shown, not stated */
  objectives: {
    eyebrow: 'The response',
    heading: 'The six regroup into four things that must be built.',
    body: [TO_WRITE(30)],
    accent: 'emphasis',
  },

  /** 10 · Supporting · recessed · 0:30 */
  method: {
    eyebrow: 'Method and structure',
    heading: 'TO WRITE · how the objectives shape the work.',
    body: [TO_WRITE(32)],
    accent: 'circular',
  },

  /** 11 · Connective · 0:20 — nearly wordless; this is the doorway */
  structure: {
    eyebrow: 'Act II',
    heading: 'Five papers. One pipeline.',
    accent: 'ai',
  },
} as const satisfies Record<string, CaptionContent>;
