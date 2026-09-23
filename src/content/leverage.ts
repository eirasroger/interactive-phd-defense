import type { LeverageSpec } from '@/components/figures/Leverage';

/**
 * Scene 3: why the thesis targets early design. The heading states the cost
 * claim and claim 02 gives the escalation. The curve shows the mechanism, so
 * the claims stay to one line each.
 */
export const LEVERAGE = {
  eyebrow: 'Motivation · Research context',
  heading: 'The cost of changing a decision rises the later it is addressed.',

  claims: [
    'The ability to shape a project is highest while the project is least defined, so the largest reductions in cost and in environmental impact are available at the front of the programme.',
    'That ability declines as the design is fixed, and the cost of revising a decision rises against it: a substitution made on a drawing becomes rework once detailed, and demolition and replacement once built.',
    'Construction products are specified inside the first window, while the decisions around them are still fluid.',
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
