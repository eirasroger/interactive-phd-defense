/**
 * The four objective marks.
 *
 * **One construction, four drawings.** Every mark is built on the same 64-unit
 * grid, with the same 1.5 stroke, the same round caps and joins, and the same
 * optical inset — which is the whole difference between a set and four pictures
 * that happen to share a slide. Nothing is filled except the accent dots, and
 * nothing carries a colour of its own: the card decides that, so a mark is amber
 * while its objective is being spoken and neutral once it is not.
 *
 * **Each mark draws its objective's mechanism, not a symbol for its subject.**
 * A gear for *method*, a brain for *machine learning* or a shield for
 * *compliance* would be four stock glyphs, and a committee reads stock glyphs as
 * decoration. A radar with uneven arms *is* multi-criteria evaluation; a
 * threshold that five candidates meet and two pass *is* prefiltering.
 *
 * Three element roles, and the reveal treats each differently:
 *
 * - `icon-stroke` — drawn on, in the order the eye should read. The draw works
 *   by writing `stroke-dasharray`, so nothing that is *meant* to be dashed can
 *   carry this class: the animation would overwrite the pattern and leave a
 *   solid line where an absence was drawn.
 * - `icon-dash` — a dashed stroke that means something is missing. Revealed by
 *   opacity, for exactly that reason.
 * - `icon-dot` — scaled up after the strokes land, so the marks arrive on lines
 *   that already exist rather than floating in first.
 *
 * `icon-faint` composes with any of them: scaffolding — the axis cage, the
 * sheets behind the front one — present and deliberately not competing.
 */

export type ObjectiveIcon = 'indicators' | 'corpus' | 'gate' | 'ranking';

/**
 * The optical box every mark is drawn inside: 8 to 56 on both axes, on a 64
 * grid. Normalising the box is what stops one mark reading as bigger than
 * another when they are the same nominal size — the thing that most reliably
 * gives away four drawings pretending to be a set.
 */
const BOX = { min: 8, max: 56, mid: 32 } as const;

const dot = (cx: number, cy: number, r = 2.2): string =>
  `<circle class="icon-dot" cx="${cx}" cy="${cy}" r="${r}" />`;

/**
 * Radar geometry, five axes from the top at 72°, radius 24 on centre (32, 32).
 *
 * Five rather than four: an even count draws a rectangle at rest, and a
 * rectangle reads as a shape rather than as a measurement.
 */
const AXES = [-90, -18, 54, 126, 198].map((degrees) => (degrees * Math.PI) / 180);
const CAGE_R = 24;
/** Deliberately well inside the cage. At 0.8 the two outlines collide and the
    mark reads as two overlapping pentagons rather than as a measurement in a
    frame. */
const PROFILE_R = [0.62, 0.4, 0.68, 0.34, 0.52];

const polar = (angle: number, radius: number): readonly [number, number] => [
  BOX.mid + Math.cos(angle) * radius,
  BOX.mid + Math.sin(angle) * radius,
];

const round = ([x, y]: readonly [number, number]): string => `${x.toFixed(2)},${y.toFixed(2)}`;

const CAGE_POINTS = AXES.map((angle) => polar(angle, CAGE_R));
const PROFILE_POINTS = AXES.map((angle, index) => polar(angle, CAGE_R * (PROFILE_R[index] ?? 0.5)));

/**
 * O1 — indicators spanning environmental, circularity, economic and technical
 * performance, read against each other rather than summed.
 *
 * The cage is what every product is measured on; the uneven profile inside it is
 * one product's answer. Uneven on purpose — a regular pentagon would say the
 * criteria are already reconciled, which is the problem rather than the method.
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
 * O2 — a corpus of declarations, and what is missing from it.
 *
 * Three sheets, because the objective is about reporting *across* products and a
 * single document would be about one. The front sheet carries three fields: one
 * complete, one dashed — absent — and one short, which is the inconsistency the
 * corpus is characterised for. The dash is `CandidateSet`'s and `Declaration`'s,
 * unchanged, and by the fourth appearance it needs no legend.
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
 * O3 — compliance as a threshold taken before anything is ranked.
 *
 * Five candidates above the rule, two below it, and the two that pass are the
 * only ones tied to it. The rule is the same device the candidate-set figure
 * draws compliance on in Act I, which is the point: this objective is that rule
 * being moved to the front of the process and automated.
 */
const gate = `
  ${[13, 22.5, 32, 41.5, 51].map((x) => dot(x, 12)).join('')}
  <line class="icon-stroke" x1="${BOX.min}" y1="32" x2="${BOX.max}" y2="32" />
  <line class="icon-stroke" x1="26" y1="35" x2="26" y2="45" />
  <line class="icon-stroke" x1="38" y1="35" x2="38" y2="45" />
  ${dot(26, 52, 2.6)}
  ${dot(38, 52, 2.6)}
`;

/**
 * O4 — a candidate set ordered, with one recommendation carried out of it.
 *
 * Bars rather than a network or a node graph: the model is the method and the
 * ranking is the objective, and what the audience needs to recognise in half a
 * second is that something came out on top. The marker on the leading bar is the
 * recommendation; without it this is a bar chart.
 */
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
