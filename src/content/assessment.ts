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
    'At early design the candidate product and its quantity can be known. Transport, service life and end of life are still open, so the assessment either waits or runs on generic assumptions.',
  ],

  /**
   * The first two rows hold on the second beat and the last three empty.
   *
   * An earlier pass drained all five, which read as though the specifier knew
   * nothing at concept. The product under consideration is the thing being
   * chosen and its quantity comes off the model, so both are available. What is
   * open is everything downstream of the choice, and that is the honest gap:
   * partial evidence the method cannot run on, which is what C3 and C5 are for.
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
