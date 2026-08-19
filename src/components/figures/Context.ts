import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { APPROACHES, ARCHITECTURE, FUNNEL } from '@/content/c3';
import { el } from '@/utilities/dom';
import './c3-palette.css';
import './context.css';

export interface Context {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** Enough marks to read as a portfolio, few enough to count the survivors. */
const POOL = 28;
const SURVIVORS = 5;

const marks = (count: number, className: string): readonly HTMLElement[] =>
  Array.from({ length: count }, () => el('span', { className }));

const stage = (
  key: string,
  label: string,
  note: string,
  index: number,
  population: readonly HTMLElement[],
): HTMLElement =>
  el('div', {
    className: 'cx-stage',
    attrs: { 'data-key': key },
    children: [
      el('span', { className: 'cx-stage-node' }),
      el('span', { className: 'cx-stage-step', text: String(index + 1).padStart(2, '0') }),
      el('p', { className: 'cx-stage-label', text: label }),
      el('p', { className: 'cx-stage-note', text: note }),
      el('div', { className: 'cx-population', children: population }),
    ],
  });

/**
 * Why the station exists, in two states of one composition.
 *
 * The first states the position of the stage: a ranking computed over a pool
 * that still contains inadmissible products is well-formed and wrong, so the
 * gate has to close before preference is applied. The second states why the
 * gate cannot close by itself.
 */
export function createContext(): Context {
  const pool = marks(POOL, 'cx-mark');
  const shortlist = marks(SURVIVORS, 'cx-mark cx-mark-kept');
  const population: Readonly<Record<string, readonly HTMLElement[]>> = {
    portfolio: pool,
    candidates: shortlist,
  };

  const stages = FUNNEL.map((entry, index) =>
    stage(entry.key, entry.label, entry.note, index, population[entry.key] ?? []),
  );
  const nodes = stages.map((node) => node.firstElementChild as HTMLElement);
  const rail = el('div', { className: 'cx-rail' });
  const track = el('div', { className: 'cx-track', children: [rail, ...stages] });

  const funnel = el('div', {
    className: 'cx-state',
    attrs: { 'data-state': 'funnel' },
    children: [el('p', { className: 'c3-index', text: 'Where the stage sits' }), track],
  });

  const approaches = APPROACHES.map((approach) =>
    el('div', {
      className: 'cx-approach',
      attrs: { 'data-key': approach.key },
      children: [
        el('p', { className: 'cx-approach-label', text: approach.label }),
        el('p', { className: 'cx-approach-body', text: approach.description }),
        el('p', { className: 'cx-approach-cost', text: approach.limitation }),
      ],
    }),
  );

  const parts = ARCHITECTURE.parts.map((part) =>
    el('div', {
      className: 'cx-part',
      attrs: { 'data-key': part.key },
      children: [
        el('span', { className: 'cx-part-agent', text: part.agent }),
        el('span', { className: 'cx-part-act', text: part.act }),
      ],
    }),
  );

  const resolution = el('div', {
    className: 'cx-resolution',
    children: [
      el('p', { className: 'cx-resolution-label', text: ARCHITECTURE.label }),
      el('div', { className: 'cx-parts', children: parts }),
    ],
  });

  const joins = [el('span', { className: 'cx-join' }), el('span', { className: 'cx-join' })];

  const dilemma = el('div', {
    className: 'cx-state',
    attrs: { 'data-state': 'dilemma' },
    children: [
      el('p', { className: 'c3-index', text: 'Why the gate cannot close by itself' }),
      el('div', { className: 'cx-approaches', children: approaches }),
      el('div', { className: 'cx-joins', children: joins }),
      resolution,
    ],
  });

  const element = el('div', { className: 'c3 cx', children: [funnel, dilemma] });
  gsap.set(dilemma, { opacity: 0 });


  const settleTo = (step: number): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(funnel, { opacity: step === 0 ? 1 : 0 });
    gsap.set(dilemma, { opacity: step === 0 ? 0 : 1 });
    gsap.set(pool, { opacity: 0.3, scale: 1, x: 0 });
    gsap.set(shortlist, { opacity: 1, scale: 1, x: 0 });
    gsap.set([...stages, ...nodes, rail], { opacity: 1, x: 0, y: 0, scale: 1, scaleX: 1 });
    gsap.set([...approaches, resolution, ...parts], { opacity: 1, y: 0 });
    gsap.set(joins, { opacity: 1, scaleY: 1 });
  };

  const playFunnel = (): gsap.core.Timeline => {
    const line = gsap.timeline();
    gsap.set(funnel, { opacity: 1 });

    return line
      .to(dilemma, { opacity: 0, duration: seconds(DURATION.quick), ease: EASE.exit }, 0)
      .fromTo(
        rail,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          transformOrigin: 'left center',
        },
        0,
      )
      .from(
        stages,
        {
          opacity: 0,
          y: 16,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.1),
        },
        seconds(DURATION.quick * 0.5),
      )
      .fromTo(
        nodes,
        { scale: 0 },
        {
          scale: 1,
          duration: seconds(DURATION.normal),
          ease: 'back.out(2.4)',
          stagger: seconds(STAGGER * 1.1),
        },
        seconds(DURATION.quick * 0.7),
      )
      .fromTo(
        pool,
        { opacity: 0, scale: 0.3 },
        {
          opacity: 1,
          scale: 1,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: { each: seconds(STAGGER * 0.22), from: 'random' },
        },
        seconds(DURATION.quick),
      )
      // The pool recedes and the shortlist arrives travelling, so the narrowing
      // is one movement across the rail rather than two separate fades.
      .to(
        pool,
        {
          opacity: 0.3,
          duration: seconds(DURATION.slow),
          ease: EASE.standard,
          stagger: { each: seconds(STAGGER * 0.16), from: 'random' },
        },
        seconds(DURATION.slow),
      )
      .fromTo(
        shortlist,
        { opacity: 0, x: -110 },
        {
          opacity: 1,
          x: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 0.9),
        },
        seconds(DURATION.slow + DURATION.quick * 0.6),
      );
  };

  const playDilemma = (): gsap.core.Timeline => {
    const line = gsap.timeline();
    gsap.set(dilemma, { opacity: 1 });

    return line
      .to(funnel, { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.exit }, 0)
      .from(
        approaches,
        {
          opacity: 0,
          y: 26,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.6),
        },
        seconds(DURATION.quick),
      )
      .fromTo(
        joins,
        { scaleY: 0, opacity: 0 },
        {
          scaleY: 1,
          opacity: 1,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          transformOrigin: 'top center',
          stagger: seconds(STAGGER),
        },
        seconds(DURATION.normal * 1.4),
      )
      .from(
        resolution,
        { opacity: 0, y: 22, duration: seconds(DURATION.slow), ease: EASE.enter },
        '>-0.2',
      )
      .from(
        parts,
        {
          opacity: 0,
          y: 12,
          duration: seconds(DURATION.normal),
          ease: EASE.enter,
          stagger: seconds(STAGGER * 1.4),
        },
        '>-0.45',
      );
  };

  return {
    element,
    beats: 2,

    play(step, settle) {
      if (settle) {
        settleTo(step);
        return null;
      }
      gsap.set(element, { opacity: 1 });
      return step === 0 ? playFunnel() : playDilemma();
    },
  };
}
