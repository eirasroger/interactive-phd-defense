import type { ObjectiveMapSpec } from '@/components/figures/ObjectiveMap';

/**
 * Scene 10 — the six gaps regrouped into four objectives.
 *
 * **The regrouping is shown, not glossed.** `narrative.md` is explicit that the
 * audience will count. The six gaps stand along the top for the whole scene, and
 * each objective lights the ones it is motivated by — so the fold from six to
 * four is watched rather than asserted, and the pairing is legible without a
 * line of narration.
 *
 * Titles are the thesis's own objective statements, verbatim. The `absorbs`
 * mapping is the *Motivated by Gaps …* line under each one, and is not a
 * reading: O1 ← 1, 2 · O2 ← 3 · O3 ← 4 · O4 ← 5, 6.
 *
 * **The gap labels are compressions, and the only editorial text here.** Two or
 * three words each, because a chip carrying the full gap title is the previous
 * scene printed twice. The full wording was on screen one beat ago and is what
 * the audience is being reminded of, not told.
 */

export const OBJECTIVES = {
  eyebrow: 'Objectives',
  heading: 'The six gaps regroup into four objectives.',

  map: {
    gaps: [
      { key: 'Gap 01', label: 'Multi-criteria prioritisation' },
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
