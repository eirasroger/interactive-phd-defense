import { createAttention } from '@/components/figures/Attention';
import { createBudget } from '@/components/figures/Budget';
import { createBurden } from '@/components/figures/Burden';
import { createConverge } from '@/components/figures/Converge';
import { createEnables } from '@/components/figures/Enables';
import { createCorpus } from '@/components/figures/Corpus';
import { createFramework } from '@/components/figures/Framework';
import { createLandscape } from '@/components/figures/Landscape';
import { createModel } from '@/components/figures/Model';
import { createOpening } from '@/components/figures/Opening';
import { createParadox } from '@/components/figures/Paradox';
import { createContext } from '@/components/figures/Context';
import { createHandover } from '@/components/figures/Handover';
import { createReach } from '@/components/figures/Reach';
import { createSalience } from '@/components/figures/Salience';
import { createSemantic } from '@/components/figures/Semantic';
import { createSupervision } from '@/components/figures/Supervision';
import { createValidation } from '@/components/figures/Validation';
import { createReconcile } from '@/components/figures/Reconcile';
import { createProfile } from '@/components/figures/Profile';
import { createSort } from '@/components/figures/Sort';
import {
  aggregate,
  createTakeaway,
  fork,
  handoff,
  pair,
  spread,
  stack,
  verdict,
  type TakeawayCard,
} from '@/components/figures/Takeaway';
import { createTrial } from '@/components/figures/Trial';
import { createWorkflow } from '@/components/figures/Workflow';
import { c1Render } from '@/content/act2';
import { GWP_BY_CATEGORY, WORDINGS } from '@/content/c2';
import type { SlidePanel } from './StationScene';

/**
 * Panels for each station, keyed by scene id. Built fresh on every mount
 * because each panel holds its own measured geometry and animation state.
 */

const FAMILY = {
  circularity: '#1a8a6d',
  environmental: '#3060a8',
  performance: '#9c3b6e',
} as const;

const WORTH = {
  origin: '#2b6ca3',
  recovery: '#4f8f3f',
  loss: '#8f5324',
  inference: '#6d4bb0',
} as const;

const c1Takeaway: readonly TakeawayCard[] = [
  {
    tint: FAMILY.circularity,
    name: 'The full profile changes the winner',
    body: 'Plaster wins on cost alone. Timber wins on the full profile.',
    figure: [
      verdict('Cost and compliance', 'Plaster partition', false),
      verdict('Full profile', 'Timber partition', true),
    ],
  },
  {
    tint: FAMILY.environmental,
    name: 'Close calls stay visible',
    body: 'Wood and wool score within a few points of each other.',
    figure: [
      pair([
        ['Wood flooring', 100],
        ['Wool carpet', 93],
      ]),
    ],
  },
  {
    tint: FAMILY.performance,
    name: 'Weighting depends on the project',
    body: 'Priorities differ between projects, so C5 learns them.',
    figure: [
      handoff(
        'C5',
        'The indicators become the recommender’s features.',
      ),
    ],
  },
];

/** C2 findings that the later contributions build on. */
const c2Takeaway: readonly TakeawayCard[] = [
  {
    tint: WORTH.recovery,
    name: 'Terminology needs normalisation',
    body: '“Recycled” means different things to different manufacturers.',
    figure: [aggregate([...WORDINGS])],
  },
  {
    tint: WORTH.origin,
    name: 'Composition predicts impact better than category',
    body: 'GWP varies up to tenfold within one category.',
    figure: [spread([...GWP_BY_CATEGORY], 5)],
  },
  {
    tint: WORTH.loss,
    name: 'Origin and recovery are separate targets',
    body: 'They vary independently, so both must be predicted.',
    figure: [fork('Product', ['Origin', 'Recovery'])],
  },
  {
    tint: WORTH.inference,
    name: 'The corpus trains the later models',
    body: 'Composition correlates with impact and end of life, so missing values can be estimated.',
    figure: [
      stack(['End-of-life pathway prediction', 'GWP estimation', 'Disassembly potential']),
    ],
  },
];

const PANELS: Readonly<Record<string, () => readonly SlidePanel[]>> = {
  c1: () => [createFramework(), createTrial(c1Render), createTakeaway(c1Takeaway)],
  c2: () => [
    createOpening(),
    createCorpus(),
    createLandscape(),
    createParadox(),
    createBurden(),
    createTakeaway(c2Takeaway),
  ],
  c3: () => [
    createContext(),
    createWorkflow(),
    createReconcile(),
    createSort(),
    createHandover(),
  ],
  c4: () => [
    createProfile(),
    createModel(),
    createBudget(),
    createSemantic(),
    createReach(),
  ],
  c5: () => [
    createConverge(),
    createSupervision(),
    createAttention(),
    createValidation(),
    createSalience(),
    createEnables(),
  ],
};

export const panelsFor = (id: string): readonly SlidePanel[] | undefined => PANELS[id]?.();
