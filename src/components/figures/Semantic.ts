import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { TRANSFERS, TRANSFER_CLAIM, TRANSFER_STEPS, type Transfer } from '@/content/c4';
import { el } from '@/utilities/dom';
import { createArrow, type ArrowMark } from './arrowMark';
import './c4-palette.css';
import './semantic.css';

export interface Semantic {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

interface Row {
  readonly element: HTMLElement;
  readonly cells: readonly HTMLElement[];
  readonly arrows: readonly ArrowMark[];
}

/**
 * One input, and what the embedding does with it.
 *
 * Read left to right: what the declaration says, the material terms it comes
 * out beside, and the outcome those terms carry. The middle column is the whole
 * mechanism, and the third is the reason anybody should care about it.
 */
function transferRow(transfer: Transfer): Row {
  const declared = el('div', {
    className: 'sm-cell sm-declared',
    children: [
      el('p', { className: 'sm-declared-value', text: transfer.declared }),
      el('p', { className: 'sm-declared-note', text: transfer.note }),
    ],
  });

  // Fig. 3 reports five neighbours per probe and the paper names only some of
  // them, so the row ends on a mark that says the list continues.
  const neighbours = el('div', {
    className: 'sm-cell sm-neighbours',
    children: [
      ...transfer.neighbours.map((term) => el('span', { className: 'sm-neighbour', text: term })),
      el('span', { className: 'sm-neighbour sm-neighbour-more', text: 'and others' }),
    ],
  });

  const predicted = el('div', {
    className: 'sm-cell sm-predicted',
    attrs: { 'data-tone': transfer.tone },
    children: [el('span', { className: 'sm-pathway', text: transfer.pathway })],
  });

  const first = createArrow('field');
  const second = createArrow('field');

  return {
    cells: [declared, neighbours, predicted],
    arrows: [first, second],
    element: el('div', {
      className: 'sm-row',
      attrs: { 'data-key': transfer.key },
      children: [declared, first.element, neighbours, second.element, predicted],
    }),
  };
}

/**
 * Why the embedding is the part that makes this usable.
 *
 * A declaration names a material in whatever words its author chose, and new
 * products keep arriving, so a model that matches strings is a model that stops
 * working on the second document. Placing a term by meaning is what lets an
 * input the model has never seen inherit the outcome of the materials it
 * resembles, and that inheritance is what the beat draws: two inputs with no
 * exact match, the terms each one lands beside, and the pathway that follows.
 */
export function createSemantic(): Semantic {
  const heads = TRANSFER_STEPS.map((step, index) =>
    el('p', {
      className: 'sm-head-label',
      attrs: { 'data-column': String(index) },
      text: step,
    }),
  );

  const header = el('div', {
    className: 'sm-row sm-header',
    children: [
      heads[0] as HTMLElement,
      el('span'),
      heads[1] as HTMLElement,
      el('span'),
      heads[2] as HTMLElement,
    ],
  });

  const rows = TRANSFERS.map(transferRow);

  const table = el('div', {
    className: 'c4-field sm-table',
    children: [header, ...rows.map((row) => row.element)],
  });

  // The caption above the frame already carries `TRANSFER_CLAIM.label`, so the
  // panel states only the thing the caption has no room for: why it matters.
  const body = el('p', { className: 'sm-body', text: TRANSFER_CLAIM.body });

  const index = el('p', { className: 'c4-index', text: 'Semantic generalisation' });
  const element = el('div', {
    className: 'c4 sm',
    children: [el('div', { className: 'sm-head', children: [index, body] }), table],
  });

  const cells = rows.flatMap((row) => [...row.cells]);
  const shafts = rows.flatMap((row) => row.arrows.map((one) => one.shaft));
  const heads2 = rows.flatMap((row) => row.arrows.map((one) => one.head));

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([index, body, table, header, ...heads, ...cells], {
      opacity: 1,
      x: 0,
      y: 0,
    });
    gsap.set(shafts, { opacity: 1, scaleX: 1 });
    gsap.set(heads2, { opacity: 1, x: 0 });
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

      return (
        line
          .from(
            [index, body],
            {
              opacity: 0,
              y: 10,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.2),
            },
            0,
          )
          .from(
            table,
            { opacity: 0, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.quick * 0.6),
          )
          .from(
            heads,
            {
              opacity: 0,
              y: 8,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 1.4),
            },
            seconds(DURATION.normal),
          )
          // Each row is read across before the next one starts, because the
          // argument is the crossing and not the list.
          .from(
            cells.filter((_, position) => position % 3 === 0),
            {
              opacity: 0,
              x: -20,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 6),
            },
            seconds(DURATION.slow * 0.9),
          )
          .fromTo(
            shafts,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.standard,
              stagger: seconds(STAGGER * 3),
            },
            seconds(DURATION.slow * 1.2),
          )
          .from(
            heads2,
            {
              opacity: 0,
              x: -9,
              duration: seconds(DURATION.quick),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 3),
            },
            seconds(DURATION.slow * 1.42),
          )
          .from(
            cells.filter((_, position) => position % 3 === 1),
            {
              opacity: 0,
              scale: 0.9,
              duration: seconds(DURATION.slow),
              ease: 'back.out(1.6)',
              stagger: seconds(STAGGER * 6),
            },
            seconds(DURATION.slow * 1.35),
          )
          .from(
            cells.filter((_, position) => position % 3 === 2),
            {
              opacity: 0,
              x: -16,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 6),
            },
            seconds(DURATION.cinematic * 1.05),
          )
      );
    },
  };
}
