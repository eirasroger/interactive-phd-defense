import type { StandingIcon } from '@/content/act3';

/**
 * The seven marks of the closing frame.
 *
 * **One construction, seven drawings.** Same 64-unit grid, same optical box,
 * same round caps and joins as `objectiveIcons`, which is the whole difference
 * between a set and seven pictures that happen to share a slide. The stroke is
 * heavier here only because these are drawn at half the size of the objective
 * marks, and a weight that is correct at 84px is a hairline at 52.
 *
 * **Each mark draws the mechanism, not a symbol for the subject.** A factory for
 * *manufacturers*, a scales for *regulators*, a lightbulb for *contribution*
 * would be seven stock glyphs, and a committee reads stock glyphs as
 * decoration. A declaration with one field dashed and one field short *is* the
 * inconsistency manufacturers are being pointed at; a rule with five candidates
 * over it and two through it *is* compliance taken before preference.
 *
 * **Two of them are borrowed on purpose.** The regulator mark is the gate from
 * O3 and the manufacturer mark is the front sheet from O2, both unchanged. By
 * the closing frame the audience has been shown each of them twice, and a mark
 * they already know is read rather than decoded.
 *
 * Element roles, as `objectiveIcons` establishes them: `icon-stroke` is drawn
 * on and must never carry a pattern of its own, `icon-dash` means something is
 * absent and is revealed by opacity, `icon-dot` scales up once the lines it
 * sits on exist, and `icon-faint` is scaffolding that is present without
 * competing.
 *
 * `life-*` marks the one element in a mark that keeps moving after the frame
 * has settled. Four of the seven carry one. They are CSS animations rather than
 * timeline tweens, so nothing has to be started, stopped or torn down with the
 * scene, and none of them touches a property the entry animation writes.
 */

const BOX = { min: 8, max: 56, mid: 32 } as const;

const dot = (cx: number, cy: number, r = 3.2, extra = ''): string =>
  `<circle class="icon-dot${extra ? ` ${extra}` : ''}" cx="${cx}" cy="${cy}" r="${r}" />`;

/**
 * Relative comparison.
 *
 * Four candidates measured on one baseline, and nothing marked as the winner.
 * The claim is that comparison across the set is itself the evaluation, so a
 * mark that crowned one of them would be drawing the recommendation instead.
 * Uneven heights, because an even set says the criteria are already reconciled.
 */
const comparison = `
  <line class="icon-stroke icon-faint" x1="${BOX.min}" y1="50" x2="${BOX.max}" y2="50" />
  <line class="icon-stroke" x1="15" y1="50" x2="15" y2="30" />
  <line class="icon-stroke" x1="26" y1="50" x2="26" y2="19" />
  <line class="icon-stroke" x1="37" y1="50" x2="37" y2="37" />
  <line class="icon-stroke" x1="48" y1="50" x2="48" y2="25" />
  ${dot(15, 30)}${dot(26, 19)}${dot(37, 37)}${dot(48, 25)}
`;

/**
 * Context carried into the recommendation.
 *
 * A ranked set, and a marker that does not stay where it started. The order is
 * drawn once and the marker travels between the first and the third of them on
 * a long loop, which is the claim: the same candidates, a different context, a
 * different recommendation. It is the only mark on the frame that keeps saying
 * something after it has arrived, and it is the one whose subject is change.
 */
const context = `
  <line class="icon-stroke" x1="26" y1="16" x2="54" y2="16" />
  <line class="icon-stroke" x1="26" y1="32" x2="47" y2="32" />
  <line class="icon-stroke" x1="26" y1="48" x2="39" y2="48" />
  ${dot(14, 16, 4, 'life-travel')}
`;

/**
 * Evaluation under incomplete evidence.
 *
 * A field of values with holes in it. Six are declared, three are not, and the
 * absences are drawn in the dash the candidate set and the declaration have
 * used since Act I. The centre absence carries a value that is present and
 * uncertain, which is inference: the hole is not filled and it is not empty.
 */
