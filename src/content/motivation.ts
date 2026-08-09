import type { RateTrackSpec } from '@/components/figures/RateTrack';
import type { StatLedgerSpec } from '@/components/figures/StatLedger';

/**
 * Scene 2 — motivation and research context.
 *
 * Source: thesis ch. *Motivation and research context*, first two paragraphs.
 * The rest of the chapter — circularity's conditions, the leverage of early
 * design, the inadequacy of the tools — belongs to scenes 4 to 7.
 *
 * Everything here is a number or a consequence of one. The prose argument is
 * what the presenter says; the screen carries the evidence.
 */
export const MOTIVATION = {
  eyebrow: 'Motivation · Research context',

  /** Two fragments: the contradiction is the sentence structure. */
  heading: 'One of Europe’s largest industries. One of its most destructive.',

  /** One figure against two. The split is the claim. */
  burden: {
    groups: [
      {
        label: 'Economic weight',
        stats: [
          {
            value: 9,
            unit: '%',
            label: 'of European Union gross domestic product',
            accent: 'ai',
          },
        ],
      },
      {
        label: 'Environmental burden',
        stats: [
          {
            value: 50,
            unit: '%',
            label: 'of all materials extracted globally',
            accent: 'emphasis',
          },
          {
            value: 35,
            unit: '%',
            label: 'of total greenhouse gas emissions',
            accent: 'emphasis',
          },
        ],
      },
    ],
    source: 'European Commission, 2026',
  } satisfies StatLedgerSpec,

  /**
   * Scale tops out at 30, not 100: on a full axis both marks collapse into the
   * first third and the shortfall becomes a sliver.
   */
  target: {
    title: 'Circular material use rate · European Union',
    max: 30,
    unit: '%',
    current: { value: 11.7, caption: 'today' },
    target: { value: 23.4, caption: '2030 target' },
    delta: 'must double in four years',
    source: 'Circular Economy Action Plan, 2020 · IEEP, 2025',
  } satisfies RateTrackSpec,
} as const;
