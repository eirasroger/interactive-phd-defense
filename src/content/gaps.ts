import type { GapCardsSpec } from '@/components/figures/GapCards';

/**
 * Scene 9: the six research gaps. All six numbered cards show from the start
 * and fill one at a time.
 *
 * Titles and descriptions are verbatim from the thesis, except gap 01's body,
 * which names the dimensions so it does not overlap gaps 03 and 05.
 *
 * Cards have no fixed accent colour. The accent follows the gap being discussed.
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
