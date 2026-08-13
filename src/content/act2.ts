import type { CaptionContent } from '@/components/Caption';

/**
 * Act II copy: one slide per contribution.
 *
 * `narrative.md` breaks each station into three or four beats, and those beats
 * are real — but a beat whose body is `Placeholder.` is not a slide, it is a
 * click that shows nothing. They come back one at a time as their content gets
 * written, and until then a station is one slide carrying its claim.
 *
 * Headings are the claim column verbatim. They are the argument and they are
 * settled.
 */
const slide = (station: string, title: string, heading: string): CaptionContent => ({
  eyebrow: `Act II · ${station} · ${title}`,
  heading,
});

export const act2Captions = {
  c1: slide(
    'C1',
    'Decision framework',
    'Relative comparison across environmental, circularity, economic and performance dimensions.',
  ),
  c2: slide(
    'C2',
    'Empirical characterisation',
    'Heterogeneous, inconsistent, incomplete — measured, not assumed.',
  ),
  c3: slide(
    'C3',
    'Screening agent',
    'Feasibility and preference are different operations.',
  ),
  c4: slide(
    'C4',
    'Inference',
    'Declared data is absent exactly where it matters.',
  ),
  c5: slide(
    'C5',
    'Context-adaptive recommender',
    'The ranking depends on the composition of the candidate set.',
  ),
} satisfies Record<string, CaptionContent>;
