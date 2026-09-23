import type { DeclarationSpec } from '@/components/figures/Declaration';

/**
 * Scene 5: EPDs as decision-support data (stream 4).
 *
 * Shows one illustrative declaration and where its numbers come from. Corpus
 * analysis is saved for C2 (`c2-landscape`). Non-comparability across
 * programmes is spoken.
 */
export const EPD = {
  eyebrow: 'State of the art · 03',
  heading: 'EPDs as a source of product-level environmental data',

  /**
   * Definition of an EPD as a reporting format. Declared unit, verification
   * body and programme are spoken.
   */
  carrier:
    'A verified report of one product’s environmental performance, calculated by LCA under common category rules.',

  /** Claim, then consequence. */
  basis: [
    'Only the product stage rests on primary data.',
    'Transport, service life and end of life are assumed for a generic case. Verification confirms compliance with the rules, not that the scenarios fit the project.',
  ],

  /** The precast concrete panel from the Act I specification slot. */
  declaration: {
    product: 'Precast concrete cladding panel',
    unit: '1 m² · declared unit',
    gate: 'Factory gate',
    // Scenario modules (EN 15804) are labelled by their consequence: assumed
    // numbers. A1-A3 is "Primary data" because its upstream supply chain is
    // still background data.
    verdicts: { primary: 'Primary data', scenario: 'Assumed' },
    modules: [
      {
        code: 'A1–A3',
        name: 'Product stage',
        basis: 'The process the manufacturer operates',
        scenario: false,
      },
      {
        code: 'A4–A5',
        name: 'Construction',
        basis: 'Transport distance, installation waste',
        scenario: true,
      },
      {
        code: 'B1–B7',
        name: 'Use stage',
        basis: 'Service life, maintenance frequency',
        scenario: true,
      },
      {
        code: 'C1–C4',
        name: 'End of life',
        basis: 'Demolition and waste treatment route',
        scenario: true,
      },
      {
        code: 'D',
        name: 'Beyond the boundary',
        basis: 'Recovery rate, and how it is credited',
        scenario: true,
      },
    ],
    // Illustrative value, plausible for a precast panel.
    indicator: { name: 'Global warming potential', value: '182', unit: 'kg CO₂e' },
  } satisfies DeclarationSpec,
} as const;
