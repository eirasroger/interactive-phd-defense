import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  DEMONSTRATION,
  EPDS,
  REQUIREMENTS,
  SCENARIO_INPUT,
  SHORT_LABEL,
  governingFrom,
  readingOf,
  verdictsFor,
  type Condition,
  type Epd,
  type Requirement,
  type RequirementKey,
  type Source,
  type Verdict,
} from '@/content/c3';
import { el } from '@/utilities/dom';
import './c3-palette.css';
import './sort.css';

export interface Sort {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const CONSIDERED = 0;
const DISCARDED = 1;

/**
 * A quantity in the precision its indicator is argued in.
 *
 * The water-to-cement ratio is the reason this is not one `Math.round`: 0.65
 * rounds to 1, and a governing constraint printed as "w/c ≤ 1" is not a
 * rounding error the room can recover from. Everything carrying a unit is a
 * whole number in the paper's own tables and rounds.
 */
const amount = (requirement: Requirement, value: number): string =>
  requirement.unit ? String(Math.round(value)) : value.toFixed(2);

const withUnit = (requirement: Requirement, value: number): string =>
  requirement.unit ? `${amount(requirement, value)} ${requirement.unit}` : amount(requirement, value);

/**
 * Why a product left, in the words the paper's own reason column uses.
 *
 * An undeclared indicator is reported ahead of any threshold the product also
 * misses. It is the same product for all three conditions and the same reason
 * every time, and it is the one failure C4 exists to answer.
 */
const reasonFor = (verdict: Verdict): string => {
  const missing = verdict.checks.find((check) => check.status === 'missing');
  if (missing) return `${SHORT_LABEL[missing.requirement.key]} not declared`;

  const failed = verdict.checks.find((check) => check.status === 'fail');
  if (!failed || failed.value === null) return '';

  const relation = failed.requirement.kind === 'min' ? 'below' : 'above';
  return (
    `${SHORT_LABEL[failed.requirement.key]} ${amount(failed.requirement, failed.value)} ` +
    `${relation} ${withUnit(failed.requirement, failed.bound.value)}`
  );
};

/**
 * The inputs the engine was given, in the order they arrive.
 *
 * The drawing sits last so that its arrival between the two demonstrations
 * lengthens the row rather than displacing the two chips that hold. They also
 * do the work of a legend: the colour on a chip is the colour on the left edge
 * of any constraint that source ends up governing.
 */
const SOURCE_ORDER: readonly Source[] = ['regulation', 'user', 'drawing'];

const SOURCE_CHIP: Readonly<Record<Source, string>> = {
  regulation: 'Schema',
  user: 'Operator',
  drawing: 'Drawing',
};

interface Roll {
  readonly element: HTMLElement;
  /** Writes a value with no motion, and leaves the track at rest. */
  set(text: string): void;
  /** Rolls to a new value. Reports whether there was anything to roll. */
  roll(text: string, line: gsap.core.Timeline, at: number, duration: number): boolean;
}

/**
 * A quantity that changes by being replaced rather than by being redrawn.
 *
 * Two cells in a clipped box, one above the other; the track travels exactly
 * one cell and the arriving value is written back into both on landing, so the
 * component is always at rest between beats and never depends on the step
 * before it. The whole reading travels together — a per-digit roll on
 * "≥ 325 kg/m³" reads as a slot machine rather than as a constraint tightening.
 */
function createRoll(className: string): Roll {
  const outgoing = el('span', { className: 'so-roll-cell' });
  const incoming = el('span', { className: 'so-roll-cell' });
  const track = el('span', { className: 'so-roll-track', children: [outgoing, incoming] });
  const element = el('span', { className, children: [track] });

  const set = (text: string): void => {
    outgoing.textContent = text;
    incoming.textContent = text;
    gsap.set(track, { yPercent: 0 });
  };

  return {
    element,
    set,
    roll(text, line, at, duration) {
      if (outgoing.textContent === text) return false;
      incoming.textContent = text;
      line.fromTo(
        track,
        { yPercent: 0 },
        { yPercent: -50, duration, ease: 'power3.inOut', onComplete: () => set(text) },
        at,
      );
      return true;
    },
  };
}

interface Card {
  readonly epd: Epd;
  readonly node: HTMLElement;
  readonly reason: HTMLElement;
  readonly readings: Readonly<Record<RequirementKey, HTMLElement>>;
}

interface Slot {
  readonly key: RequirementKey;
  readonly node: HTMLElement;
  readonly value: Roll;
}

interface Chip {
  readonly source: Source;
  readonly node: HTMLElement;
}

function buildCard(epd: Epd): Card {
  const reason = el('span', { className: 'so-card-reason' });
  const readings = Object.fromEntries(
    REQUIREMENTS.map((requirement) => [
      requirement.key,
      el('span', { className: 'so-reading', text: readingOf(epd, requirement.key) }),
    ]),
  ) as Record<RequirementKey, HTMLElement>;

  const node = el('div', {
    className: 'c3-product so-card',
    attrs: { 'data-status': 'pass' },
    children: [
      el('span', { className: 'so-card-name', text: epd.label }),
      reason,
      el('div', {
        className: 'so-readings',
        children: REQUIREMENTS.map((requirement) => readings[requirement.key]),
      }),
    ],
  });

  return { epd, node, reason, readings };
}

/**
 * Fig. 2 run on Table 5, with the products doing the travelling.
 *
 * Every product owns a row for the whole panel and never leaves it, so the only
 * thing that moves horizontally is a verdict changing. Between the two
 * demonstrations exactly three cards cross the centre, and because nothing else
 * shifts they need no annotation.
 *
 * The two demonstrations are one case study, so the second is staged as a delta
 * on the first rather than as a second picture: the jurisdiction line is written
 * once and never touched again, the drawing arrives as a chip on the end of the
 * input row, and every quantity that the drawing changes rolls to its new
 * reading in place.
 *
 * The travel is a FLIP against `offsetLeft` rather than `getBoundingClientRect`:
 * the stage is a scaled surface, so a rect delta is in screen pixels while the
 * transform that has to undo it is in layout pixels.
 */
export function createSort(): Sort {
  const cards = EPDS.map(buildCard);

  const slots: Slot[] = REQUIREMENTS.map((requirement) => {
    const value = createRoll('so-slot-value');
    return {
      key: requirement.key,
      value,
      node: el('div', {
        className: 'so-slot',
        children: [
          el('span', { className: 'so-slot-label', text: SHORT_LABEL[requirement.key] }),
          value.element,
        ],
      }),
    };
  });

  const chips: Chip[] = SOURCE_ORDER.map((source) => ({
    source,
    node: el('span', {
      className: 'so-chip',
      attrs: { 'data-source': source, 'data-present': 'false' },
      children: [
        el('span', { className: 'so-chip-dot' }),
        el('span', { className: 'so-chip-name', text: SOURCE_CHIP[source] }),
      ],
    }),
  }));

  const conditionLabel = el('p', { className: 'so-condition-label' });
  const tallyValue = createRoll('so-tally-value');
  const tally = el('div', {
    className: 'so-tally',
    children: [
      tallyValue.element,
      el('span', { className: 'so-tally-unit', text: `of ${EPDS.length} considered` }),
    ],
  });

  const head = el('div', {
    className: 'so-head',
    children: [
      el('div', {
        className: 'so-condition',
        children: [
          conditionLabel,
          el('div', { className: 'so-chips', children: chips.map((chip) => chip.node) }),
        ],
      }),
      el('div', { className: 'so-slots', children: slots.map((slot) => slot.node) }),
      tally,
    ],
  });

  const columnHeads = [
    el('span', {
      className: 'so-column',
      attrs: { 'data-column': 'considered' },
      text: 'Considered',
    }),
    el('span', {
      className: 'so-column',
      attrs: { 'data-column': 'discarded' },
      text: 'Discarded',
    }),
  ];

  const field = el('div', {
    className: 'so-field',
    children: [...columnHeads, ...cards.map((card) => card.node)],
  });

  const index = el('p', { className: 'c3-index', text: 'Scenario 2 · the same six products' });
  const quote = el('p', { className: 'c3-quote', text: `“${SCENARIO_INPUT}”` });
  const element = el('div', { className: 'c3 so', children: [index, quote, head, field] });

  for (const [row, card] of cards.entries()) {
    card.node.style.gridRow = String(row + 2);
  }

  let shown = -1;

  const present = (condition: Condition, source: Source): boolean =>
    condition.sources[source] !== undefined;

  /**
   * The state a condition *is*, with nothing tweened and nothing rolled.
   *
   * The jurisdiction line is written from the condition every time and is the
   * same string in both demonstrations, so it is never a target of motion. Its
   * holding still is what says the case study did not restart.
   */
  const apply = (condition: Condition): readonly Verdict[] => {
    const verdicts = verdictsFor(condition);
    const governing = governingFrom(condition.sources);

    conditionLabel.textContent = `${condition.jurisdiction} · exposure class ${condition.exposureClass}`;

    for (const slot of slots) {
      const bound = governing[slot.key];
      slot.node.dataset['source'] = bound?.source ?? 'none';
      slot.node.dataset['governed'] = String(bound !== undefined);
    }

    let considered = 0;
    for (const [row, card] of cards.entries()) {
      const verdict = verdicts[row];
      if (!verdict) continue;
      if (verdict.pass) considered += 1;

      const failed = verdict.checks.find((check) => check.status !== 'pass');
      card.node.dataset['status'] = verdict.pass
        ? 'pass'
        : failed?.status === 'missing'
          ? 'missing'
          : 'fail';
      card.node.style.gridColumn = String((verdict.pass ? CONSIDERED : DISCARDED) + 1);
      card.reason.textContent = verdict.pass ? '' : reasonFor(verdict);

      for (const requirement of REQUIREMENTS) {
        const check = verdict.checks.find((entry) => entry.requirement.key === requirement.key);
        const reading = card.readings[requirement.key];
        reading.dataset['state'] =
          check === undefined ? 'ungoverned' : check.status === 'pass' ? 'pass' : 'fails';
      }
    }

    return verdicts;
  };

  /** What a slot reads under a condition, in the form it is printed in. */
  const boundText = (condition: Condition, slot: Slot): string => {
    const governing = governingFrom(condition.sources);
    const bound = governing[slot.key];
    const requirement = REQUIREMENTS.find((entry) => entry.key === slot.key);
    if (!bound || !requirement) return 'Not required';
    return `${bound.kind === 'max' ? '≤' : '≥'} ${withUnit(requirement, bound.value)}`;
  };

  const consideredIn = (condition: Condition): number =>
    verdictsFor(condition).filter((verdict) => verdict.pass).length;

  const settleTo = (step: number): void => {
    const condition = DEMONSTRATION[Math.max(0, Math.min(step, DEMONSTRATION.length - 1))];
    if (!condition) return;

    apply(condition);
    for (const slot of slots) slot.value.set(boundText(condition, slot));
    tallyValue.set(String(consideredIn(condition)));
    for (const chip of chips) chip.node.dataset['present'] = String(present(condition, chip.source));

    gsap.set(element, { opacity: 1 });
    gsap.set([index, quote, head, ...columnHeads], { opacity: 1, y: 0 });
    gsap.set(
      chips.map((chip) => chip.node),
      { opacity: 1, x: 0 },
    );
    gsap.set(
      cards.map((card) => card.node),
      { opacity: 1, x: 0, y: 0 },
    );
  };

  return {
    element,
    beats: DEMONSTRATION.length,

    play(step, settle) {
      const condition = DEMONSTRATION[step];
      if (!condition) return null;

      if (settle) {
        settleTo(step);
        shown = step;
        return null;
      }

      const line = gsap.timeline();
      gsap.set(element, { opacity: 1 });

      const first = cards.map((card) => card.node.offsetLeft);
      const verdicts = apply(condition);
      const last = cards.map((card) => card.node.offsetLeft);

      // The two columns are the same width, so the gap between them is the only
      // distance a card ever travels, and it is the same for every card.
      const travel = (columnHeads[1]?.offsetLeft ?? 0) - (columnHeads[0]?.offsetLeft ?? 0);

      if (shown < 0) {
        for (const slot of slots) slot.value.set(boundText(condition, slot));
        tallyValue.set(String(consideredIn(condition)));
        for (const chip of chips) {
          chip.node.dataset['present'] = String(present(condition, chip.source));
        }

        gsap.set(
          chips.map((chip) => chip.node),
          { opacity: 1, x: 0 },
        );
        gsap.set(
          cards.map((card) => card.node),
          { opacity: 1, x: 0, y: 0 },
        );

        line
          .from(
            [index, quote, head],
            {
              opacity: 0,
              y: 12,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 2),
            },
            0,
          )
          .from(
            columnHeads,
            {
              opacity: 0,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
            },
            seconds(DURATION.normal),
          );

        // The first sort is the cohort splitting. Every card comes in on the
        // centre line and is pushed to the side its verdict puts it on.
        for (const [row, card] of cards.entries()) {
          const outward = verdicts[row]?.pass ? 1 : -1;
          line.fromTo(
            card.node,
            { opacity: 0, x: (outward * travel) / 2, y: 10 },
            {
              opacity: 1,
              x: 0,
              y: 0,
              duration: seconds(DURATION.cinematic * 0.58),
              ease: EASE.enter,
            },
            seconds(DURATION.quick + STAGGER * 1.1 * row),
          );
        }

        shown = step;
        return line;
      }

      // A source arriving is the whole cause of everything that follows, so it
      // lands on its own before a single quantity moves. It sits at the end of
      // the row, so the two chips that hold do not shift by a pixel.
      for (const chip of chips) {
        const wanted = present(condition, chip.source);
        const held = chip.node.dataset['present'] === 'true';
        if (wanted === held) continue;

        if (wanted) {
          chip.node.dataset['present'] = 'true';
          line.fromTo(
            chip.node,
            { opacity: 0, x: -14 },
            { opacity: 1, x: 0, duration: seconds(DURATION.slow * 0.62), ease: EASE.enter },
            0,
          );
        } else {
          line.to(
            chip.node,
            {
              opacity: 0,
              x: -14,
              duration: seconds(DURATION.normal * 0.7),
              ease: EASE.exit,
              onComplete: () => (chip.node.dataset['present'] = 'false'),
            },
            0,
          );
        }
      }

      // Then the constraints it changed, left to right, each one rolling from
      // the reading it held to the reading it now holds. A constraint the new
      // source did not touch does not move at all.
      const rollAt = seconds(DURATION.quick * 1.3);
      const rollFor = seconds(DURATION.slow * 0.62);
      let rolled = 0;
      for (const slot of slots) {
        const changed = slot.value.roll(
          boundText(condition, slot),
          line,
          rollAt + seconds(STAGGER * 1.3) * rolled,
          rollFor,
        );
        if (changed) rolled += 1;
      }

      // Only the cards whose verdict changed have anywhere to go. The rest hold
      // position exactly, which is what makes the movement mean something. A
      // card in transit is lifted off the surface and set back down, so the
      // move reads as deliberate rather than as a slide.
      const cardsAt = seconds(DURATION.slow * 0.95);
      const cardTravel = seconds(DURATION.cinematic * 0.62);
      let moved = 0;
      for (const [row, card] of cards.entries()) {
        const delta = (first[row] ?? 0) - (last[row] ?? 0);
        if (delta === 0) continue;

        const at = cardsAt + seconds(STAGGER * 3) * moved;

        line
          .call(() => (card.node.dataset['moving'] = 'true'), [], at)
          .fromTo(card.node, { x: delta }, { x: 0, duration: cardTravel, ease: 'power3.inOut' }, at)
          .to(
            card.node,
            {
              scale: 1.035,
              duration: cardTravel / 2,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: 1,
            },
            at,
          )
          .call(() => delete card.node.dataset['moving'], [], at + cardTravel);
        moved += 1;
      }

      // The tally is the result, so it lands with the last card rather than
      // ahead of it.
      tallyValue.roll(String(consideredIn(condition)), line, cardsAt + cardTravel * 0.5, rollFor);

      shown = step;
      return line;
    },
  };
}
