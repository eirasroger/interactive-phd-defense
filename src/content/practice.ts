import type { AnchorSpec } from '@/components/Anchor';
import { columnKey, type CandidateSetSpec } from '@/components/figures/CandidateSet';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Vec3 } from '@/engine/camera/types';
import { REVIEW } from '@/world/exterior/site';

/**
 * Scene 8: how product selection works in current practice (stream 5).
 *
 * All marketed products pass compliance, so it does not separate them. The
 * withheld rows cover more than sustainability: two come from `river`, `park`
 * and `construction`; the other two (performance past the minimum, fit to
 * context) are why C1 evaluates beyond impact and C5 adapts to context.
 */

/**
 * World positions of the four promenade panels, derived from `REVIEW`, so the
 * column labels follow the row. Labels sit `LABEL_HEIGHT` above the centre.
 */
const LABEL_HEIGHT = 5.2;

const panelAt = (index: number): Vec3 => [
  REVIEW.centre[0] +
    (index - (REVIEW.count - 1) / 2) * REVIEW.spacing +
    ZONE_ORIGIN.exterior[0],
  REVIEW.centre[1] + LABEL_HEIGHT + ZONE_ORIGIN.exterior[1],
  REVIEW.centre[2] + ZONE_ORIGIN.exterior[2],
];

const CANDIDATES = [
  'Precast concrete',
  'Brick masonry',
  'Timber rainscreen',
  'Composite panel',
] as const;

export const PRACTICE = {
  eyebrow: 'State of the art · 05',
  heading: 'In practice, products are chosen on cost and availability.',

  /** Why compliance does not separate the candidates. */
  criteria: 'Once regulatory compliance is met, cost and availability decide.',

  /**
   * The gap is integration: no mechanism combines the existing evidence for the
   * other dimensions into one comparison. The pipeline fills that gap.
   * The listed dimensions are this work's scope; a decision may need others.
   */
  evidence: 'Suppliers report cost and availability directly.',

  /** Each label includes its column key so labels and columns pair up. */
  anchors: CANDIDATES.map(
    (name, index): AnchorSpec => ({
      position: panelAt(index),
      label: `${columnKey(index)} · ${name}`,
    }),
  ),

  /** Illustrative values. What matters is which rows are filled. */
  set: {
    candidates: [...CANDIDATES],
    gate: {
      label: 'Regulatory compliance',
      value: 'Pass',
      note: 'All four are admissible',
    },
    criteria: [
      { label: 'Cost', values: ['€ 210 / m²', '€ 265 / m²', '€ 240 / m²', '€ 185 / m²'] },
      { label: 'Availability', values: ['6 weeks', '4 weeks', '10 weeks', '3 weeks'] },
      { label: 'Environmental impact' },
      { label: 'Circularity' },
      { label: 'Technical performance' },
      { label: 'Fit to context' },
    ],
    withheld: 'Not integrated in current practice',
  } satisfies CandidateSetSpec,
} as const;
