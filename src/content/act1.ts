import type { CaptionContent } from '@/components/Caption';

/**
 * Act I — Exterior.
 *
 * Headings are the claims from the narrative manifest, one per scene. Body copy
 * is working text: it exists so the typographic composition can be judged at
 * the real length, and it is expected to churn.
 *
 * The title scene's copy is a placeholder and is marked as one.
 */
export const act1Captions = {
  title: {
    eyebrow: 'Universitat Politècnica de Catalunya',
    heading: 'Thesis title to be set.',
    body: ['Doctoral defence · placeholder copy.'],
    accent: 'circular',
    align: 'center',
  },

  footprint: {
    eyebrow: 'Context · 01',
    heading: "Construction's footprint, and the targets now set against it.",
    body: [
      'The sector accounts for a share of material use and emissions that regulation has stopped treating as background.',
      'The obligation has arrived. The means of meeting it, product by product, has not.',
    ],
    accent: 'circular',
  },

  leverage: {
    eyebrow: 'Context · 02',
    heading: 'The decisions that determine a building are taken before it exists.',
    body: [
      'Influence over material outcomes is at its highest at the point where the least is known — and falls away as the design resolves.',
    ],
    accent: 'emphasis',
  },

  tools: {
    eyebrow: 'Context · 03',
    heading: 'The tools built for this decision presuppose data completeness.',
    body: [
      'Life cycle assessment chief among them: a method that answers well once the inventory is known, and has little to say before it is.',
    ],
    accent: 'circular',
  },

  mismatch: {
    eyebrow: 'Context · 04',
    heading: 'Early design is structurally unable to provide it.',
    body: [
      'Not through negligence. The information the method requires is produced by decisions the method is meant to inform.',
    ],
    accent: 'emphasis',
  },

  practice: {
    eyebrow: 'Context · 05',
    heading: 'So cost and availability decide instead.',
    body: [
      'Expert judgement covers the gap where it is available, but it scales poorly and leaves no traceable reasoning behind it.',
    ],
    accent: 'circular',
  },

  gaps: {
    eyebrow: 'The problem',
    heading: 'Four gaps crystallise.',
    body: [
      'No evaluation logic that early design can sustain. No measured account of what product data actually exists. No separation of feasibility from preference. No way to act on evidence that is incomplete.',
    ],
    accent: 'emphasis',
  },

  objectives: {
    eyebrow: 'The response',
    heading: 'The same four, restated as what must be built.',
    body: [
      'Each objective answers one gap. Four objectives, five contributions — the asymmetry is at O4, and it is deliberate.',
    ],
    accent: 'emphasis',
  },

  structure: {
    eyebrow: 'Act II',
    heading: 'Five papers. One pipeline.',
    accent: 'ai',
  },
} as const satisfies Record<string, CaptionContent>;
