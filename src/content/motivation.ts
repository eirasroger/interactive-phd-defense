import type { MagnitudeSpec } from '@/components/figures/Magnitude';
import type { RateTrackSpec } from '@/components/figures/RateTrack';

/**
 * Scene 2 — motivation and research context.
 *
 * Source: thesis ch. *Motivation and research context*, first two paragraphs.
 * The rest of the chapter — circularity's conditions, the leverage of early
 * design, the inadequacy of the tools — belongs to scenes 3 to 9.
 *
 * Everything here is a number or a consequence of one. The prose argument is
 * what the presenter says; the screen carries the evidence.
 *
 * **Two beats, and the first is the whole contradiction.** Landing the economic
 * share and the environmental one on separate clicks made a beat out of a
 * comparison: the two halves only mean anything against each other, and the
 * figure races them precisely so they are read at the same time. The click is
 * spent on the turn instead — what the response to this actually is.
 */
export const MOTIVATION = {
  eyebrow: 'Motivation · Research context',

  /** Two fragments: the contradiction is the sentence structure. */
  heading: 'One of Europe’s largest industries. One of its most destructive.',

  source: 'European Commission, 2026 · Circular Economy Action Plan, 2020 · IEEP, 2025',

  /**
   * One figure above the rule and two below, each drawn as a hundred cells.
   *
   * The three used to be standalone numerals in a ledger, which states them and
   * leaves the contradiction to be asserted in words. Counted out of a hundred
   * the economic share is nine lit cells beside fifty, and the claim in the
   * heading is a shape on the screen before it is a sentence.
   *
   * Each field names its own denominator, and the fields are shares of their
   * own whole rather than of one shared total. Three measures over three
   * different populations may be counted against a common hundred; asserting a
   * conversion between them is what would be false — `learnings.md` §31e.
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

  /** Named on the section it stands in, so the figure does not repeat it. */
  targetLabel: 'Circular material use rate · European Union',

  /**
   * Scale tops out at 30, not 100: on a full axis both marks collapse into the
   * first third and the shortfall becomes a sliver.
   */
  target: {
    max: 30,
    unit: '%',
    current: { value: 11.7, caption: 'today' },
    target: { value: 23.4, caption: '2030 target' },
    delta: 'must double in four years',
  } satisfies RateTrackSpec,
} as const;
