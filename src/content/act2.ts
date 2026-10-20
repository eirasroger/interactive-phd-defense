import type { CaptionContent } from '@/components/Caption';
import type { FigureContent } from '@/components/SlideFigure';
import fig4Url from '@/assets/figures/fig4.png?url';
import { ARCHITECTURE_CLAIM, IMPORTANCE_CLAIM, LEARNED_CLAIM, VALIDATION_CLAIM } from '@/content/c5';

/**
 * Act II copy: one slide per contribution, with one caption per beat. Each
 * heading states the contribution's claim.
 */
const slide = (station: string, title: string, heading: string): CaptionContent => ({
  eyebrow: `${station} · ${title}`,
  heading,
});

const c1 = (heading: string): CaptionContent => slide('C1', 'Decision framework', heading);
const c2 = (heading: string): CaptionContent => slide('C2', 'Empirical characterisation', heading);
const c3 = (heading: string): CaptionContent => slide('C3', 'Screening agent', heading);
const c4 = (heading: string): CaptionContent => slide('C4', 'Inference', heading);
const c5 = (heading: string): CaptionContent =>
  slide('C5', 'Context-adaptive recommender', heading);

/** C1 beats. The camera holds one pose, so each beat changes only the wall. */
export const c1Captions: readonly CaptionContent[] = [
  {
    ...c1('At early design, candidate products are compared with each other.'),
  },
  c1('Every alternative is measured on four dimensions.'),
  c1('Tested on two elements of an office refit.'),
  c1('Results with equal weighting.'),
  c1('Changing the priorities changes the ranking.'),
  c1('Key findings'),
];

/** C2 beats: context, method, corpus findings, burden, and implications. */
export const c2Captions: readonly CaptionContent[] = [
  c2('Decision support needs product data at early design.'),
  c2('EPDs hold this data in semi-structured form.'),
  c2('An LLM extracts the data, verified against ground truth.'),
  c2('Landfill dominates end of life. Recovery is mostly recycling.'),
  c2('Circular origin and end-of-life recovery vary independently.'),
  c2('Most impact occurs at the product stage.'),
  c2('Key findings'),
];

/** C3 beats: motivation, workflow, reconciliation rule, case study, and output. */
export const c3Captions: readonly CaptionContent[] = [
  c3('Only compliant products should be recommended.'),
  c3('Screening must be automated and accountable.'),
  c3('An LLM reads the documents. A rule engine decides.'),
  c3('The strictest bound across sources governs.'),
  c3('Six products, screened from the operator’s description.'),
  c3('The same six products, with the structural drawing added.'),
  c3('Output: a compliant candidate set with its reasoning.'),
];

/** C4 beats: motivation, model, results, generalisation, and output. */
export const c4Captions: readonly CaptionContent[] = [
  c4('Product data is often incomplete. Inference fills the gaps.'),
  c4('Material composition is embedded as a vector.'),
  c4('Autoencoder and predictor are trained together.'),
  c4('Consistently declared pathways are predicted well.'),
  c4('Unseen materials are predicted from similar ones.'),
  c4('Key findings'),
];

/** C5 beats. C1 to C4 feed this station. Claims are shared with `c5.ts`. */
export const c5Captions: readonly CaptionContent[] = [
  c5('The recommendation depends on evidence, priorities and application.'),
  c5(LEARNED_CLAIM),
  c5(ARCHITECTURE_CLAIM),
  c5(VALIDATION_CLAIM),
  c5(IMPORTANCE_CLAIM),
  c5('Key findings'),
];

export const act2Captions = {
  c1: c1Captions[0] as CaptionContent,
  c2: c2Captions[0] as CaptionContent,
  c3: c3Captions[0] as CaptionContent,
  c4: c4Captions[0] as CaptionContent,
  c5: c5Captions[0] as CaptionContent,
} satisfies Record<string, CaptionContent>;

/** Beat captions per station. */
export const act2Beats: Partial<Record<keyof typeof act2Captions, readonly CaptionContent[]>> = {
  c1: c1Captions,
  c2: c2Captions,
  c3: c3Captions,
  c4: c4Captions,
  c5: c5Captions,
};

export const act2Figures: Partial<Record<keyof typeof act2Captions, readonly FigureContent[]>> = {};

/** The paper's Fig. 5: BIM model with partitions in orange and flooring in blue. */
export const c1Render = {
  src: fig4Url,
  alt: 'Third floor of the case study office building, with the evaluated partitions and flooring highlighted.',
};
