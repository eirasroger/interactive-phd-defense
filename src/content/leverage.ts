import type { LeverageSpec } from '@/components/figures/Leverage';

/**
 * Scene 3 — why the early design stage is the one being targeted.
 */
export const LEVERAGE = {
  eyebrow: 'Motivation · Research context',
  heading: 'Environmental performance is most effectively influenced during early design, when key decisions are still flexible.',

  /** The ability, and what it is worth. */
  ability:
    'The ability to impact the project is highest while the project is least defined, so the largest reductions in environmental impact are available at the front of the programme.',

  /** What it is traded against, and where construction products are specified. */
  cost: 'That ability declines as the design is fixed, and the cost of revising a decision rises against it: a substitution made on a drawing becomes rework once detailed, and demolition and replacement once built. Construction products are specified inside the first window, where the ability is still high and the cost still low.',

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
    source: 'After MacLeamy · Construction Users Roundtable, 2004',
  } satisfies LeverageSpec,
} as const;
