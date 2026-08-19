import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  AUTHORITY,
  AUTHORITY_LABEL,
  HIERARCHY_CASE,
  HIERARCHY_GOVERNING,
  REQUIREMENTS,
  type Bound,
  type Requirement,
  type Source,
  type SourceBounds,
} from '@/content/c3';
import { el } from '@/utilities/dom';
import './c3-palette.css';
import './reconcile.css';

export interface Reconcile {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const format = (requirement: Requirement, value: number): string =>
  requirement.unit ? `${value} ${requirement.unit}` : value.toFixed(2);

/** Where a value sits on its indicator's axis, as a percentage of the span. */
const position = (requirement: Requirement, value: number): number => {
  const [low, high] = requirement.domain;
  return ((value - low) / (high - low)) * 100;
};

/**
 * The edge of the admissible region, in the units the edge is written in.
 *
 * A maximum admits everything below it, so its band is pinned to the left of
 * the axis and closes from the right; a minimum is the same statement mirrored.
 * Writing the edge as `right` or `left` rather than a width keeps the pinned
 * side pinned through every tween.
 */
const edgeOf = (requirement: Requirement, value: number): number =>
  requirement.kind === 'max' ? 100 - position(requirement, value) : position(requirement, value);

/**
 * How long the region takes to reach a new edge, and how long a source waits
 * before the next one speaks.
 *
 * The interval has to exceed the travel, because two tweens overlapping on the
 * same edge would fight and the earlier one would land last, snapping the
 * region back to a bound that had already been beaten.
 */
const BAND_TRAVEL = seconds(DURATION.slow * 0.8);
const SOURCE_INTERVAL = seconds(DURATION.slow * 1.3);

interface Mark {
  readonly node: HTMLElement;
  readonly bound: Bound;
}

interface Row {
  readonly node: HTMLElement;
  readonly requirement: Requirement;
  readonly rule: HTMLElement;
  readonly band: HTMLElement;
  readonly marks: readonly Mark[];
  readonly governing: HTMLElement;
  readonly readout: HTMLElement;
}

const boundsOf = (sources: SourceBounds, requirement: Requirement): Mark[] =>
  AUTHORITY.flatMap((source: Source) => {
    const bound = sources[source]?.[requirement.key];
    if (!bound) return [];
    return [
      {
        bound,
        node: el('div', {
          className: 'rc-mark',
          attrs: { 'data-source': source, style: `left: ${position(requirement, bound.value)}%` },
          children: [
            el('span', { className: 'rc-mark-source', text: AUTHORITY_LABEL[source] }),
            el('span', { className: 'rc-mark-value', text: format(requirement, bound.value) }),
            el('span', { className: 'rc-mark-stem' }),
          ],
        }),
      },
    ];
  });

function buildRow(requirement: Requirement, governing: Bound): Row {
  const marks = boundsOf(HIERARCHY_CASE.sources, requirement);
  const [low, high] = requirement.domain;

  const band = el('div', { className: 'rc-band' });
  const rule = el('div', {
    className: 'rc-rule',
    children: [
      band,
      ...marks.map((mark) => mark.node),
      el('span', { className: 'rc-tick', attrs: { 'data-end': 'low' }, text: String(low) }),
      el('span', { className: 'rc-tick', attrs: { 'data-end': 'high' }, text: String(high) }),
    ],
  });

  const readout = el('span', {
    className: 'rc-governing-value',
    text: format(requirement, governing.value),
  });
  const governingNode = el('div', {
    className: 'rc-governing',
    attrs: { 'data-source': governing.source },
    children: [
      readout,
      el('span', {
        className: 'rc-governing-source',
        text: `Governs · ${AUTHORITY_LABEL[governing.source]}`,
      }),
    ],
  });

  const node = el('div', {
    className: 'rc-row',
    attrs: { 'data-kind': requirement.kind },
    children: [
      el('div', {
        className: 'rc-row-head',
        children: [
          el('span', { className: 'rc-row-label', text: requirement.label }),
          el('span', {
            className: 'rc-row-kind',
            text: requirement.kind === 'max' ? 'Maximum allowed' : 'Minimum required',
          }),
        ],
      }),
      rule,
      governingNode,
    ],
  });

  return { node, requirement, rule, band, marks, governing: governingNode, readout };
}

/**
 * §2.4's strictest-bound rule, drawn as the region that survives it.
 *
 * The shading is what a product is allowed to be. Each source in turn puts a
 * mark on the axis: a stricter mark drags the edge of the region onto itself,
 * and a looser one lands in the part of the axis the region no longer covers.
 * Both rows of the paper's scenario 1 then read the same way without a legend —
 * the operator's tighter water-to-cement ratio pulls the edge in, the
 * operator's lower cement floor is left standing outside it — which is the
 * whole of "may tighten, may not relax" as one gesture.
 */
export function createReconcile(): Reconcile {
  const rows = REQUIREMENTS.flatMap((requirement) => {
    const governing = HIERARCHY_GOVERNING[requirement.key];
    return governing ? [buildRow(requirement, governing)] : [];
  });

  const index = el('p', {
    className: 'c3-index',
    text: `Scenario 1 · ${HIERARCHY_CASE.jurisdiction} · exposure class ${HIERARCHY_CASE.exposureClass}`,
  });
  const quote = el('p', { className: 'c3-quote', text: `“${HIERARCHY_CASE.input}”` });
  const field = el('div', { className: 'rc-rows', children: rows.map((row) => row.node) });
  const element = el('div', { className: 'c3 rc', children: [index, quote, field] });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([index, quote], { opacity: 1, y: 0 });
    for (const row of rows) {
      const strictest = HIERARCHY_GOVERNING[row.requirement.key] as Bound;
      gsap.set(row.node, { opacity: 1, y: 0 });
      gsap.set(row.rule, { opacity: 1, scaleX: 1 });
      gsap.set(row.band, {
        opacity: 1,
        [row.requirement.kind === 'max' ? 'right' : 'left']: `${edgeOf(
          row.requirement,
          strictest.value,
        )}%`,
      });
      for (const mark of row.marks) {
        gsap.set(mark.node, { opacity: mark.bound === strictest ? 1 : 0.34, y: 0 });
        mark.node.dataset['state'] = mark.bound === strictest ? 'governs' : 'outside';
      }
      gsap.set(row.governing, { opacity: 1, x: 0 });
    }
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      if (settle) {
        settleTo();
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      line
        .from(
          index,
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            overwrite: true,
          },
          0,
        )
        .from(
          quote,
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            overwrite: true,
          },
          '>-0.2',
        );

