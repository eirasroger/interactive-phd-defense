import type { ImpactMethodSpec } from '@/components/figures/ImpactMethod';

/**
 * Scene 5: how impact is evaluated, and why that breaks at early design. Two
 * beats.
 */
export const ASSESSMENT = {
  eyebrow: 'State of the art · 02',
  heading: 'How construction measures its environmental impact.',

  /** The method, its inventory, and what is missing at early design. */
  claims: [
    'Environmental impact is evaluated with LCA, joined by LCC and S-LCA as LCSA where the economic and social dimensions are counted too.',
    'All of it runs on an inventory: what the product is, how much of it, how long it lasts.',
    'At early design the candidate product and its quantity can be known. Transport, service life and end of life are still open, so the assessment either waits or runs on generic assumptions.',
  ],

  /**
   * On the second beat the `known` rows stay and the rest empty. Product and
   * quantity are known at concept; everything downstream of the choice is open.
   */
  method_figure: {
    inputs: [
      { label: 'Which product, and its composition', known: true },
      { label: 'Quantities', known: true },
      { label: 'Transport and installation' },
      { label: 'Service life and maintenance' },
      { label: 'End-of-life route' },
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
