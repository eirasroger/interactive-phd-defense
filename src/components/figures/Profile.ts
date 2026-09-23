import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { INPUTS, STAGE } from '@/content/c4';
import { el } from '@/utilities/dom';
import { createArrow } from './arrowMark';
import './c4-palette.css';
import './profile.css';

export interface Profile {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** Candidates drawn, and attributes per candidate. */
const CANDIDATES = 5;
const ATTRIBUTES = 8;

/**
 * Illustrative attribute values (0.38 to 0.96) for one candidate. Hashed from
 * the index so they are stable across runs and differ per candidate.
 */
const profileOf = (candidate: number): readonly number[] => {
  let seed = Math.imul(candidate + 7, 2654435761);
  return Array.from({ length: ATTRIBUTES }, () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519);
    return 0.38 + ((seed >>> 9) / 0x800000) * 0.58;
  });
};

/**
 * Missing attributes per candidate. Each candidate has different gaps, so no
 * single column can be dropped to make the set comparable.
 */
const GAPS: readonly (readonly number[])[] = [
  [2, 6],
  [1, 4, 7],
  [3, 5],
  [0, 6],
  [2, 3, 7],
] as const;

interface Track {
  readonly element: HTMLElement;
  readonly bars: readonly HTMLElement[];
  readonly slots: readonly HTMLElement[];
}

/**
 * One candidate's attribute bars.
 *
 * @param filled whether the gaps carry inferred values.
 */
function track(candidate: number, filled: boolean): Track {
  const values = profileOf(candidate);
  const gaps = GAPS[candidate] ?? [];
  const bars: HTMLElement[] = [];
  const slots: HTMLElement[] = [];

  const columns = values.map((value, index) => {
    const missing = gaps.includes(index);
    const provenance = missing ? (filled ? 'inferred' : 'absent') : 'declared';
    const bar = el('span', {
      className: 'pf-bar',
      attrs: {
        'data-provenance': provenance,
        style: `--extent: ${(value * 100).toFixed(1)}%`,
      },
    });

    if (missing && !filled) slots.push(bar);
    else bars.push(bar);

    return el('span', { className: 'pf-slot', children: [bar] });
  });

  return {
    bars,
    slots,
    element: el('div', {
      className: 'pf-track',
      children: [
        el('span', { className: 'pf-track-index', text: `Alternative ${candidate + 1}` }),
        el('div', { className: 'pf-columns', children: columns }),
      ],
    }),
  };
}

const keyItem = (provenance: string, label: string): HTMLElement =>
  el('span', {
    className: 'pf-key-item',
    attrs: { 'data-provenance': provenance },
    text: label,
  });

/**
 * Where inference sits in the pipeline. The same five candidates are shown
 * with gaps (from C3), then after inference fills them from the three
 * attributes every declaration reports.
 */
