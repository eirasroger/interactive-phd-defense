import type { GapCardsSpec } from '@/components/figures/GapCards';

/**
 * Scene 9: the six research gaps. All six numbered cards show from the start
 * and fill one at a time.
 *
 * Titles and descriptions are shortened from the thesis.
 *
 * Cards have no fixed accent colour. The accent follows the gap being discussed.
 */

export const GAPS = {
  eyebrow: 'Research gaps',
  heading: 'Six research gaps',

  cards: {
    items: [
      {
        key: '01',
        title: 'Multi-criteria prioritisation',
        body: 'Cost, impact, circularity and performance are assessed separately.',
      },
      {
        key: '02',
        title: 'Circularity integration',
        body: 'Circularity is left out of product selection.',
      },
      {
        key: '03',
        title: 'Heterogeneous and missing data',
        body: 'Product data is fragmented and incomplete.',
      },
      {
        key: '04',
        title: 'Automated compliance prefiltering',
        body: 'Compliance is checked late and by hand.',
      },
      {
        key: '05',
        title: 'Context-aware recommendation',
        body: 'Current models overlook context and missing data.',
      },
      {
        key: '06',
        title: 'End-to-end workflow',
        body: 'The steps from data to ranking are disconnected.',
      },
    ],
  } satisfies GapCardsSpec,
} as const;
