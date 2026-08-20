import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { FEATURES, MODEL, PIPELINE } from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import { createWipe, hidden, shown } from './wipeMask';
import './c5-palette.css';
import './attention.css';

export interface Attention {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** Five lanes, which is the largest candidate set the model accepts. */
const LANES = MODEL.maxAlternatives;

/**
 * The attention overlay's units. Stretched to the zone it covers, so the lines
 * need no aspect contract; their weight is held by `non-scaling-stroke`.
 */
const OVERLAY = { width: 100, height: 100 } as const;

const laneY = (index: number): number => ((index + 0.5) / LANES) * OVERLAY.height;

/**
 * Every pair of lanes, drawn once.
 *
 * Self-attention is a complete graph over the set, and the complete graph is
 * the reason a score is relational. Drawing only neighbouring pairs would say
 * the opposite.
 *
 * Alternate pairs are drawn from the lower lane upward. Every curve leaving its
 * higher lane and landing on its lower one made a mutual graph read as a
 * one-way cascade, which is the wrong claim about what attention does.
 */
const attentionLines = (): readonly SVGPathElement[] => {
  const lines: SVGPathElement[] = [];
  for (let from = 0; from < LANES; from += 1) {
    for (let to = from + 1; to < LANES; to += 1) {
      const rising = (from + to) % 2 === 1;
      const start = laneY(rising ? to : from);
      const end = laneY(rising ? from : to);
      const bow = 18 + Math.abs(to - from) * 8;
      lines.push(
        svg('path', {
          class: 'at-link',
          'vector-effect': 'non-scaling-stroke',
          d:
            `M -6 ${start.toFixed(2)} ` +
            `C ${bow.toFixed(1)} ${start.toFixed(2)}, ` +
            `${(OVERLAY.width - bow).toFixed(1)} ${end.toFixed(2)}, ` +
            `${OVERLAY.width + 6} ${end.toFixed(2)}`,
        }),
      );
    }
  }
  return lines;
};

/**
 * What the model does to a candidate set.
 *
 * Five rails run the width of the field, and the argument is what happens to
 * them in the middle: every rail is joined to every other before any of them is
 * scored. The two properties printed under the board are the two the paper
 * chose the architecture for, and they are the only text the board carries
 * beyond its column headings.
 */
export function createAttention(): Attention {
  const composition = [
    { key: 'attributes', figure: String(FEATURES.attributes * FEATURES.perAttribute), label: `${FEATURES.attributes} attributes, encoded three ways` },
    { key: 'stakeholder', figure: String(FEATURES.stakeholder), label: 'Stakeholder archetype' },
    { key: 'application', figure: String(FEATURES.application), label: 'Application context' },
  ].map((part) =>
    el('div', {
      className: 'at-part',
      attrs: { 'data-key': part.key },
      children: [
        el('span', { className: 'at-part-figure c5-figure', text: part.figure }),
        el('p', { className: 'at-part-label', text: part.label }),
      ],
    }),
  );

  const triplet = FEATURES.triplet.map((name) =>
    el('span', { className: 'at-triplet-cell', text: name }),
  );

  const input = el('div', {
    className: 'at-input',
    children: [
      el('div', { className: 'at-parts', children: composition }),
      el('div', {
        className: 'at-sum',
        children: [
          el('span', { className: 'at-sum-figure c5-figure', text: String(FEATURES.total) }),
          el('p', { className: 'at-sum-label', text: 'Input features per candidate' }),
        ],
      }),
      el('div', {
        className: 'at-triplet',
        children: [
          el('p', { className: 'at-triplet-label', text: 'Every attribute carries' }),
          el('div', { className: 'at-triplet-cells', children: triplet }),
        ],
      }),
    ],
  });

  const heads = PIPELINE.map((stage) =>
    el('div', {
      className: 'at-head',
      attrs: { 'data-key': stage.key },
      children: [
        el('p', { className: 'at-head-label', text: stage.label }),
        el('p', { className: 'at-head-detail', text: stage.detail }),
      ],
    }),
  );

  const links = attentionLines();
  const overlay = svg('svg', {
    class: 'at-overlay',
    viewBox: `0 0 ${OVERLAY.width} ${OVERLAY.height}`,
    preserveAspectRatio: 'none',
  });
  const wipe = createWipe(overlay, OVERLAY.width, OVERLAY.height, 'x');
  const linkGroup = svg('g', { 'clip-path': wipe.clip });
  for (const link of links) linkGroup.appendChild(link);
  overlay.appendChild(linkGroup);

  const encoders: HTMLElement[] = [];
  const joins: HTMLElement[] = [];
  const scores: HTMLElement[] = [];

  const lanes = Array.from({ length: LANES }, (_, index) => {
    const encoder = el('span', { className: 'at-encoder' });
    encoders.push(encoder);
    const join = el('span', { className: 'at-join' });
    joins.push(join);
    const dot = el('span', { className: 'at-score-dot' });
    const score = el('span', { className: 'at-score', children: [dot] });
    scores.push(score);

    return el('div', {
      className: 'at-lane',
      attrs: { 'data-lane': String(index) },
      children: [
        el('span', { className: 'at-rail' }),
        encoder,
        el('span', { className: 'at-zone' }),
        join,
        score,
      ],
    });
  });

  const context = el('div', {
    className: 'at-context',
    children: [el('span', { className: 'at-context-node' })],
  });

  const board = el('div', {
    className: 'c5-field at-board',
    children: [
      el('div', { className: 'at-heads', children: heads }),
      el('div', {
        className: 'at-lanes',
        children: [...lanes, el('div', { className: 'at-overlay-slot', children: [overlay] }), context],
      }),
    ],
  });

  const properties = [
    { figure: MODEL.invariance, label: MODEL.invarianceNote },
    {
      figure: `${MODEL.minAlternatives} to ${MODEL.maxAlternatives}`,
      label: 'Candidates per scenario, handled by masking',
    },
    {
      figure: MODEL.parameters.toLocaleString('en-GB'),
      label: 'Trainable parameters',
    },
  ].map((property) =>
    el('div', {
      className: 'at-property',
      children: [
        el('p', { className: 'at-property-figure', text: property.figure }),
        el('p', { className: 'at-property-label', text: property.label }),
      ],
    }),
  );

  const element = el('div', {
    className: 'c5 at',
    children: [
      el('div', {
        className: 'at-top',
        children: [el('p', { className: 'c5-index', text: 'One candidate, and the set it is in' }), input],
      }),
      board,
      el('div', { className: 'at-properties', children: properties }),
    ],
  });

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set([input, ...composition, ...triplet, board, ...heads, ...properties, ...lanes], {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
    });
    gsap.set(wipe.rect, shown(wipe));
    gsap.set([...encoders, ...joins, ...scores, context], { opacity: 1, scale: 1, scaleX: 1 });
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
          composition,
          {
            opacity: 0,
            y: 14,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.6),
          },
          0,
        )
        .from(
          triplet,
          {
            opacity: 0,
            scale: 0.86,
            transformOrigin: 'center center',
            duration: seconds(DURATION.normal),
            ease: 'back.out(2)',
            stagger: seconds(STAGGER),
          },
          seconds(DURATION.normal * 0.7),
        )
        .from(
          board,
          {
            opacity: 0,
            y: 22,
            duration: seconds(DURATION.cinematic * 0.8),
            ease: EASE.enter,
          },
          seconds(DURATION.normal * 0.8),
        )
        .from(
          heads,
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.8),
          },
          seconds(DURATION.slow * 0.8),
        )
        .from(
          lanes,
          {
            opacity: 0,
            x: -26,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.2),
          },
          seconds(DURATION.slow * 0.9),
        )
        .fromTo(
          encoders,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.normal),
            ease: EASE.standard,
            transformOrigin: 'left center',
            stagger: seconds(STAGGER),
          },
          seconds(DURATION.cinematic * 0.75),
        )
        // The links are the beat. They are drawn after the lanes exist and
        // before anything is scored, which is the order the model works in.
        .fromTo(
          wipe.rect,
          hidden(wipe),
          {
            ...shown(wipe),
            duration: seconds(DURATION.slow * 1.1),
            ease: EASE.standard,
          },
          seconds(DURATION.cinematic * 0.95),
        )
        .from(
          context,
          {
            opacity: 0,
            scale: 0.7,
            transformOrigin: 'center center',
            duration: seconds(DURATION.slow),
            ease: 'back.out(1.8)',
          },
          seconds(DURATION.cinematic * 1.4),
        )
        .fromTo(
          joins,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.normal),
            ease: EASE.standard,
            transformOrigin: 'left center',
            stagger: seconds(STAGGER),
          },
          seconds(DURATION.cinematic * 1.55),
        )
        .from(
          scores,
          {
            opacity: 0,
            x: -14,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER),
          },
          seconds(DURATION.cinematic * 1.7),
        )
        .from(
          properties,
          {
            opacity: 0,
            y: 12,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 2),
          },
          seconds(DURATION.cinematic * 1.9),
        );
    },
  };
}
