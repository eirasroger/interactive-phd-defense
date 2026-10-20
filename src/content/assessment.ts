import type { ImpactMethodSpec } from '@/components/figures/ImpactMethod';

/**
 * Scene 5: how impact is evaluated, and why that breaks at early design. Two
 * beats.
 */
export const ASSESSMENT = {
  eyebrow: 'State of the art · 02',
  heading: 'How environmental impact is measured.',

  /** The method, its inventory, and what is missing at early design. */
  claims: [
    'LCA, LCC and S-LCA together form LCSA.',
    'All of them need a complete inventory.',
    'At early design, most of the inventory is still open.',
  ],

  /**
   * On the second beat the `known` rows stay and the rest empty. Product and
   * quantity are known at concept; everything downstream of the choice is open.
   */
  method_figure: {
    inputs: [
      { label: 'Product and composition', known: true },
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
    missing: 'Open at early design',
  } satisfies ImpactMethodSpec,
} as const;
