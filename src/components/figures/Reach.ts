import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { SETTLES, type Settlement } from '@/content/c4';
import { el, svg } from '@/utilities/dom';
import './c4-palette.css';
import './reach.css';

export interface Reach {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

/** The ring's circumference, so the two arcs are written as shares of it. */
const RING = 2 * Math.PI * 22;

/** Where the funnel's wide end sits, and therefore where its wipe starts. */
const FUNNEL_ORIGIN = '9px 32px';

interface Glyph {
  readonly element: SVGSVGElement;
  /** Scaled up into place. */
  readonly pops: readonly SVGElement[];
  /** Wiped open from the left, for a shape whose meaning is a direction. */
  readonly wipes: readonly SVGElement[];
  /** Drawn along their own length. */
  readonly strokes: readonly SVGElement[];
}

/**
 * One mark per claim, drawn rather than illustrated.
 *
 * The ring closes the gap it opened with, because the claim beside it is about
 * a record being completed. The funnel is the encoder's own shape and it opens
 * from its wide end, because the claim beside it is about three hundred
 * coefficients arriving and fifty leaving.
 */
function glyphFor(kind: Settlement['glyph']): Glyph {
  const board = svg('svg', { class: 'rh-glyph', viewBox: '0 0 64 64' });

  if (kind === 'ring') {
    const declared = svg('circle', {
      class: 'rh-ring',
      cx: '32',
      cy: '32',
      r: '22',
      'stroke-dasharray': `${(RING * 0.66).toFixed(1)} ${(RING * 0.34).toFixed(1)}`,
      transform: 'rotate(-90 32 32)',
    });
    const inferred = svg('circle', {
      class: 'rh-ring rh-ring-inferred',
      cx: '32',
      cy: '32',
      r: '22',
      'stroke-dasharray': `${(RING * 0.28).toFixed(1)} ${(RING * 0.72).toFixed(1)}`,
      'stroke-dashoffset': `${(-RING * 0.7).toFixed(1)}`,
      transform: 'rotate(-90 32 32)',
    });
    board.append(declared, inferred);
    return { element: board, pops: [declared], wipes: [], strokes: [inferred] };
  }

  const group = svg('g', { class: 'rh-funnel-group' });
  group.append(
    svg('path', {
      class: 'rh-funnel',
      d: 'M 17 8 C 30 8, 34 26, 47 26 L 47 38 C 34 38, 30 56, 17 56 Z',
    }),
    svg('rect', { class: 'rh-end', x: '9', y: '8', width: '8', height: '48', rx: '4' }),
    svg('rect', {
      class: 'rh-end rh-end-out',
      x: '47',
      y: '26',
      width: '8',
      height: '12',
      rx: '4',
    }),
  );
  board.appendChild(group);
  return { element: board, pops: [], wipes: [group], strokes: [] };
}

/**
 * What the contribution settles.
 *
 * The headline is the reason the station exists, and the reach beside it is the
 * reason the contribution generalises: the model reads a composition and is
 * pointed at an attribute, and end-of-life circularity is the attribute it was
 * pointed at here. That claim is drawn at full size rather than listed, because
 * a mechanism tied to one attribute and a mechanism that takes any attribute
 * correlated with composition are two different contributions.
 *
 * Everything with a surface of its own enters as part of the build. A card that
 * is only ever faded with the panel arrives as an empty rectangle a beat before
 * anything is in it, which is what the swap into this beat used to look like.
 */
export function createReach(): Reach {
  const source = el('div', {
    className: 'rh-source',
    children: [el('span', { className: 'rh-source-label', text: SETTLES.reach.source })],
  });

  const spine = el('span', { className: 'rh-spine' });
  const stem = el('span', { className: 'rh-stem' });
  const branches: HTMLElement[] = [];
  const tags: HTMLElement[] = [];

  const attributes = SETTLES.reach.attributes.map((attribute) => {
    const branch = el('span', { className: 'rh-branch' });
    branches.push(branch);

    const children: Element[] = [
      branch,
      el('span', { className: 'rh-attribute-label', text: attribute.label }),
    ];
    if (attribute.measured) {
      const tag = el('span', { className: 'rh-attribute-tag', text: 'Measured here' });
      tags.push(tag);
      children.push(tag);
    }

    return el('div', {
      className: 'rh-attribute',
      attrs: { 'data-key': attribute.key, 'data-measured': String(attribute.measured) },
      children,
    });
  });

  const reachLabel = el('p', { className: 'rh-reach-label', text: SETTLES.reach.label });
  const reach = el('div', {
    className: 'rh-reach',
    children: [
      reachLabel,
      el('div', {
        className: 'rh-fan',
        children: [
          source,
          stem,
          el('div', { className: 'rh-branches', children: [spine, ...attributes] }),
        ],
      }),
    ],
  });

  const glyphs: Glyph[] = [];
  const claims: HTMLElement[] = [];
  const figures: HTMLElement[] = [];

  const points = SETTLES.points.map((point) => {
    const glyph = glyphFor(point.glyph);
    glyphs.push(glyph);

    const claim = el('p', { className: 'rh-claim', text: point.claim });
    claims.push(claim);
    const body: Element[] = [claim];

    if (point.figure) {
      const figure = el('span', { className: 'rh-figure', text: point.figure });
      figures.push(figure);
      body.push(figure);
    }

    return el('div', {
      className: 'rh-point',
      attrs: { 'data-key': point.key },
      children: [glyph.element, el('div', { className: 'rh-point-text', children: body })],
    });
  });

  const headline = el('p', { className: 'rh-headline', text: SETTLES.headline });
  const body = el('p', { className: 'rh-body-text', text: SETTLES.body });

  const element = el('div', {
    className: 'c4 rh',
    children: [
      el('div', {
        className: 'rh-column',
        children: [
          el('div', { className: 'rh-head', children: [headline, body] }),
          el('div', { className: 'rh-points', children: points }),
        ],
      }),
      reach,
    ],
  });

  const pops = glyphs.flatMap((glyph) => [...glyph.pops]);
  const wipes = glyphs.flatMap((glyph) => [...glyph.wipes]);
  const strokes = glyphs.flatMap((glyph) => [...glyph.strokes]);

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(
      [headline, body, reach, reachLabel, source, ...attributes, ...tags, ...points, ...claims, ...figures],
      { opacity: 1, x: 0, y: 0, scale: 1 },
    );
    gsap.set(pops, { opacity: 1, scale: 1, transformOrigin: 'center center' });
    gsap.set(wipes, { opacity: 1, scaleX: 1, transformOrigin: FUNNEL_ORIGIN });
    gsap.set(strokes, { opacity: 1, strokeDashoffset: -RING * 0.7 });
    gsap.set([stem, ...branches], { opacity: 1, scaleX: 1 });
    gsap.set(spine, { opacity: 1, scaleY: 1 });
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
            headline,
            { opacity: 0, y: 22, duration: seconds(DURATION.cinematic * 0.85), ease: EASE.enter },
            0,
          )
          .from(
            body,
            { opacity: 0, y: 14, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.normal * 0.85),
          )
          // The card arrives with its heading, never before it.
          .from(
            reach,
            {
              opacity: 0,
              y: 22,
              scale: 0.975,
              transformOrigin: 'center center',
              duration: seconds(DURATION.cinematic * 0.8),
              ease: EASE.enter,
            },
            seconds(DURATION.normal * 0.7),
          )
          .from(
            reachLabel,
            { opacity: 0, y: 10, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.normal * 0.85),
          )
          .from(
            source,
            { opacity: 0, x: -20, duration: seconds(DURATION.slow), ease: EASE.enter },
            seconds(DURATION.slow * 0.85),
          )
          .fromTo(
            stem,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.standard,
              transformOrigin: 'left center',
            },
            seconds(DURATION.slow * 1.15),
          )
          .fromTo(
            spine,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: seconds(DURATION.normal),
              ease: EASE.standard,
              transformOrigin: 'center center',
            },
            seconds(DURATION.slow * 1.3),
          )
          // Each branch is drawn out to the attribute it carries, and the
          // attribute lands on the end of it.
          .fromTo(
            branches,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.quick * 1.2),
              ease: EASE.standard,
              transformOrigin: 'left center',
              stagger: seconds(STAGGER * 1.8),
            },
            seconds(DURATION.slow * 1.45),
          )
          .from(
            attributes,
            {
              opacity: 0,
              x: 22,
              duration: seconds(DURATION.slow * 0.9),
              ease: 'power3.out',
              stagger: seconds(STAGGER * 1.8),
            },
            seconds(DURATION.slow * 1.52),
          )
          .from(
            tags,
            {
              opacity: 0,
              scale: 0.8,
              transformOrigin: 'right center',
              duration: seconds(DURATION.normal),
              ease: 'back.out(2.4)',
            },
            seconds(DURATION.cinematic * 1.1),
          )
          .from(
            points,
            {
              opacity: 0,
              y: 18,
              duration: seconds(DURATION.slow),
              ease: EASE.enter,
              stagger: seconds(STAGGER * 2.4),
            },
            seconds(DURATION.slow * 1.05),
          )
          .from(
            pops,
            {
              opacity: 0,
              scale: 0.55,
              transformOrigin: 'center center',
              duration: seconds(DURATION.slow),
              ease: 'back.out(2)',
            },
            seconds(DURATION.slow * 1.25),
          )
          .fromTo(
            wipes,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: seconds(DURATION.slow * 0.8),
              ease: 'power3.out',
              transformOrigin: FUNNEL_ORIGIN,
            },
            seconds(DURATION.cinematic * 0.72),
          )
          .fromTo(
            strokes,
            { strokeDashoffset: -RING * 0.7 - RING * 0.28 },
            {
              strokeDashoffset: -RING * 0.7,
              duration: seconds(DURATION.slow),
              ease: 'power2.inOut',
            },
            seconds(DURATION.slow * 1.5),
          )
          .from(
            figures,
            {
              opacity: 0,
              y: 8,
              duration: seconds(DURATION.normal),
              ease: 'back.out(1.8)',
              stagger: seconds(STAGGER * 2.4),
            },
            seconds(DURATION.cinematic * 0.95),
          )
      );
    },
  };
}
