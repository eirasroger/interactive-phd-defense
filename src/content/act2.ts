import type { CaptionContent } from '@/components/Caption';
import type { FigureContent } from '@/components/SlideFigure';
import fig4Url from '@/assets/figures/fig4.png?url';
import { ARCHITECTURE_CLAIM, LEARNED_CLAIM, VALIDATION_CLAIM } from '@/content/c5';

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
    ...c1('The early design decision is a comparison between alternatives.'),
    body: [
      'Absolute impact figures are calibrated for certification, and they arrive once a design is settled. While the design is still moving, the useful operation is placing candidates against each other, and relative comparison holds on whatever evidence is consistent across them.',
    ],
  },
  c1('Every alternative is measured across the same four dimensions.'),
  c1('The framework was tested on two elements of a working office refit.'),
  c1('Relative comparison across environmental, circularity, economic and performance dimensions.'),
  c1('Context and priorities change what the framework recommends.'),
  c1('What the framework settles, and what it hands on.'),
];

/** C2 beats: context, method, corpus findings, burden, and implications. */
export const c2Captions: readonly CaptionContent[] = [
  c2('Decision support has to work with the information available at the early design stage.'),
  c2('Environmental Product Declarations carry the required data in partially structured form.'),
  c2('A large language model is probabilistic, so its extraction is verified against ground truth.'),
  c2('Landfilling dominates declared end-of-life pathways, and recovery is almost entirely recycling.'),
  c2('Circular origin and end-of-life recovery vary independently across product categories.'),
  c2('Impacts are concentrated in the product stage and only partially offset by module D.'),
  c2('Implications for the contributions that follow.'),
];

/** C3 beats: motivation, workflow, reconciliation rule, case study, and output. */
export const c3Captions: readonly CaptionContent[] = [
  c3('A recommendation is only meaningful over candidates that are already admissible.'),
  c3('Screening at portfolio scale requires automation, and a regulatory verdict requires accountability.'),
  c3('A language model reads the documents, and a rule engine issues the verdict.'),
  c3('Every source proposes a bound, and the strictest one governs.'),
  c3('Six products, screened against the operator’s description of the application.'),
  c3('The same six products, screened once the structural drawing has been read.'),
  c3('The screening produces a candidate set with its reasoning attached.'),
];

/** C4 beats: motivation, model, results, generalisation, and output. */
export const c4Captions: readonly CaptionContent[] = [
  c4('Information on construction products is not always complete, and inference prevents the recommendation from degrading.'),
  c4('A declared composition becomes a vector through a semantic embedding.'),
  c4('The autoencoder and the predictor are trained together as one model.'),
  c4('The model predicts the pathways that manufacturers declare consistently.'),
  c4('A material the model has never seen is predicted like the materials it resembles.'),
  c4('What this contribution settles.'),
];

/** C5 beats. C1 to C4 feed this station. Claims are shared with `c5.ts`. */
export const c5Captions: readonly CaptionContent[] = [
  c5(
    'The recommendation depends on the product evidence, on stakeholder priorities, and on the intended application.',
  ),
  c5(LEARNED_CLAIM),
  c5(ARCHITECTURE_CLAIM),
  c5(VALIDATION_CLAIM),
  c5(
    'The recommendation accounts for the whole product, adapts to the context, and holds under uncertainty.',
  ),
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
