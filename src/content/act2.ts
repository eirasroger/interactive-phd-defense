import type { CaptionContent } from '@/components/Caption';
import type { FigureContent } from '@/components/SlideFigure';
import fig4Url from '@/assets/figures/fig4.png?url';

/**
 * Act II copy: one slide per contribution.
 *
 * `narrative.md` breaks each station into three or four beats. C1's are built;
 * the rest are still one slide carrying their claim, and come back one at a
 * time as their content gets written.
 *
 * Headings are the claim column verbatim. They are the argument and they are
 * settled.
 */
const slide = (station: string, title: string, heading: string): CaptionContent => ({
  eyebrow: `Act II · ${station} · ${title}`,
  heading,
});

const c1 = (heading: string): CaptionContent => slide('C1', 'Decision framework', heading);

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

export const act2Captions = {
  c1: c1Captions[0] as CaptionContent,
  c2: slide(
    'C2',
    'Empirical characterisation',
    'Heterogeneous, inconsistent, incomplete — measured, not assumed.',
  ),
  c3: slide('C3', 'Screening agent', 'Feasibility and preference are different operations.'),
  c4: slide('C4', 'Inference', 'Declared data is absent exactly where it matters.'),
  c5: slide(
    'C5',
    'Context-adaptive recommender',
    'The ranking depends on the composition of the candidate set.',
  ),
} satisfies Record<string, CaptionContent>;

export const act2Figures: Partial<Record<keyof typeof act2Captions, readonly FigureContent[]>> = {};

/** The paper's Fig. 5: orange partitions, blue flooring, on the BIM model. */
export const c1Render = {
  src: fig4Url,
  alt: 'Third floor of the case study office building, with the evaluated partitions and flooring highlighted.',
};
