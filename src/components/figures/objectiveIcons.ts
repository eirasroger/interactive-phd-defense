/**
 * The four objective icons. All share a 64-unit grid, 1.5 stroke, round caps
 * and the same inset. Colour comes from the card. Each icon draws the
 * objective's mechanism.
 *
 * Element roles:
 * - `icon-stroke`: drawn on by animating `stroke-dasharray`, so never use it on a dashed line.
 * - `icon-dash`: a dashed stroke meaning something is missing. Revealed by opacity.
 * - `icon-dot`: scaled in after the strokes.
 * - `icon-faint`: modifier for background scaffolding.
 */

export type ObjectiveIcon = 'indicators' | 'corpus' | 'gate' | 'ranking';

/** Drawing box shared by all icons: 8 to 56 on both axes of the 64 grid, so they look the same size. */
const BOX = { min: 8, max: 56, mid: 32 } as const;

const dot = (cx: number, cy: number, r = 2.2): string =>
  `<circle class="icon-dot" cx="${cx}" cy="${cy}" r="${r}" />`;

/** Radar geometry: five axes 72° apart starting at the top, radius 24, centre (32, 32). */
const AXES = [-90, -18, 54, 126, 198].map((degrees) => (degrees * Math.PI) / 180);
const CAGE_R = 24;
/** Profile radii as fractions of the cage. Kept well inside so the outlines stay apart. */
const PROFILE_R = [0.62, 0.4, 0.68, 0.34, 0.52];

const polar = (angle: number, radius: number): readonly [number, number] => [
  BOX.mid + Math.cos(angle) * radius,
  BOX.mid + Math.sin(angle) * radius,
];

const round = ([x, y]: readonly [number, number]): string => `${x.toFixed(2)},${y.toFixed(2)}`;

const CAGE_POINTS = AXES.map((angle) => polar(angle, CAGE_R));
const PROFILE_POINTS = AXES.map((angle, index) => polar(angle, CAGE_R * (PROFILE_R[index] ?? 0.5)));

/**
 * O1: multi-criteria indicators. The cage is the set of criteria and the
 * uneven profile is one product's scores.
 */
const indicators = `
  ${CAGE_POINTS.map(
    ([x, y]) =>
      `<line class="icon-stroke icon-faint" x1="${BOX.mid}" y1="${BOX.mid}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`,
  ).join('')}
  <polygon class="icon-stroke icon-faint" points="${CAGE_POINTS.map(round).join(' ')}" />
  <polygon class="icon-stroke" points="${PROFILE_POINTS.map(round).join(' ')}" />
  ${PROFILE_POINTS.map(([x, y]) => dot(x, y, 2)).join('')}
`;

/**
 * O2: a corpus of declarations. The front sheet has a complete field, a missing
 * (dashed) field and a short one. The dash matches `CandidateSet` and `Declaration`.
 */
const corpus = `
  <rect class="icon-stroke icon-faint" x="22" y="8" width="32" height="40" rx="3" />
  <rect class="icon-stroke icon-faint" x="17" y="12" width="32" height="40" rx="3" />
  <rect class="icon-stroke" x="12" y="16" width="32" height="40" rx="3" />
  <line class="icon-stroke" x1="18" y1="27" x2="38" y2="27" />
  <line class="icon-dash" x1="18" y1="34" x2="38" y2="34" />
  <line class="icon-stroke" x1="18" y1="41" x2="31" y2="41" />
  <line class="icon-stroke" x1="18" y1="48" x2="35" y2="48" />
`;

/**
 * O3: compliance prefilter. Five candidates above the rule, two pass below it.
 * Same rule device as the Act I candidate-set figure.
 */
const gate = `
  ${[13, 22.5, 32, 41.5, 51].map((x) => dot(x, 12)).join('')}
  <line class="icon-stroke" x1="${BOX.min}" y1="32" x2="${BOX.max}" y2="32" />
  <line class="icon-stroke" x1="26" y1="35" x2="26" y2="45" />
  <line class="icon-stroke" x1="38" y1="35" x2="38" y2="45" />
  ${dot(26, 52, 2.6)}
  ${dot(38, 52, 2.6)}
`;

/** O4: ranked candidates. The dot on the top bar marks the recommendation. */
const ranking = `
  ${dot(10, 12, 2.4)}
  <line class="icon-stroke" x1="18" y1="12" x2="${BOX.max}" y2="12" />
  <line class="icon-stroke" x1="18" y1="24" x2="47" y2="24" />
  <line class="icon-stroke" x1="18" y1="36" x2="38" y2="36" />
  <line class="icon-stroke icon-faint" x1="18" y1="48" x2="29" y2="48" />
`;

const MARKS: Record<ObjectiveIcon, string> = { indicators, corpus, gate, ranking };

export const iconMarkup = (name: ObjectiveIcon): string =>
  `<svg class="objective-icon" viewBox="0 0 64 64" aria-hidden="true">${MARKS[name]}</svg>`;
