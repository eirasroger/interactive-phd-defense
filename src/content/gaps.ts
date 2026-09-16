import type { GapCardsSpec } from '@/components/figures/GapCards';

/**
 * Scene 9 — the six research gaps.
 *
 * Six cards, one per gap, filled one at a time. The six frames stand from the
 * first frame with only their numbers in them, so the count is established
 * before the first is spoken and the audience is never wondering how many are
 * coming.
 *
 * **The text is the thesis's own wording and is not to be paraphrased here.**
 * Titles are verbatim, and so is every description but the first.
 *
 * Gap 01's description is the one deliberate departure. The thesis phrases it as
 * comparison under incomplete and uncertain information, which is true and is
 * also what gaps 03 and 05 are each about, so on a slide the three read as one
 * gap stated three times. What is missing at 01 is that the dimensions are never
 * brought together in a single comparison, so the description names them. The
 * uncertainty half of the thesis wording is carried by 03 and 05, where it is
 * the subject rather than a qualifier.
 *
 * **No gap carries an accent of its own.** An earlier pass tinted circularity
 * green, the ML gap blue and integration amber, on the reasoning that each
 * should recall the stream it came from. On screen it read as a ranking — three
 * gaps lit and three not — which is a claim the thesis does not make. Colour now
 * belongs to the moment rather than to the card: whichever gap is being spoken
 * about carries it, and hands it on.
 */

export const GAPS = {
  eyebrow: 'Research gaps',
  heading: 'Six research gaps.',

  cards: {
    items: [
      {
        key: '01',
        title: 'Product-level multi-criteria prioritisation',
        body: 'Cost, environmental impact, circularity, performance and fit to context are not weighed together.',
      },
      {
        key: '02',
        title: 'Systematic integration of circularity',
        body: 'Circular origin, disassembly, recovery, and end-of-life are not embedded in product selection.',
      },
      {
        key: '03',
        title: 'Heterogeneous and missing product data',
        body: 'Product information is fragmented, inconsistent, unstructured, and incomplete.',
      },
      {
        key: '04',
        title: 'Compliance-first automated prefiltering',
        body: 'Product compliance is checked too late and is rarely automated at product level.',
      },
      {
        key: '05',
        title: 'Context-aware ML recommendation',
        body: 'Existing models do not adequately handle context, candidate-set relationships, preferences, or missing evidence.',
      },
      {
        key: '06',
        title: 'Integrated end-to-end workflow',
        body: 'Data extraction, compliance, circularity, uncertainty, and product ranking remain disconnected.',
      },
    ],
  } satisfies GapCardsSpec,
} as const;
