import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { AGREEMENT, PANEL } from '@/content/c5';
import { el } from '@/utilities/dom';
import './c5-palette.css';
import './consensus.css';

export interface Consensus {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;

/**
 * What six experts said, and what the model said.
 *
 * The band is the expert's own uncertainty and the mark inside it is the
 * model's score, so the beat is read by seeing that every mark lands inside its
 * band. `content/c5.ts` asserts that at load time, which means the picture
 * cannot quietly stop being true if a value is edited.
 *
 * The rows are ordered by expert score rather than by letter, because the
 * claim is about a ranking and a ranking has to be drawn in its own order.
 */
export function createConsensus(): Consensus {
  const ranked = [...PANEL].sort((left, right) => right.expert - left.expert);

  const bands: HTMLElement[] = [];
  const marks: HTMLElement[] = [];
  const readouts: HTMLElement[] = [];

  const rows = ranked.map((entry, index) => {
    const low = Math.max(0, entry.expert - entry.uncertainty);
    const high = Math.min(1, entry.expert + entry.uncertainty);

    const band = el('span', {
      className: 'cs-band',
      attrs: { style: `left: ${percent(low)}; width: ${percent(high - low)}` },
    });
    bands.push(band);

    const consensus = el('span', {
      className: 'cs-consensus',
      attrs: { style: `left: ${percent(entry.expert)}` },
    });

    const mark = el('span', {
      className: 'cs-mark',
      attrs: { style: `left: ${percent(entry.model)}` },
    });
    marks.push(mark);

    const readout = el('div', {
      className: 'cs-readout',
      children: [
        el('span', { className: 'cs-value c5-figure', text: entry.model.toFixed(2) }),
        el('span', { className: 'cs-against', text: `panel ${entry.expert.toFixed(2)}` }),
      ],
    });
    readouts.push(readout);

    return el('div', {
      className: 'cs-row',
      attrs: { 'data-id': entry.id, 'data-rank': String(index + 1) },
      children: [
        el('span', {
          className: 'c5-token',
          text: entry.id,
          attrs: { 'data-standing': entry.expert >= 0.75 ? 'lead' : entry.expert <= 0.25 ? 'trailing' : 'contested' },
        }),
        el('div', { className: 'cs-track', children: [band, consensus, mark] }),
        readout,
      ],
    });
  });

  const legend = el('div', {
    className: 'cs-legend',
    children: [
      el('span', { className: 'cs-key cs-key-band', text: 'Panel consensus and its uncertainty' }),
      el('span', { className: 'cs-key cs-key-mark', text: 'Model' }),
    ],
  });

  const figures = [
    { figure: AGREEMENT.tau, label: AGREEMENT.tauLabel },
    { figure: AGREEMENT.topMatch, label: AGREEMENT.topLabel },
    { figure: AGREEMENT.clear, label: AGREEMENT.clearLabel },
  ].map((entry) =>
    el('div', {
      className: 'cs-figure-block',
      children: [
        el('p', { className: 'cs-figure c5-figure', text: entry.figure }),
        el('p', { className: 'cs-figure-label', text: entry.label }),
      ],
    }),
  );

  const scope = el('p', {
    className: 'cs-scope',
    text: `${AGREEMENT.experts} experts, ${AGREEMENT.scenarios} scenarios of five real products`,
  });

  const residual = el('p', { className: 'cs-residual', text: AGREEMENT.residual });

  const element = el('div', {
    className: 'c5 cs',
    children: [
      el('div', {
        className: 'cs-head',
        children: [el('p', { className: 'c5-index', text: 'One scenario, read against the panel' }), legend],
      }),
      el('div', { className: 'cs-rows', children: rows }),
      el('div', {
        className: 'cs-summary',
        children: [scope, el('div', { className: 'cs-figures', children: figures }), residual],
      }),
    ],
  });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([...rows, ...readouts, ...figures, legend, scope, residual], {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
    });
    gsap.set(bands, { opacity: 1, scaleX: 1, transformOrigin: 'center center' });
    gsap.set(marks, { opacity: 1, scale: 1, transformOrigin: 'center center' });
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

      return line
        .from(
          legend,
          { opacity: 0, y: 8, duration: seconds(DURATION.slow), ease: EASE.enter },
          0,
        )
        .from(
          rows,
          {
            opacity: 0,
            x: -18,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.6),
          },
          seconds(DURATION.quick * 0.6),
        )
        // The panel's judgement opens from its own centre, so the band reads as
        // a range being stated rather than a bar being filled.
        .fromTo(
          bands,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'center center',
            stagger: seconds(STAGGER * 1.6),
          },
          seconds(DURATION.normal * 0.9),
        )
        // The model lands inside it afterwards, which is the order the claim is
        // made in: the panel first, then the score that has to fall within it.
        .fromTo(
          marks,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            transformOrigin: 'center center',
            duration: seconds(DURATION.normal),
            ease: 'back.out(2.6)',
            stagger: seconds(STAGGER * 1.6),
          },
          seconds(DURATION.slow * 1.1),
        )
        .from(
          readouts,
          {
            opacity: 0,
            x: -10,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.6),
          },
          seconds(DURATION.slow * 1.25),
        )
        .from(
          [scope, ...figures, residual],
          {
            opacity: 0,
            y: 12,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.8),
          },
          seconds(DURATION.cinematic),
        );
    },
  };
}
