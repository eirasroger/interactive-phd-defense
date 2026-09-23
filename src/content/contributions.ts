import paper1 from '@/assets/presentation/papers/paper1.png';
import paper2 from '@/assets/presentation/papers/paper2.png';
import paper3 from '@/assets/presentation/papers/paper3.png';
import paper4 from '@/assets/presentation/papers/paper4.png';
import paper5 from '@/assets/presentation/papers/paper5.png';
import type { ContributionMapSpec } from '@/components/figures/ContributionMap';

/**
 * Scene 11: the contributions, how they answer the objectives, and how they
 * connect. Last scene of Act I.
 *
 * One paper per beat, large enough to read. The paper image carries the title
 * and authors, so the text column shows only the role and the objective.
 *
 * `role` must match the station name in `narrative.md` and on the Act II
 * corridor wall.
 */

export const CONTRIBUTIONS = {
  eyebrow: 'Contributions',
  heading: 'How the objectives are answered.',
  /** Appended to the heading when the plan forms. */
  coda: 'And how they connect.',

  map: {
    items: [
      {
        key: 'C1',
        role: 'Decision framework',
        sheet: paper1,
        journal: 'Environmental Impact Assessment Review',
        locator: '121 (2026) 108561',
        answers: 'O1',
        plan: { column: 0, lane: 'axis' },
      },
      {
        key: 'C2',
        role: 'Empirical characterisation',
        sheet: paper2,
        journal: 'Environmental Impact Assessment Review',
        locator: '117 (2026) 108243',
        answers: 'O2',
        plan: { column: 1, lane: 'axis' },
      },
      {
        key: 'C3',
        role: 'Screening agent',
        sheet: paper3,
        journal: 'Automation in Construction',
        locator: '185 (2026) 106876',
        answers: 'O3',
        plan: { column: 2, lane: 'high' },
      },
      {
        key: 'C4',
        role: 'Inference',
        sheet: paper4,
        journal: 'Resources, Conservation & Recycling',
        locator: '224 (2026) 108573',
        answers: 'O4',
        plan: { column: 2, lane: 'low' },
      },
      {
        key: 'C5',
        role: 'Context-adaptive recommender',
        sheet: paper5,
        journal: 'Sustainable Production and Consumption',
        locator: '67 (2026) 119–144',
        // O4 is answered by both C4 and C5. Intentionally left unannounced
        // (see `narrative.md`).
        answers: 'O4',
        plan: { column: 3, lane: 'axis' },
      },
    ],

    /*
     * All edges use one style. C2 → C5 is a design-time link (`decisions.md`
     * §20), but that distinction is shown in Act II. Here it runs along the
     * axis between the C3 and C4 lanes like any other edge.
     */
    edges: [
      { from: 'C1', to: 'C2' },
      { from: 'C2', to: 'C3' },
      { from: 'C2', to: 'C4' },
      { from: 'C2', to: 'C5' },
      { from: 'C3', to: 'C5' },
      { from: 'C4', to: 'C5' },
    ],
  } satisfies ContributionMapSpec,
} as const;