export function createProfile(): Profile {
  const declaredTracks = Array.from({ length: CANDIDATES }, (_, index) => track(index, false));
  const evaluatedTracks = Array.from({ length: CANDIDATES }, (_, index) => track(index, true));

  const panel = (
    tracks: readonly Track[],
    role: string,
    key: readonly HTMLElement[],
  ): HTMLElement =>
    el('div', {
      className: 'pf-panel',
      attrs: { 'data-role': role },
      children: [
        el('div', { className: 'pf-tracks', children: tracks.map((one) => one.element) }),
        el('div', { className: 'pf-key', children: key }),
      ],
    });

  const declared = panel(declaredTracks, 'declared', [
    keyItem('declared', 'Declared'),
    keyItem('absent', 'Missing'),
  ]);

  const evaluated = panel(evaluatedTracks, 'evaluated', [
    keyItem('declared', 'Declared'),
    keyItem('inferred', 'Inferred'),
  ]);

  const chips = INPUTS.map((input) =>
    el('span', {
      className: 'pf-chip',
      attrs: { 'data-key': input.key },
      text: input.label,
    }),
  );

  const engine = el('div', {
    className: 'c4-field pf-engine',
    children: [
      el('p', { className: 'c4-index', text: STAGE.operation }),
      el('div', { className: 'pf-chips', children: chips }),
    ],
  });

  const arrows = [createArrow(), createArrow()];

  const rail = el('span', { className: 'pf-rail' });
  const stage = el('div', {
    className: 'pf-stage',
    children: [
      rail,
      el('span', { className: 'pf-terminal', text: STAGE.upstream }),
      el('span', { className: 'pf-terminal', text: STAGE.downstream }),
    ],
  });

  const index = el('p', { className: 'c4-index', text: 'Where inference sits' });
  const element = el('div', {
    className: 'c4 pf',
    children: [
      el('div', { className: 'pf-top', children: [index, stage] }),
      el('div', {
        className: 'pf-body',
        children: [
          declared,
          (arrows[0] as ReturnType<typeof createArrow>).element,
          engine,
          (arrows[1] as ReturnType<typeof createArrow>).element,
          evaluated,
        ],
      }),
    ],
  });

  const terminals = [...stage.querySelectorAll<HTMLElement>('.pf-terminal')];
  const keys = [...element.querySelectorAll<HTMLElement>('.pf-key')];
  const declaredBars = declaredTracks.flatMap((one) => [...one.bars]);
  const declaredSlots = declaredTracks.flatMap((one) => [...one.slots]);
  const evaluatedDeclared = evaluatedTracks.flatMap((one) => [...one.bars]);
  const evaluatedInferred = evaluatedTracks.flatMap((one) =>
    [...one.element.querySelectorAll<HTMLElement>('.pf-bar[data-provenance="inferred"]')],
  );
  const indices = [...element.querySelectorAll<HTMLElement>('.pf-track-index')];
  const engineParts = [...engine.children] as HTMLElement[];

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([index, ...terminals, ...keys, ...indices, ...engineParts, ...chips], {
      opacity: 1,
      x: 0,
      y: 0,
    });
    gsap.set([rail, ...arrows.map((one) => one.shaft)], { opacity: 1, scaleX: 1 });
    gsap.set(arrows.map((one) => one.head), { opacity: 1, x: 0 });
    gsap.set([...declaredBars, ...evaluatedDeclared, ...evaluatedInferred], {
      opacity: 1,
      scaleY: 1,
    });
    gsap.set(declaredSlots, { opacity: 1 });
    gsap.set(engine, { opacity: 1, scale: 1 });
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
          .from(index, { opacity: 0, y: 8, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
          .fromTo(
            rail,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.slow),
              ease: 'power3.inOut',
              transformOrigin: 'left center',
            },
            seconds(DURATION.quick * 0.4),
          )
          .from(
            terminals,
            {
              opacity: 0,
              y: 8,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER),
            },
            seconds(DURATION.quick * 0.8),
          )
          // Declared bars first, then the empty slots fade in.
          .fromTo(
            declaredBars,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              transformOrigin: 'center bottom',
              stagger: seconds(STAGGER * 0.16),
            },
            seconds(DURATION.normal),
          )
          .from(
            indices.slice(0, CANDIDATES),
            {
              opacity: 0,
              duration: seconds(DURATION.quick),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.6),
            },
            seconds(DURATION.normal),
          )
          .from(
            declaredSlots,
            {
              opacity: 0,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: { each: seconds(STAGGER * 0.5), from: 'random' },
            },
            seconds(DURATION.slow * 0.95),
          )
          .from(
            keys[0] as HTMLElement,
            { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
            seconds(DURATION.slow * 1.25),
          )
          .fromTo(
            (arrows[0] as ReturnType<typeof createArrow>).shaft,
            { scaleX: 0 },
            { scaleX: 1, duration: seconds(DURATION.normal), ease: EASE.standard },
            seconds(DURATION.slow * 1.3),
          )
          .from(
            (arrows[0] as ReturnType<typeof createArrow>).head,
            { opacity: 0, x: -8, duration: seconds(DURATION.quick), ease: EASE.enter },
            seconds(DURATION.slow * 1.55),
          )
          .from(
            engine,
            { opacity: 0, scale: 0.94, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.slow * 1.4),
          )
          .from(
            chips,
            {
              opacity: 0,
              y: 10,
              duration: seconds(DURATION.normal),
              ease: 'back.out(2)',
              stagger: seconds(STAGGER * 1.1),
            },
            seconds(DURATION.cinematic),
          )
          .fromTo(
            (arrows[1] as ReturnType<typeof createArrow>).shaft,
            { scaleX: 0 },
            { scaleX: 1, duration: seconds(DURATION.normal), ease: EASE.standard },
            seconds(DURATION.cinematic * 1.15),
          )
          .from(
            (arrows[1] as ReturnType<typeof createArrow>).head,
            { opacity: 0, x: -8, duration: seconds(DURATION.quick), ease: EASE.enter },
            seconds(DURATION.cinematic * 1.35),
          )
          .from(
            indices.slice(CANDIDATES),
            {
              opacity: 0,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 0.5),
            },
            seconds(DURATION.cinematic * 1.2),
          )
          .fromTo(
            evaluatedDeclared,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.enter,
              transformOrigin: 'center bottom',
              stagger: seconds(STAGGER * 0.14),
            },
            seconds(DURATION.cinematic * 1.25),
          )
          // Inferred values arrive last, in the same positions as the gaps.
          .fromTo(
            evaluatedInferred,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: seconds(DURATION.slow * 0.7),
              ease: 'back.out(1.7)',
              transformOrigin: 'center bottom',
              stagger: seconds(STAGGER * 0.7),
            },
            seconds(DURATION.cinematic * 1.55),
          )
          .from(
            keys[1] as HTMLElement,
            { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
            seconds(DURATION.cinematic * 1.9),
          )
      );
    },
  };
}