const partial = `
  ${dot(16, 22, 3.6)}${dot(32, 22, 3.6)}
  ${dot(32, 44, 3.6)}${dot(48, 44, 3.6)}
  <circle class="icon-dash life-dash" cx="48" cy="22" r="6" />
  <circle class="icon-dash life-dash" cx="16" cy="44" r="6" />
  ${dot(48, 22, 2.6, 'life-fill')}
`;

/**
 * The decision, taken where it still has leverage.
 *
 * A project line, a point early on it, and alternatives opening out of that
 * point with one of them carried. The whole practical claim for design and
 * procurement is that this comparison can now happen here, so the mark is about
 * where on the line the fan sits rather than about what is being compared.
 */
const earlier = `
  <line class="icon-stroke icon-faint" x1="${BOX.min}" y1="52" x2="${BOX.max}" y2="52" />
  <line class="icon-stroke" x1="15" y1="52" x2="52" y2="14" />
  <line class="icon-stroke" x1="15" y1="52" x2="52" y2="30" />
  <line class="icon-stroke" x1="15" y1="52" x2="52" y2="46" />
  ${dot(15, 52, 3.8)}
  ${dot(52, 14, 3.6)}
`;

/**
 * What a declaration reports, and how evenly.
 *
 * O2's front sheet, unchanged: one field complete, one absent, one short, one
 * complete. The manufacturer implication is exactly this picture read as an
 * instruction, and the audience has already been given the picture twice.
 */
const declaration = `
  <rect class="icon-stroke" x="14" y="10" width="36" height="44" rx="3" />
  <line class="icon-stroke" x1="21" y1="24" x2="43" y2="24" />
  <line class="icon-dash life-dash" x1="21" y1="32" x2="43" y2="32" />
  <line class="icon-stroke" x1="21" y1="40" x2="33" y2="40" />
  <line class="icon-stroke" x1="21" y1="48" x2="40" y2="48" />
`;

/**
 * Coverage across the corpus, and the audit that measures it.
 *
 * A profile with one field reported by nearly everything and the next by almost
 * nothing is what the corpus analysis found, and it is what the programme
 * operators are being handed. The sweep is the instrument rather than the
 * finding: it says this is measurable at scale, which is the implication.
 */
const coverage = `
  <line class="icon-stroke icon-faint" x1="${BOX.min}" y1="50" x2="${BOX.max}" y2="50" />
  <line class="icon-stroke" x1="13" y1="50" x2="13" y2="22" />
  <line class="icon-stroke" x1="21" y1="50" x2="21" y2="34" />
  <line class="icon-stroke" x1="29" y1="50" x2="29" y2="16" />
  <line class="icon-stroke" x1="37" y1="50" x2="37" y2="40" />
  <line class="icon-stroke" x1="45" y1="50" x2="45" y2="26" />
  <line class="icon-stroke" x1="53" y1="50" x2="53" y2="44" />
  <line class="icon-stroke icon-faint life-sweep" x1="11" y1="12" x2="11" y2="54" />
`;

/**
 * Compliance as a threshold taken before anything is ranked.
 *
 * O3's gate, unchanged. Five candidates over the rule, two through it, and the
 * rule is the same device compliance has been drawn on since Act I.
 */
const threshold = `
  ${[13, 22.5, 32, 41.5, 51].map((x) => dot(x, 13, 2.8)).join('')}
  <line class="icon-stroke" x1="${BOX.min}" y1="32" x2="${BOX.max}" y2="32" />
  <line class="icon-stroke" x1="26" y1="35" x2="26" y2="45" />
  <line class="icon-stroke" x1="38" y1="35" x2="38" y2="45" />
  ${dot(26, 52, 3.4)}${dot(38, 52, 3.4)}
`;

const MARKS: Record<StandingIcon, string> = {
  comparison,
  context,
  partial,
  earlier,
  declaration,
  coverage,
  threshold,
};

export const standingIcon = (name: StandingIcon): string =>
  `<svg class="std-icon" viewBox="0 0 64 64" aria-hidden="true">${MARKS[name]}</svg>`;
