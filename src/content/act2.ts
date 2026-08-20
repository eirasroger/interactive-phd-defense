import type { CaptionContent } from '@/components/Caption';
import type { FigureContent } from '@/components/SlideFigure';
import fig4Url from '@/assets/figures/fig4.png?url';
import {
  APPLICATION_CLAIM,
  LEARNED_CLAIM,
  RELATIONAL,
  STAKEHOLDER_CLAIM,
} from '@/content/c5';

/**
 * Act II copy: one slide per contribution.
 *
 * `narrative.md` breaks each station into three or four beats. C1 and C2 are
 * built; the rest are still one slide carrying their claim, and come back one
 * at a time as their content gets written.
 *
 * Headings are the claim column. They are the argument and they are settled.
 */
const slide = (station: string, title: string, heading: string): CaptionContent => ({
  eyebrow: `Act II · ${station} · ${title}`,
  heading,
});

const c1 = (heading: string): CaptionContent => slide('C1', 'Decision framework', heading);
const c2 = (heading: string): CaptionContent => slide('C2', 'Empirical characterisation', heading);
const c3 = (heading: string): CaptionContent => slide('C3', 'Screening agent', heading);
const c4 = (heading: string): CaptionContent => slide('C4', 'Inference', heading);
const c5 = (heading: string): CaptionContent =>
  slide('C5', 'Context-adaptive recommender', heading);

/**
 * Six beats over one held pose. The camera stays where it landed, so each of
 * these is a change on the wall.
 */
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

/**
 * Seven beats over one held pose. The contribution is contextualised, the
 * method and its scale are established, the corpus is read, the paradox inside
 * that reading is opened, the burden is located, and what all of it hands on is
 * stated.
 */
export const c2Captions: readonly CaptionContent[] = [
  c2('Decision support has to work with the information available at the early design stage.'),
  c2('Environmental Product Declarations carry the required data in partially structured form.'),
  c2('A large language model is probabilistic, so its extraction is verified against ground truth.'),
  c2('Landfilling dominates declared end-of-life pathways, and recovery is almost entirely recycling.'),
  c2('Circular origin and end-of-life recovery vary independently across product categories.'),
  c2('Impacts are concentrated in the product stage and only partially offset by module D.'),
  c2('Implications for the contributions that follow.'),
];

/**
 * Seven beats over one held pose. Two establish why the stage exists and why it
 * cannot be fully automated, one states the workflow, one the reconciliation
 * rule, two run the case study, and the last states what the station produces.
 */
export const c3Captions: readonly CaptionContent[] = [
  c3('A recommendation is only meaningful over candidates that are already admissible.'),
  c3('Screening at portfolio scale requires automation, and a regulatory verdict requires accountability.'),
  c3('A language model reads the documents, and a rule engine issues the verdict.'),
  c3('Every source proposes a bound, and the strictest one governs.'),
  c3('Six products, screened against the operator’s description of the application.'),
  c3('The same six products, screened once the structural drawing has been read.'),
  c3('The screening produces a candidate set with its reasoning attached.'),
];

/**
 * Six beats over one held pose. One establishes why the station exists and what
 * it reads, two build the model, one reports what it achieves, one shows what
 * the representation generalises over, and the last states what it produces.
 */
export const c4Captions: readonly CaptionContent[] = [
  c4('Information on construction products is not always complete, and inference prevents the recommendation from degrading.'),
  c4('A declared composition becomes a vector through a semantic embedding.'),
  c4('The autoencoder and the predictor are trained together as one model.'),
  c4('The model predicts the pathways that manufacturers declare consistently.'),
  c4('A material the model has never seen is predicted like the materials it resembles.'),
  c4('What this contribution settles.'),
];

/**
 * Eleven beats over one held pose, the longest station in the corridor and the
 * one the other four feed. One states what the preceding contributions supply
 * and what the remaining step demands, two build the model, three are the
 * relational claim drawn as one movement, one is the expert check, two separate
 * the influence of the stakeholder from the influence of the application, one
 * reads the model's own attributions, and the last states what the contribution
 * settles.
 */
export const c5Captions: readonly CaptionContent[] = [
  c5(
    'The recommendation depends on the product evidence, on stakeholder priorities, and on the intended application.',
  ),
  c5(LEARNED_CLAIM),
  c5('Candidates are scored together, so the order never depends on how they arrived.'),
  c5(RELATIONAL.pair),
  c5(RELATIONAL.trio),
  c5(RELATIONAL.quartet),
  c5('Six experts ranked thirty-two scenarios, and the model reached their order.'),
  c5(STAKEHOLDER_CLAIM),
  c5(APPLICATION_CLAIM),
  c5('Feature importance reorganises with the context the model is given.'),
  c5('What this contribution settles.'),
];

export const act2Captions = {
  c1: c1Captions[0] as CaptionContent,
  c2: c2Captions[0] as CaptionContent,
  c3: c3Captions[0] as CaptionContent,
  c4: c4Captions[0] as CaptionContent,
  c5: c5Captions[0] as CaptionContent,
} satisfies Record<string, CaptionContent>;

/** Beat captions for the stations whose beats are built. */
export const act2Beats: Partial<Record<keyof typeof act2Captions, readonly CaptionContent[]>> = {
  c1: c1Captions,
  c2: c2Captions,
  c3: c3Captions,
  c4: c4Captions,
  c5: c5Captions,
};

export const act2Figures: Partial<Record<keyof typeof act2Captions, readonly FigureContent[]>> = {};

/** The paper's Fig. 5: orange partitions, blue flooring, on the BIM model. */
export const c1Render = {
  src: fig4Url,
  alt: 'Third floor of the case study office building, with the evaluated partitions and flooring highlighted.',
};
