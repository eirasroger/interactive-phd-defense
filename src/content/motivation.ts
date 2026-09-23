import type { MagnitudeSpec } from '@/components/figures/Magnitude';
import type { RateTrackSpec } from '@/components/figures/RateTrack';

/**
 * Scene 2: motivation and research context. Source: thesis chapter
 * "Motivation and research context", first two paragraphs.
 * Two beats: the economic and environmental shares together, then the response.
 */
export const MOTIVATION = {
  eyebrow: 'Motivation · Research context',

  /** Two fragments that state the contradiction. */
  heading: 'One of Europe’s largest industries. One of its most destructive.',

  source: 'European Commission, 2026 · Circular Economy Action Plan, 2020 · IEEP, 2025',

  /**
   * One figure above the rule and two below, each drawn as 100 cells. Each
   * field is a share of its own whole, named in its label (`learnings.md` §31e).
   */
  magnitude: {
    unit: '%',
    groups: [
      {
        label: 'Economic weight',
        fields: [
          { label: 'of European Union gross domestic product', value: 9, accent: 'ai' },
        ],
      },
      {
        label: 'Environmental impact',
        fields: [
          { label: 'of all materials extracted globally', value: 50, accent: 'emphasis' },
          { label: 'of total greenhouse gas emissions', value: 35, accent: 'emphasis' },
        ],
      },
    ],
  } satisfies MagnitudeSpec,

  /** Section label, so the figure omits it. */
  targetLabel: 'Circular material use rate · European Union',

  /** Scale tops out at 30 so the gap between the two marks stays visible. */
  target: {
    max: 30,
    unit: '%',
    current: { value: 11.7, caption: 'today' },
    target: { value: 23.4, caption: '2030 target' },
    delta: 'must double in four years',
  } satisfies RateTrackSpec,
} as const;
