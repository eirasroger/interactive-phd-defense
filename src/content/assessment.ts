import type { ImpactMethodSpec } from '@/components/figures/ImpactMethod';

/**
 * Scene 5 — how impact is evaluated, and why that fails at early design.
 *
 * Two beats. LCA is the tool; LCA needs an inventory; at concept there is no
 * inventory. Nothing else belongs on this slide.
 */
export const ASSESSMENT = {
  eyebrow: 'State of the art · 02',
  heading: 'How construction measures its environmental impact.',

  /**
   * The method, then what it stands on, then what happens when that is absent.
   *
   * Three lines where there were two paragraphs. The middle one is the hinge
   * and is deliberately the shortest: the inventory is a list of four things,
   * and the figure is already drawing them.
   */
  claims: [
    'Environmental impact is evaluated with LCA, joined by LCC and S-LCA as LCSA where the economic and social dimensions are counted too.',
    'All of it runs on an inventory: what the product is, how much of it, how long it lasts.',
    'At early design none of that is decided yet, so the assessment either waits or runs on generic assumptions.',
  ],

  method_figure: {
    inputs: [
      'Which product, and its composition',
      'Quantities',
      'Transport and installation',
      'Service life and maintenance',
      'End-of-life route',
    ],
    bands: [
      { code: 'LCA', name: 'Environmental', rank: 'primary' },
      { code: 'LCC', name: 'Economic', rank: 'secondary' },
      { code: 'S-LCA', name: 'Social', rank: 'secondary' },
    ],
    sum: 'LCSA',
    missing: 'Not yet decided at early design',
  } satisfies ImpactMethodSpec,
} as const;
