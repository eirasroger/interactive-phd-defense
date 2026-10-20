import type { LeverageSpec } from '@/components/figures/Leverage';

/**
 * Scene 3: why the thesis targets early design. The heading states the cost
 * claim and claim 02 gives the escalation. The curve shows the mechanism, so
 * the claims stay to one line each.
 */
export const LEVERAGE = {
  eyebrow: 'Motivation · Research context',
  heading: 'Decisions are cheapest to change early in design.',

  claims: [
    'Early design has the most influence on cost and impact.',
    'Later, a change becomes rework, then demolition.',
    'Construction products are specified in this early window.',
  ],

  band: {
    phases: [
      'Preliminary design',
      'Design development',
      'Construction documents',
      'Construction',
      'Operation',
    ],
    windowPhases: 2,
    ability: 'Ability to impact project',
    cost: 'Cost of design changes',
    window: 'Where construction products are specified',
  } satisfies LeverageSpec,

  /** Shown in the slide's attribution strip. The figure omits it. */
  source: 'After MacLeamy · Construction Users Roundtable, 2004',
} as const;
