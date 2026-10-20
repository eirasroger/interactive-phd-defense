import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { OFFSETS, PRODUCT_BAND, STAGES } from '@/content/c2';
import { el } from '@/utilities/dom';
import { countUp, formatCount } from '@/utilities/count';
import './c2-palette.css';
import './burden.css';

const GROUPS = [
  { key: 'product', label: 'Product · A1 to A3' },
  { key: 'construction', label: 'Transport A4 · Construction A5' },
  { key: 'endoflife', label: 'End of life · C1 to C4' },
  { key: 'benefits', label: 'Benefits beyond the lifecycle · D' },
] as const;

/** Shared row grid so the spine and the returns align at both ends. */
const row = (lead: HTMLElement | null, body: HTMLElement): HTMLElement =>
  el('div', {
    className: 'bd-row',
    children: [lead ?? el('span'), body, el('span')],
  });

export interface Burden {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/**
 * Lifecycle burden by stage, and the module D offsets. The spine shows each
 * stage at its true share. The offsets below use the same scale so their sizes
 * compare directly.
 */
export function createBurden(): Burden {
  const stageNodes = STAGES.map((stage) =>
    el('span', {
      className: 'bd-stage',
      attrs: { 'data-stage': stage.group, style: `width: ${stage.share}%` },
      children: [el('span', { className: 'bd-stage-key', text: stage.key })],
    }),
  );

  const spine = el('div', { className: 'bd-spine', children: stageNodes });

  // A legend, since four of the seven blocks are too narrow to label directly.
  const legend = el('div', {
    className: 'bd-legend',
    children: GROUPS.map((group) =>
      el('div', {
        className: 'bd-legend-item',
        attrs: { 'data-stage': group.key },
        children: [
          el('span', { className: 'bd-legend-swatch' }),
          el('span', { text: group.label }),
        ],
      }),
    ),
  });

  const headline = el('span', {
    className: 'bd-headline-value',
    text: `${PRODUCT_BAND.low}%`,
  });
  const headlineTail = el('span', {
    className: 'bd-headline-tail',
    text: `to ${PRODUCT_BAND.high}%`,
  });

  const callout = el('div', {
    className: 'bd-callout',
    children: [
      el('div', { className: 'bd-headline', children: [headline, headlineTail] }),
      el('p', {
        className: 'bd-callout-note',
        text: 'of lifecycle impact occurs at the product stage (A1 to A3).',
      }),
    ],
  });

  const module = el('div', {
    className: 'bd-module',
    attrs: { 'data-stage': 'benefits' },
    children: [
      el('span', { className: 'bd-module-key', text: 'D' }),
      el('span', {
        className: 'bd-module-label',
        text: 'Benefits beyond the lifecycle',
      }),
    ],
  });

  const returns = OFFSETS.map((offset) => {
    const fill = el('span', {
      className: 'bd-return-fill',
      attrs: { style: `width: ${offset.value}%` },
    });
    const value = el('span', {
      className: 'bd-return-value',
      text: formatCount(offset.value, { suffix: '%' }),
    });

    return {
      offset,
      fill,
      value,
      element: el('div', {
        className: 'bd-return',
        attrs: { 'data-key': offset.key },
        children: [
          el('span', { className: 'bd-return-label', text: offset.label }),
          el('span', {
            className: 'bd-return-rail',
            children: [fill],
          }),
          value,
          el('p', { className: 'bd-return-note', text: offset.note }),
        ],
      }),
    };
  });

  const element = el('div', {
    className: 'bd',
    children: [
      el('div', {
        className: 'bd-plot',
        children: [
          el('p', { className: 'bd-index', text: 'Burden by lifecycle stage' }),
          row(el('span', { className: 'bd-row-label', text: 'All indicators' }), spine),
          row(null, legend),
          callout,
        ],
      }),
      el('div', {
        className: 'bd-recovery',
        children: [
          el('div', {
            className: 'bd-recovery-head',
            children: [
              el('p', { className: 'bd-index', text: 'Offsets from module D' }),
              module,
            ],
          }),
          ...returns.map((entry) => entry.element),
        ],
      }),
    ],
  });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(stageNodes, { scaleX: 1, opacity: 1 });
    gsap.set(legend.children, { opacity: 1 });
    gsap.set([callout, module], { opacity: 1, y: 0 });
    gsap.set([headline, headlineTail], { opacity: 1 });
    for (const entry of returns) {
      gsap.set(entry.element, { opacity: 1, y: 0 });
      entry.fill.style.width = `${entry.offset.value}%`;
      entry.value.textContent = formatCount(entry.offset.value, { suffix: '%' });
    }
  };

  return {
    element,
    beats: 1,

    play(_step, settle) {
      settleTo();
      if (settle) return null;

      const timeline = gsap.timeline();

      timeline
        .from(element, { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
        // Stages grow in lifecycle order.
        .from(
          stageNodes,
          {
            scaleX: 0,
            duration: seconds(DURATION.cinematic * 0.7),
            ease: EASE.standard,
            transformOrigin: 'left center',
            stagger: seconds(STAGGER * 0.9),
          },
          0,
        )
        .from(
          legend.children,
          {
            opacity: 0,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER),
          },
          seconds(DURATION.normal),
        )
        .from(
          callout,
          { opacity: 0, y: 18, duration: seconds(DURATION.slow), ease: EASE.enter },
          seconds(DURATION.normal),
        )
        .add(
          countUp(headline, PRODUCT_BAND.low, seconds(DURATION.cinematic * 0.7), {
            suffix: '%',
          }),
          seconds(DURATION.normal),
        )
        .from(
          headlineTail,
          { opacity: 0, x: -10, duration: seconds(DURATION.normal), ease: EASE.enter },
          seconds(DURATION.cinematic),
        )
        .from(
          module,
          { opacity: 0, y: 14, duration: seconds(DURATION.slow), ease: EASE.enter },
          seconds(DURATION.cinematic * 0.9),
        );

      // Offsets appear in data order: the large one first, then the small one.
      for (const [index, entry] of returns.entries()) {
        const at = seconds(DURATION.cinematic * 1.05 + DURATION.slow * 0.55 * index);

        timeline
          .from(
            entry.element,
            { opacity: 0, y: 14, duration: seconds(DURATION.slow), ease: EASE.enter },
            at,
          )
          .fromTo(
            entry.fill,
            { width: '0%' },
            {
              width: `${entry.offset.value}%`,
              duration: seconds(DURATION.cinematic * 0.65),
              ease: 'power2.out',
              overwrite: true,
            },
            at,
          )
          .add(
            countUp(entry.value, entry.offset.value, seconds(DURATION.cinematic * 0.65), {
              suffix: '%',
            }),
            at,
          );
      }

      return timeline;
    },
  };
}
