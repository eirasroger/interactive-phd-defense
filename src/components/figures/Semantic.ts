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
 * One table row: the declared input, its nearest material terms in the
 * embedding, and the predicted pathway.
 */
function transferRow(transfer: Transfer): Row {
  const declared = el('div', {
    className: 'sm-cell sm-declared',
    children: [
      el('p', { className: 'sm-declared-value', text: transfer.declared }),
      el('p', { className: 'sm-declared-note', text: transfer.note }),
    ],
  });

  // The paper (Fig. 3) names only some of the five neighbours per probe, so
  // the row ends with "and others".
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
 * Semantic generalisation figure: two inputs with no exact match, the terms
 * each lands near in the embedding, and the pathway they inherit.
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

  // The caption already shows `TRANSFER_CLAIM.label`, so only the body goes here.
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
          // Staggered so each row plays across before the next one starts.
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
