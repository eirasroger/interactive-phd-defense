import { createBudget } from '@/components/figures/Budget';
import { createBurden } from '@/components/figures/Burden';
import { createCorpus } from '@/components/figures/Corpus';
import { createFramework } from '@/components/figures/Framework';
import { createLandscape } from '@/components/figures/Landscape';
import { createModel } from '@/components/figures/Model';
import { createOpening } from '@/components/figures/Opening';
import { createParadox } from '@/components/figures/Paradox';
import { createContext } from '@/components/figures/Context';
import { createHandover } from '@/components/figures/Handover';
import { createReach } from '@/components/figures/Reach';
import { createSemantic } from '@/components/figures/Semantic';
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
 * What each station puts on its wall.
 *
 * Panels are built per mount rather than shared, because a panel holds measured
 * geometry and animation state for one live composition. The registry is keyed
 * by scene id so `index.ts` composes a station without knowing what is in it.
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
    name: 'It overturns a cost-led default',
    body: 'Plaster is cheaper on the day it is bought and clears every threshold, so conventional selection stops there. Counting disassembly, reuse and end of life reverses the answer.',
    figure: [
      verdict('Cost and compliance', 'Plaster partition', false),
      verdict('Full profile', 'Timber partition', true),
    ],
  },
  {
    tint: FAMILY.environmental,
    name: 'It reports a close call as a close call',
    body: 'Wood and wool sit within a few points of each other, trading water against embodied carbon. The framework hands over an evidence base and leaves budget, context and availability to decide.',
    figure: [
      pair([
        ['Wood flooring', 100],
        ['Wool carpet', 93],
      ]),
    ],
  },
  {
    tint: FAMILY.performance,
    name: 'It leaves the weighting open on purpose',
    body: 'Fixed weights would impose one project’s priorities on every other. Eliciting priorities in a repeatable, auditable way is a design problem in its own right.',
    figure: [
      handoff(
        'C5',
        'The indicator set becomes the feature space the recommender learns preferences over.',
      ),
    ],
  },
];

/**
 * What C2 establishes for the contributions that follow.
 *
 * Each card has to change something downstream. The selective-reporting and
 * service-life findings are real, and they were on the wall until it became
 * clear neither of them tells a model what to do; both are now spoken instead.
 */
const c2Takeaway: readonly TakeawayCard[] = [
  {
    tint: WORTH.recovery,
    name: 'Declared terminology requires normalisation',
    body: 'Manufacturers use “recycled” for production offcuts returned to the line, for components removed and refitted, and for reprocessing into new feedstock. Extraction labels are therefore defined by the material outcome, not by the declared wording.',
    figure: [aggregate([...WORDINGS])],
  },
  {
    tint: WORTH.origin,
    name: 'Material composition predicts impact better than product category',
    body: 'Median and mean product-stage GWP differ by up to an order of magnitude within a single category, with timber-based products at the lower end. Product category alone is insufficient as a feature for downstream models.',
    figure: [spread([...GWP_BY_CATEGORY], 5)],
  },
  {
    tint: WORTH.loss,
    name: 'Circular origin and end-of-life recovery are separate targets',
    body: 'The two vary independently, and the degree of divergence depends on product category. Any model predicting circularity has to predict both, and cannot derive one from the other.',
    figure: [fork('Product record', ['Circular origin', 'End-of-life recovery'])],
  },
  {
    tint: WORTH.inference,
    name: 'The structured corpus is a training basis for supporting models',
    body: 'Material composition correlates strongly with both impact and end-of-life outcome across the corpus. Where a declaration is incomplete, that relationship can be used to estimate the missing quantity and hold the comparison on the full indicator set.',
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
};

export const panelsFor = (id: string): readonly SlidePanel[] | undefined => PANELS[id]?.();
