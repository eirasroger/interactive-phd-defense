import type { InfluenceCurveSpec } from '@/components/figures/InfluenceCurve';

/**
 * Scene 6 — decision-making in the early design stage (stream 5).
 *
 * The crossing that scene 4 stops short of: scene 4 says the assessment does
 * not reach early design, this says what that costs.
 */
export const EARLY_DESIGN = {
  eyebrow: 'State of the art · 04',
  heading: 'The decisions that determine a building are taken before it exists.',

  influence:
    'Freedom to change the building — and with it the impact — is greatest while almost nothing about it is fixed.',

  crossing:
    'The information needed to justify a choice arrives as that freedom runs out. By the time the assessment is reliable, the decision has been made.',

  curve: {
    phases: ['Concept', 'Preliminary', 'Detailed', 'Construction', 'Operation'],
    windowPhases: 2,
    influence: 'Freedom to change the design',
    information: 'Information available to assess it',
    window: 'Where the product is chosen',
    crossing: 'assessment becomes reliable here',
  } satisfies InfluenceCurveSpec,
} as const;
