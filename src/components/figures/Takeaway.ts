import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './takeaway.css';

const verdict = (from: string, to: string, lead: boolean): HTMLElement =>
  el('div', {
    className: 'take-verdict',
    attrs: { 'data-lead': String(lead) },
    children: [
      el('span', { className: 'take-verdict-from', text: from }),
      el('span', { className: 'take-verdict-to', text: to }),
    ],
  });

const pairRow = (label: string, width: number): HTMLElement =>
  el('div', {
    className: 'take-pair-row',
    children: [
      el('span', { text: label }),
      el('span', { className: 'take-pair-bar', attrs: { style: `width: ${width}%` } }),
    ],
  });

const card = (
  tint: string,
  name: string,
  body: string,
  figure: readonly HTMLElement[],
): HTMLElement =>
  el('div', {
    className: 'take-card',
    attrs: { 'data-tint': tint },
    children: [
      el('p', { className: 'take-name', text: name }),
      el('p', { className: 'take-body', text: body }),
      el('div', { className: 'take-figure', children: figure }),
    ],
  });

export interface Takeaway {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

export function createTakeaway(): Takeaway {
  const cards = [
    card(
      'circularity',
      'It overturns a cost-led default',
      'Plaster is cheaper on the day it is bought and clears every threshold, so conventional selection stops there. Counting disassembly, reuse and end of life reverses the answer.',
      [
        verdict('Cost and compliance', 'Plaster partition', false),
        verdict('Full profile', 'Timber partition', true),
      ],
    ),
    card(
      'environmental',
      'It reports a close call as a close call',
      'Wood and wool sit within a few points of each other, trading water against embodied carbon. The framework hands over an evidence base and leaves budget, context and availability to decide.',
      [
        el('div', {
          className: 'take-pair',
          children: [pairRow('Wood flooring', 100), pairRow('Wool carpet', 93)],
        }),
      ],
    ),
    card(
      'performance',
      'It leaves the weighting open on purpose',
      'Fixed weights would impose one project’s priorities on every other. Eliciting priorities in a repeatable, auditable way is a design problem in its own right.',
      [
        el('div', {
          className: 'take-handoff',
          children: [
            el('span', { className: 'take-handoff-mark', text: 'C5' }),
            el('span', {
              className: 'take-handoff-text',
              text: 'The indicator set becomes the feature space the recommender learns preferences over.',
            }),
          ],
        }),
      ],
    ),
  ];

  const element = el('div', { className: 'take', children: cards });
  const figures = [...element.querySelectorAll<HTMLElement>('.take-figure > *')];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(cards, { opacity: 1, y: 0 });
    gsap.set(figures, { opacity: 1, y: 0 });
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      settleTo();
      if (settle) return null;

      return gsap
        .timeline()
        .from(element, {
          opacity: 0,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          overwrite: true,
        })
        .from(
          cards,
          {
            opacity: 0,
            y: 30,
            duration: seconds(DURATION.cinematic * 0.8),
            ease: EASE.enter,
            overwrite: true,
            stagger: seconds(STAGGER * 3),
          },
          0,
        )
        .from(
          figures,
          {
            opacity: 0,
            y: 14,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            overwrite: true,
            stagger: seconds(STAGGER * 1.5),
          },
          seconds(DURATION.normal),
        );
    },
  };
}
