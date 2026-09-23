import type { ObjectiveMapSpec } from '@/components/figures/ObjectiveMap';

/**
 * Scene 10: the six gaps regrouped into four objectives. The gaps stay along
 * the top and each objective highlights the gaps it absorbs.
 *
 * Objective titles are verbatim from the thesis. `absorbs` follows each
 * objective's "Motivated by Gaps" line: O1: 1, 2. O2: 3. O3: 4. O4: 5, 6.
 * Gap labels are short summaries of the previous scene's titles. Gap 01
 * summarises its description instead (the criteria are never weighed together).
 */

export const OBJECTIVES = {
  eyebrow: 'Objectives',
  heading: 'The six gaps regroup into four objectives.',

  map: {
    gaps: [
      { key: 'Gap 01', label: 'Criteria weighed together' },
      { key: 'Gap 02', label: 'Circularity integration' },
      { key: 'Gap 03', label: 'Heterogeneous, missing data' },
      { key: 'Gap 04', label: 'Compliance prefiltering' },
      { key: 'Gap 05', label: 'Context-aware ML' },
      { key: 'Gap 06', label: 'End-to-end workflow' },
    ],

    items: [
      {
        key: 'O1',
        title:
          'Define a product-level decision framework and indicator schema for early-stage sustainable and circular product selection',
        icon: 'indicators',
        /** Indices into `gaps`. */
        absorbs: [0, 1],
      },
      {
        key: 'O2',
        title:
          'Characterise how environmental and circularity information is reported, and establish strategies for heterogeneous, inconsistent, and missing data',
        icon: 'corpus',
        absorbs: [2],
      },
      {
        key: 'O3',
        title: 'Develop a compliance-first automated prefiltering workflow at the product level',
        icon: 'gate',
        absorbs: [3],
      },
      {
        key: 'O4',
        title:
          'Develop and validate a machine learning-based recommender model that prioritises compliant products using heterogeneous early-stage evidence',
        icon: 'ranking',
        absorbs: [4, 5],
      },
    ],
  } satisfies ObjectiveMapSpec,
} as const;
