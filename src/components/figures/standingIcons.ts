import type { StandingIcon } from '@/content/act3';

/**
 * The seven marks of the closing frame. Same 64-unit grid, box and caps as
 * `objectiveIcons`; the stroke is heavier because these draw at half the size.
 * The regulator and manufacturer marks reuse the O3 gate and O2 front sheet.
 *
 * Element roles match `objectiveIcons`: `icon-stroke` is drawn on, `icon-dash`
 * marks an absence and fades in, `icon-dot` scales up last, `icon-faint` is
 * scaffolding. `life-*` is a looping CSS animation that runs after the frame
 * settles and never touches a property the entry animation writes.
 */

const BOX = { min: 8, max: 56, mid: 32 } as const;

const dot = (cx: number, cy: number, r = 3.2, extra = ''): string =>
  `<circle class="icon-dot${extra ? ` ${extra}` : ''}" cx="${cx}" cy="${cy}" r="${r}" />`;

/** Relative comparison: four uneven bars on one baseline, no winner marked. */
const comparison = `
  <line class="icon-stroke icon-faint" x1="${BOX.min}" y1="50" x2="${BOX.max}" y2="50" />
  <line class="icon-stroke" x1="15" y1="50" x2="15" y2="30" />
  <line class="icon-stroke" x1="26" y1="50" x2="26" y2="19" />
  <line class="icon-stroke" x1="37" y1="50" x2="37" y2="37" />
  <line class="icon-stroke" x1="48" y1="50" x2="48" y2="25" />
  ${dot(15, 30)}${dot(26, 19)}${dot(37, 37)}${dot(48, 25)}
`;

/**
 * Context: a ranked list with a marker that loops between the first and third
 * rows. Same candidates, different context, different recommendation.
 */
const context = `
  <line class="icon-stroke" x1="26" y1="16" x2="54" y2="16" />
  <line class="icon-stroke" x1="26" y1="32" x2="47" y2="32" />
  <line class="icon-stroke" x1="26" y1="48" x2="39" y2="48" />
  ${dot(14, 16, 4, 'life-travel')}
`;

/**
 * Incomplete evidence: declared values as dots, missing ones as dashed rings.
 * One ring holds a small dot for an inferred value.
 */
const partial = `
  ${dot(16, 22, 3.6)}${dot(32, 22, 3.6)}
  ${dot(32, 44, 3.6)}${dot(48, 44, 3.6)}
  <circle class="icon-dash life-dash" cx="48" cy="22" r="6" />
  <circle class="icon-dash life-dash" cx="16" cy="44" r="6" />
  ${dot(48, 22, 2.6, 'life-fill')}
`;

/**
 * Earlier decisions: alternatives fanning out from an early point on the
 * project line, with one of them carried.
 */
const earlier = `
  <line class="icon-stroke icon-faint" x1="${BOX.min}" y1="52" x2="${BOX.max}" y2="52" />
  <line class="icon-stroke" x1="15" y1="52" x2="52" y2="14" />
  <line class="icon-stroke" x1="15" y1="52" x2="52" y2="30" />
  <line class="icon-stroke" x1="15" y1="52" x2="52" y2="46" />
  ${dot(15, 52, 3.8)}
  ${dot(52, 14, 3.6)}
`;

/** Declaration quality: O2's front sheet, with one field absent and one short. */
const declaration = `
  <rect class="icon-stroke" x="14" y="10" width="36" height="44" rx="3" />
  <line class="icon-stroke" x1="21" y1="24" x2="43" y2="24" />
  <line class="icon-dash life-dash" x1="21" y1="32" x2="43" y2="32" />
  <line class="icon-stroke" x1="21" y1="40" x2="33" y2="40" />
  <line class="icon-stroke" x1="21" y1="48" x2="40" y2="48" />
`;

/**
 * Corpus coverage: uneven per-field reporting bars, with a sweeping line for
 * the audit that measures them.
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

/** Compliance threshold: O3's gate, five candidates above the rule and two through it. */
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
