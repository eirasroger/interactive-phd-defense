import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import {
  CROSS_VALIDATION,
  FLOOR,
  METRICS,
  RECALL,
  REDUCTIONS,
  REDUCTION_CLAIM,
  SPLIT,
} from '@/content/c4';
import { countUp, formatCount } from '@/utilities/count';
import { el } from '@/utilities/dom';
import './c4-palette.css';
import './budget.css';

export interface Budget {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** The scale the three reductions are drawn against, with headroom above the worst. */
const LOSS_SCALE = 0.06;

/**
 * What the model achieves, and where the declared data stops it.
 *
 * Two columns, one argument. The error budget and the reduction comparison
 * establish that the representation works. The recall column says which
 * pathways it separates, and the reason the other four stay unresolved sits
 * upstream of the model in how manufacturers write end-of-life scenarios up.
 * Read as one recovery class with recycling, those four hold.
 */
export function createBudget(): Budget {
  const counters: { readonly node: HTMLElement; readonly to: number; readonly decimals: number }[] =
    [];

  const tiles = METRICS.map((metric) => {
    const figure = el('span', { className: 'bd-tile-figure c4-figure', text: '0' });
    counters.push({ node: figure, to: metric.overall, decimals: metric.decimals });

    return el('div', {
      className: 'bd-tile',
      attrs: { 'data-key': metric.key },
      children: [
        el('p', { className: 'bd-tile-label', text: metric.label }),
        el('div', {
          className: 'bd-tile-value',
          children: [figure, el('span', { className: 'bd-tile-unit', text: metric.unit })],
        }),
        el('p', {
          className: 'bd-tile-splits',
          text:
            `${metric.train.toFixed(metric.decimals)} training · ` +
            `${metric.test.toFixed(metric.decimals)} testing`,
        }),
      ],
    });
  });

  // The dataset drawn rather than described: one figure for its size, and the
  // split as a partition of it, sized by the counts themselves.
  const splitSegments = (['train', 'test'] as const).map((part) =>
    el('span', { className: 'bd-split-segment', attrs: { 'data-part': part } }),
  );

  const splitKey = (count: number, label: string): HTMLElement =>
    el('span', {
      className: 'bd-split-key',
      children: [
        el('span', { className: 'bd-split-count', text: formatCount(count, { grouped: true }) }),
        el('span', { className: 'bd-split-label', text: label }),
      ],
    });

  const splitNote = el('div', {
    className: 'bd-split',
    attrs: { style: `--train: ${SPLIT.train}fr; --test: ${SPLIT.test}fr` },
    children: [
      el('div', {
        className: 'bd-split-total',
        children: [
          el('span', { className: 'bd-split-figure c4-figure', text: formatCount(SPLIT.total, { grouped: true }) }),
          el('span', { className: 'bd-split-unit', text: 'products' }),
        ],
      }),
      el('div', { className: 'bd-split-bar', children: splitSegments }),
      el('div', {
        className: 'bd-split-keys',
        children: [splitKey(SPLIT.train, 'training'), splitKey(SPLIT.test, 'testing')],
      }),
    ],
  });

  const converged = el('div', {
    className: 'bd-converged',
    children: CROSS_VALIDATION.map((entry) =>
      el('span', {
        className: 'bd-converged-item',
        children: [
          el('span', { className: 'bd-converged-label', text: entry.label }),
          el('span', {
            className: 'bd-converged-value',
            text: `${entry.mean.toFixed(4)} ± ${entry.deviation.toFixed(4)}`,
          }),
        ],
      }),
    ),
  });

  /* -- Reductions -- */

  const reductionBars: HTMLElement[] = [];
  const reductionRows = REDUCTIONS.map((reduction) => {
    const fill = el('span', {
      className: 'bd-loss-fill',
      attrs: { style: `width: ${((reduction.loss / LOSS_SCALE) * 100).toFixed(1)}%` },
    });
    reductionBars.push(fill);

    return el('div', {
      className: 'bd-loss',
      attrs: { 'data-key': reduction.key },
      children: [
        el('p', { className: 'bd-loss-label', text: reduction.label }),
        el('span', {
          className: 'bd-loss-value c4-figure',
          text: reduction.spread
            ? `${reduction.loss.toFixed(3)} ± ${reduction.spread.toFixed(3)}`
            : reduction.loss.toFixed(3),
        }),
        el('span', { className: 'bd-loss-rail', children: [fill] }),
      ],
    });
  });

  const ledgerRow = (label: string, value: string, lead = false): HTMLElement =>
    el('div', {
      className: 'bd-ledger-row',
      attrs: lead ? { 'data-lead': 'true' } : {},
      children: [
        el('span', { className: 'bd-ledger-label', text: label }),
        el('span', { className: 'bd-ledger-value', text: value }),
      ],
    });

  const reductions = el('div', {
    className: 'bd-panel',
    children: [
      el('p', {
        className: 'bd-panel-label',
        text: 'Prediction loss under each dimensionality reduction',
      }),
      el('div', { className: 'bd-losses', children: reductionRows }),
      el('div', {
        className: 'bd-ledger',
        children: [ledgerRow(REDUCTION_CLAIM.label, REDUCTION_CLAIM.value, true)],
      }),
    ],
  });

  /* -- Recall, and the floor under it -- */

  const recallBars: HTMLElement[] = [];
  const recallRows = RECALL.map((entry) => {
    const resolved = entry.share !== null;
    const fill = el('span', {
      className: resolved ? 'bd-recall-fill' : 'bd-recall-fill c4-hatch',
      attrs: { style: `width: ${resolved ? ((entry.share ?? 0) * 100).toFixed(0) : '100'}%` },
    });
    if (resolved) recallBars.push(fill);

    return el('div', {
      className: 'bd-recall',
      attrs: { 'data-resolved': String(resolved) },
      children: [
        el('p', { className: 'bd-recall-label', text: entry.label }),
        el('span', { className: 'bd-recall-rail', children: [fill] }),
        el('span', {
          className: 'bd-recall-value',
          text: resolved ? `${Math.round((entry.share ?? 0) * 100)}%` : 'Not separated',
        }),
      ],
    });
  });

  const floorFigure = el('span', { className: 'bd-floor-figure c4-figure', text: '0' });
  counters.push({ node: floorFigure, to: FLOOR.share * 100, decimals: 1 });

  const floor = el('div', {
    className: 'bd-floor',
    children: [
      el('div', {
        className: 'bd-floor-value',
        children: [
          floorFigure,
          el('span', { className: 'bd-floor-unit', text: '%' }),
          el('span', { className: 'bd-floor-measure', text: FLOOR.measure }),
        ],
      }),
      el('div', {
        className: 'bd-floor-text',
        children: [
          el('p', { className: 'bd-floor-label', text: FLOOR.label }),
          el('p', { className: 'bd-floor-body', text: FLOOR.body }),
        ],
      }),
    ],
  });

  const recall = el('div', {
    className: 'bd-panel',
    children: [
      el('p', {
        className: 'bd-panel-label',
        text: 'Most probable pathway, identified in the test set',
      }),
      el('div', { className: 'bd-recalls', children: recallRows }),
      floor,
    ],
  });

  const index = el('p', {
    className: 'c4-index',
    text: 'What the model achieves',
  });

  const element = el('div', {
    className: 'c4 bd',
    children: [
      el('div', {
        className: 'bd-head',
        children: [
          index,
          el('div', { className: 'bd-tiles', children: tiles }),
          splitNote,
          converged,
        ],
      }),
      el('div', { className: 'bd-body', children: [reductions, recall] }),
    ],
  });

  const ledgerRows = [...reductions.querySelectorAll<HTMLElement>('.bd-ledger-row')];
  const panelLabels = [...element.querySelectorAll<HTMLElement>('.bd-panel-label')];

  const write = (): void => {
    for (const counter of counters) {
      counter.node.textContent = counter.to.toFixed(counter.decimals);
    }
  };

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(
      [
        index,
        splitNote,
        converged,
        floor,
        ...tiles,
        ...panelLabels,
        ...reductionRows,
        ...ledgerRows,
        ...recallRows,
      ],
      { opacity: 1, x: 0, y: 0 },
    );
    gsap.set([...reductionBars, ...recallBars, ...splitSegments], { opacity: 1, scaleX: 1 });
    write();
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
        .from(index, { opacity: 0, y: 8, duration: seconds(DURATION.normal), ease: EASE.enter }, 0)
        .from(
          tiles,
          {
            opacity: 0,
            y: 18,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.3),
          },
          seconds(DURATION.quick * 0.5),
        )
        .from(
          [splitNote, converged],
          {
            opacity: 0,
            y: 6,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.2),
          },
          seconds(DURATION.slow * 0.8),
        )
        .fromTo(
          splitSegments,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'left center',
            stagger: seconds(STAGGER),
          },
          seconds(DURATION.slow * 0.9),
        )
        .from(
          panelLabels,
          {
            opacity: 0,
            x: -10,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.4),
          },
          seconds(DURATION.slow * 0.85),
        )
        .from(
          reductionRows,
          {
            opacity: 0,
            y: 14,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.3),
          },
          seconds(DURATION.slow),
        )
        .fromTo(
          reductionBars,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'left center',
            stagger: seconds(STAGGER * 1.3),
          },
          seconds(DURATION.slow * 1.05),
        )
        .from(
          ledgerRows,
          {
            opacity: 0,
            y: 8,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.9),
          },
          seconds(DURATION.cinematic * 0.75),
        )
        // The four the model separates arrive first, and the four it does not
        // arrive in the same pass on the same rail, so the asymmetry is read
        // off one list instead of being announced.
        .from(
          recallRows,
          {
            opacity: 0,
            x: 14,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 0.9),
          },
          seconds(DURATION.slow * 1.05),
        )
        .fromTo(
          recallBars,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'left center',
            stagger: seconds(STAGGER * 0.9),
          },
          seconds(DURATION.slow * 1.15),
        )
        .from(
          floor,
          { opacity: 0, y: 16, duration: seconds(DURATION.slow), ease: EASE.enter },
          seconds(DURATION.cinematic * 0.95),
        );

      for (const [position, counter] of counters.entries()) {
        const start = position < tiles.length ? DURATION.quick * 0.7 : DURATION.cinematic;
        line.add(
          countUp(counter.node, counter.to, seconds(DURATION.slow), {
            decimals: counter.decimals,
          }),
          seconds(start + STAGGER * 1.3 * Math.min(position, tiles.length)),
        );
      }

      return line;
    },
  };
}
