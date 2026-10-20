import type { ObjectiveMapSpec } from '@/components/figures/ObjectiveMap';

/**
 * Scene 10: the six gaps regrouped into four objectives. The gaps stay along
 * the top and each objective highlights the gaps it absorbs.
 *
 * Objective titles are shortened from the thesis. `absorbs` follows each
 * objective's "Motivated by Gaps" line: O1: 1, 2. O2: 3. O3: 4. O4: 5, 6.
 * Gap labels match the previous scene's titles.
 */

export const OBJECTIVES = {
  eyebrow: 'Objectives',
  heading: 'Four objectives address the six gaps.',

  map: {
    gaps: [
      { key: 'Gap 01', label: 'Multi-criteria prioritisation' },
      { key: 'Gap 02', label: 'Circularity integration' },
      { key: 'Gap 03', label: 'Heterogeneous and missing data' },
      { key: 'Gap 04', label: 'Automated compliance prefiltering' },
      { key: 'Gap 05', label: 'Context-aware recommendation' },
      { key: 'Gap 06', label: 'End-to-end workflow' },
    ],

    items: [
      {
        key: 'O1',
        title: 'Define a product-level decision framework',
        icon: 'indicators',
        /** Indices into `gaps`. */
        absorbs: [0, 1],
      },
      {
        key: 'O2',
        title: 'Characterise product data and its gaps',
        icon: 'corpus',
        absorbs: [2],
      },
      {
        key: 'O3',
        title: 'Automate compliance prefiltering',
        icon: 'gate',
        absorbs: [3],
      },
      {
        key: 'O4',
        title: 'Develop and validate an ML recommender',
        icon: 'ranking',
        absorbs: [4, 5],
      },
    ],
  } satisfies ObjectiveMapSpec,
} as const;
