import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import type { Accent } from '@/components/accent';
import { el } from '@/utilities/dom';
import './magnitude.css';

export interface MagnitudeField {
  /** What the share is of. Names the denominator, because each one differs. */
  readonly label: string;
  /** Whole percent, 0 to 100. One cell per unit. */
  readonly value: number;
  readonly accent: Accent;
}

export interface MagnitudeGroup {
  /** What the fields underneath have in common. Two or three words. */
  readonly label: string;
  readonly fields: readonly MagnitudeField[];
}

export interface MagnitudeSpec {
  readonly groups: readonly MagnitudeGroup[];
  readonly unit: string;
}

export interface Magnitude {
  readonly element: HTMLElement;
  /** The grids materialise, then fill. One gesture, and the whole argument. */
  play(settle?: boolean): gsap.core.Timeline;
}

/*
 * Three shares of a hundred, each drawn as a hundred cells.
 *
 * **The disproportion is counted, not estimated.** A bar says "this one is
 * longer"; a field of a hundred units says "nine of these, against fifty of
 * these", and the audience can check it. It is also the only encoding on which
 * the empty part of a quantity is as present as the filled part, which is what
 * makes nine percent read as nine percent rather than as a short bar.
 *
 * **And the fills are raced.** All three start on the same frame at the same
 * rate, so the economic field is finished before the burden fields are a third
 * of the way through, and the difference between what the sector is worth and
 * what it costs becomes a duration as well as an area. That is the beat. A
 * figure whose three quantities arrive together states them; one whose
 * quantities arrive at their own size argues.
 *
 * Each field names its own denominator. Three measures over three different
 * populations may be ruled against a common hundred; asserting a conversion
 * between them is what would be false — `learnings.md` §31e.
 */
const COLUMNS = 20;
const ROWS = 5;
const CELLS = COLUMNS * ROWS;

/** Seconds between one cell lighting and the next. The race is built from this. */
const FILL_STEP = 0.022;
/** And this is the sweep that builds the empty field before anything fills. */
const WAKE_STEP = 0.0055;

interface Field {
  readonly cells: HTMLElement[];
  readonly value: number;
  readonly readout: HTMLElement;
}

export function createMagnitude(spec: MagnitudeSpec): Magnitude {
  const fields: Field[] = [];
  const labels: HTMLElement[] = [];
  const rules: HTMLElement[] = [];
  const captions: HTMLElement[] = [];
  const dividers: HTMLElement[] = [];

  const children: HTMLElement[] = [];

  for (const [index, group] of spec.groups.entries()) {
    if (index > 0) {
      const divider = el('span', { className: 'mg-divide' });
      dividers.push(divider);
      children.push(divider);
    }

    const label = el('p', { className: 'mg-group-label', text: group.label });
    const rule = el('span', { className: 'mg-group-rule' });
    labels.push(label);
    rules.push(rule);

    const built = group.fields.map((field) => {
      const cells = Array.from({ length: CELLS }, () =>
        el('span', { className: 'mg-cell' }),
      );

      const number = el('span', { className: 'mg-value', text: '0' });
      const unit = el('span', { className: 'mg-unit', text: spec.unit });
      const readout = el('p', { className: 'mg-readout', children: [number, unit] });
      const caption = el('figcaption', { className: 'mg-label', text: field.label });
      captions.push(caption);

      fields.push({ cells, value: field.value, readout: number });

      return el('figure', {
        className: 'mg-field',
        attrs: { 'data-accent': field.accent },
        children: [readout, el('div', { className: 'mg-grid', children: cells }), caption],
      });
    });

    children.push(
      el('div', {
        className: 'mg-group',
        children: [
          el('div', { className: 'mg-group-head', children: [label, rule] }),
          el('div', { className: 'mg-fields', children: built }),
        ],
      }),
    );
  }

  const element = el('div', { className: 'mg', children });

  /** Filled cells are `data-on`; CSS owns what that looks like. */
  const write = (field: Field, filled: number): void => {
    const count = Math.round(filled);
    for (const [index, cell] of field.cells.entries()) {
      const on = index < count;
      if ((cell.dataset['on'] !== undefined) === on) continue;
      if (on) cell.dataset['on'] = '';
      else delete cell.dataset['on'];
    }
    field.readout.textContent = String(count);
  };

  const settleTo = (): void => {
    gsap.set([...labels, ...captions], { opacity: 1, y: 0 });
    gsap.set(rules, { scaleX: 1 });
    gsap.set(dividers, { scaleY: 1 });
    for (const field of fields) {
      gsap.set(field.cells, { opacity: 1, scale: 1 });
      write(field, field.value);
    }
  };

  for (const field of fields) write(field, 0);

  return {
    element,

    play(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        settleTo();
        return timeline;
      }

      for (const field of fields) write(field, 0);

      timeline
        .from(labels, {
          opacity: 0,
          y: 10,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: 0.08,
        })
        .from(
          rules,
          {
            scaleX: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'left center',
            stagger: 0.08,
          },
          0,
        )
        .from(
          dividers,
          {
            scaleY: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'top center',
          },
          0.1,
        );

      /*
       * The empty field is built before anything fills it.
       *
       * Six milliseconds a cell across a hundred is a six-hundredth of a second
       * per grid and reads as a sweep rather than as a hundred arrivals. It also
       * has to finish before the fill starts, or the two staggers cross and the
       * grid appears to fill and materialise at once, which is legible as
       * neither.
       */
      for (const [index, field] of fields.entries()) {
        timeline.from(
          field.cells,
          {
            opacity: 0,
            scale: 0.4,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: { each: seconds(WAKE_STEP), from: 'start' },
          },
          0.18 + index * 0.06,
        );
      }

      // Every fill starts here, and only here. The lengths differ because the
      // quantities do, which is the whole point of the figure.
      const start = 1.0;

      for (const field of fields) {
        const scalar = { filled: 0 };
        timeline.to(
          scalar,
          {
            filled: field.value,
            duration: seconds(0.3 + field.value * FILL_STEP),
            ease: 'none',
            onUpdate: () => write(field, scalar.filled),
          },
          start,
        );
      }

      return timeline;
    },
  };
}
