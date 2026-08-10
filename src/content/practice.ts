import type { AnchorSpec } from '@/components/Anchor';
import { columnKey, type CandidateSetSpec } from '@/components/figures/CandidateSet';
import { ZONE_ORIGIN } from '@/config/layout';
import type { Vec3 } from '@/engine/camera/types';
import { REVIEW } from '@/world/exterior/site';

/**
 * Scene 8 — how the product decision is actually taken (stream 5).
 *
 * **Compliance is a gate, and the argument starts above it.** Every product on
 * the market has cleared the regulatory threshold, so it separates none of the
 * candidates. What should separate them is everything past it, and current
 * practice has no mechanism that brings any of it into the comparison.
 *
 * **The withheld rows are deliberately wider than sustainability.** Two of them
 * are cuts already made by `river`, `park` and `construction`. The other two —
 * performance past the certified minimum, and fit to the application and its
 * stakeholders — are the thesis's own scope, and are why C1 evaluates on more
 * than impact and why C5 adapts to context. A slide that reduced the problem to
 * carbon would misdescribe the contribution.
 *
 * Cost and availability are not villains. They are the two dimensions a supplier
 * answers in an afternoon, which is exactly why they decide.
 */

/**
 * The four panels standing on the promenade, in world coordinates, so the
 * columns can be tethered to the objects they are about.
 *
 * Derived from `REVIEW` rather than typed: the row is centred on `REVIEW.centre`
 * at `REVIEW.spacing`, and the label rides above the panel tops. Move the row
 * and the labels follow it.
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
  heading: 'In current practice, selection past compliance is governed by cost and availability.',

  /** The threshold, and why it discriminates between nothing. */
  criteria:
    'All four are compliant. Compliance is a regulatory threshold any marketed product has met, so it establishes admissibility without distinguishing between candidates.',

  /**
   * **The claim is about integration, not about availability.** Evidence for
   * the remaining dimensions exists in some form; what does not exist is a
   * mechanism that brings it into a comparison the specifier can act on. Stated
   * as an evidence gap it would be false, and it would also describe a
   * different thesis: the contribution is the pipeline, so the absence has to
   * be the one the pipeline fills.
   *
   * Deliberately not a count either. The dimensions below are the ones this
   * work operates on, and a decision could reasonably require others.
   */
  evidence:
    'Cost and availability are reported directly by suppliers. No decision-support mechanism integrates the remaining dimensions, or any further ones the decision requires, into a comparison the specifier can act on, so practice defaults to the two that are.',

  /** Each label carries the key its column is headed with, so the two pair. */
  anchors: CANDIDATES.map(
    (name, index): AnchorSpec => ({
      position: panelAt(index),
      label: `${columnKey(index)} · ${name}`,
    }),
  ),

  /** Illustrative. The argument is which rows can be filled. */
  set: {
    candidates: [...CANDIDATES],
    gate: {
      label: 'Regulatory compliance',
      value: 'Met',
      note: 'All four are admissible',
    },
    criteria: [
      { label: 'Cost', values: ['€ 210 / m²', '€ 265 / m²', '€ 240 / m²', '€ 185 / m²'] },
      { label: 'Availability', values: ['6 weeks', '4 weeks', '10 weeks', '3 weeks'] },
      { label: 'Environmental performance' },
      { label: 'Circularity' },
      { label: 'Performance beyond compliance' },
      { label: 'Fit to context and use' },
    ],
    withheld: 'Not integrated by any decision-support mechanism in current practice',
  } satisfies CandidateSetSpec,
} as const;
