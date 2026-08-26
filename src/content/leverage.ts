import type { LeverageSpec } from '@/components/figures/Leverage';

/**
 * Scene 3 — why the early design stage is the one being targeted.
 *
 * **The heading is the cost claim, and the escalation in claim 02 is its
 * evidence.** What the curve is for in this act is not that early design is a
 * good place to influence things; it is that a decision left standing gets more
 * expensive to undo at every stage after it — a substitution on a drawing,
 * rework once detailed, demolition and replacement once built. Environmental
 * impact and cost both inherit that, and both are named in the claims rather
 * than in the title.
 *
 * **The claims are three lines, and they were three paragraphs.** The curve
 * carries the mechanism and the column states the result. A slide that prints
 * both is a slide the committee reads instead of listening to.
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

  /** Carried by the composition's own strip, so the figure does not repeat it. */
  source: 'After MacLeamy · Construction Users Roundtable, 2004',
} as const;
