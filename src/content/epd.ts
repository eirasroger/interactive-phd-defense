import type { DeclarationSpec } from '@/components/figures/Declaration';

/**
 * Scene 5 — EPDs as decision-support data (stream 4).
 *
 * The hinge of the act. Scene 4 closes on an assessment with no inventory to
 * run on; this opens with the sector's answer to exactly that, and turns on
 * what the answer costs: the generic assumptions did not go away, they moved
 * upstream into the declaration and came back carrying a verification.
 *
 * **Not a study of the corpus.** What declarations actually look like at scale
 * is C2's contribution and its hero scene (`c2-landscape`), measured rather
 * than asserted. Spending that evidence here would leave the hero re-showing a
 * picture the committee has already been given, and would file the thesis's own
 * measurement under background literature.
 *
 * So one declaration, illustrative, and the argument is where its numbers come
 * from. Non-comparability across programmes rides in the spoken line rather
 * than in the figure, for the same reason.
 */
export const EPD = {
  eyebrow: 'State of the art · 03',
  heading: 'EPDs as a source of product-level environmental data',

  /**
   * What it is, held to what it actually is. An EPD is a reporting format, not
   * a decision document, and an LCA can be carried out without one: generic
   * database datasets are the alternative, and the distinction between generic
   * and product-specific is the whole reason EPDs exist.
   *
   * The rest of the definition — declared unit, verification body, programme —
   * is spoken. The figure is already showing a declaration, so a caption that
   * describes one is the slide reading itself out.
   */
  carrier:
    'A verified report of one product’s environmental performance, calculated by LCA under common category rules.',

  /** The turn. The short claim, then the consequence. */
  basis: [
    'Only the product stage rests on primary data.',
    'Transport, service life and end of life are assumed for a generic case. Verification confirms compliance with the rules, not that the scenarios fit the project.',
  ],

  /**
   * The running example, three scenes before it is named as one. Concrete
   * enters Act I as the panel in the specification slot, so the declaration
   * read here is the declaration of the thing in the slot.
   */
  declaration: {
    product: 'Precast concrete cladding panel',
    unit: '1 m² · declared unit',
    gate: 'Factory gate',
    // `Scenario` is EN 15804's word for these modules and it is what the code
    // calls them, but it is not the verdict the figure should deliver: the
    // scenario is the mechanism, and what the audience has to take away is the
    // result. Because the module is a scenario, its numbers are assumed.
    //
    // The counterpart is `Primary data` rather than `Measured`, which would
    // overclaim A1–A3: the manufacturing process is the manufacturer's own, but
    // the upstream supply chain behind it is background data like any other.
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
    // Plausible for a precast panel, and illustrative on purpose: the figure is
    // arguing about where a number comes from, not reporting one.
    indicator: { name: 'Global warming potential', value: '182', unit: 'kg CO₂e' },
  } satisfies DeclarationSpec,
} as const;