      // Staged across the rows rather than down them. Every axis draws at once,
      // then every regulatory bound lands at once, then every operator bound.
      // Read row by row the panel takes three times as long and the comparison
      // the figure exists for is never on screen at the same moment.
      const stages = Math.max(...rows.map((row) => row.marks.length));

      for (const [order, row] of rows.entries()) {
        const edge = row.requirement.kind === 'max' ? 'right' : 'left';
        gsap.set(row.band, { opacity: 0, [edge]: '100%' });
        for (const mark of row.marks) {
          gsap.set(mark.node, { opacity: 0, y: 8 });
          mark.node.dataset['state'] = 'pending';
        }

        line
          .from(
            row.node,
            {
              opacity: 0,
              y: 14,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
            },
            seconds(STAGGER * 1.2 * order),
          )
          .fromTo(
            row.rule,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.slow),
              ease: 'power3.inOut',
              transformOrigin: 'left center',
            },
            seconds(STAGGER * 1.2 * order),
          );
      }

      for (let stage = 0; stage < stages; stage += 1) {
        const lands = seconds(DURATION.slow * 0.55) + SOURCE_INTERVAL * stage;
        const arriving = rows.flatMap((row) => {
          const mark = row.marks[stage];
          return mark ? [{ row, mark }] : [];
        });

        line.to(
          arriving.map((entry) => entry.mark.node),
          {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.6),
          },
          lands,
        );

        for (const { row, mark } of arriving) {
          const edge = row.requirement.kind === 'max' ? 'right' : 'left';
          const wanted = edgeOf(row.requirement, mark.bound.value);
          // Marks are held in authority order, so a row's first bound is index 0.
          const opens = stage === 0;

          // One tween owns the band and the next cannot start until it has
          // finished; see §31h. A bound that does not tighten moves nothing.
          if (opens) {
            line.to(
              row.band,
              {
                opacity: 1,
                [edge]: `${wanted}%`,
                duration: BAND_TRAVEL,
                ease: EASE.enter,
              },
              lands + seconds(DURATION.quick * 0.6),
            );
            continue;
          }

          const held = edgeOf(row.requirement, (row.marks[stage - 1] as Mark).bound.value);
          if (wanted > held) {
            line.to(
              row.band,
              {
                [edge]: `${wanted}%`,
                duration: BAND_TRAVEL,
                ease: 'power3.inOut',
              },
              lands + seconds(DURATION.quick * 0.6),
            );
          }
        }

        // Whatever the region no longer covers recedes, whichever source set it.
        line.call(
          () => {
            for (const row of rows) {
              const governing = HIERARCHY_GOVERNING[row.requirement.key];
              for (const mark of row.marks) {
                if (mark.node.dataset['state'] === 'pending') continue;
                mark.node.dataset['state'] = mark.bound === governing ? 'governs' : 'outside';
              }
            }
          },
          [],
          lands + seconds(DURATION.normal),
        );

        const receding = rows.flatMap((row) =>
          row.marks
            .slice(0, stage + 1)
            .filter((mark) => mark.bound !== HIERARCHY_GOVERNING[row.requirement.key])
            .map((mark) => mark.node),
        );
        if (receding.length > 0) {
          line.to(
            receding,
            { opacity: 0.3, duration: seconds(DURATION.slow), ease: EASE.standard },
            lands + seconds(DURATION.normal),
          );
        }
      }

      line.from(
        rows.map((row) => row.governing),
        {
          opacity: 0,
          x: -16,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.4),
        },
        seconds(DURATION.slow * 0.55) + SOURCE_INTERVAL * stages,
      );

      return line;
    },
  };
}
