import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { SETTLES, type Settlement } from '@/content/c5';
import { el, svg } from '@/utilities/dom';
import './c5-palette.css';
import './settle.css';

export interface Settle {
  readonly element: HTMLElement;
  readonly beats: number;
  play(step: number, settle: boolean): gsap.core.Timeline | null;
}

interface Glyph {
  readonly element: SVGSVGElement;
  /** Opened from their own centre, for a mark whose meaning is a range. */
  readonly opens: readonly SVGElement[];
  /** Scaled up into place, for a mark whose meaning is a single value. */
  readonly pops: readonly SVGElement[];
  /** Rotated about a pivot, for a mark whose meaning is a comparison. */
  readonly tips: readonly SVGElement[];
}

/**
 * One mark per claim, drawn rather than illustrated.
 *
 * The first is the consensus beat in miniature, a band opening and a value
 * landing inside it, so the glyph and the picture two beats back are the same
 * drawing. The beam tips because the claim beside it is that one method
 * separates what another leaves level.
 */
function glyphFor(kind: Settlement['glyph']): Glyph {
  const board = svg('svg', { class: 'sx-glyph', viewBox: '0 0 64 64' });

  if (kind === 'bands') {
    const band = svg('rect', {
      class: 'sx-band',
      x: '4',
      y: '24',
      width: '56',
      height: '16',
      rx: '8',
    });
    const mark = svg('circle', { class: 'sx-inside', cx: '44', cy: '32', r: '7' });
    board.append(band, mark);
    return { element: board, opens: [band], pops: [mark], tips: [] };
  }

  const beam = svg('rect', {
    class: 'sx-beam',
    x: '8',
    y: '26',
    width: '48',
    height: '4',
    rx: '2',
  });
  const pivot = svg('path', { class: 'sx-pivot', d: 'M 32 28 L 41 52 L 23 52 Z' });
  board.append(beam, pivot);
  return { element: board, opens: [pivot], pops: [], tips: [beam] };
}

/**
 * What the contribution settles.
 *
 * The headline is the reason the station exists. Beside it, at full size, is
 * what carries to another product category and what has to be written again,
 * because a method that works for concrete and a method that works for
 * construction products are two different contributions and the difference is
 * the last thing the audience should take out of the corridor.
 *
 * Every surface enters as part of the build. A card that is only faded with the
 * panel arrives as an empty rectangle before anything is in it.
 */
export function createSettle(): Settle {
  const headline = el('p', { className: 'sx-headline', text: SETTLES.headline });
  const body = el('p', { className: 'sx-body', text: SETTLES.body });

  const glyphs: Glyph[] = [];
  const claims: HTMLElement[] = [];
  const figures: HTMLElement[] = [];

  const points = SETTLES.points.map((point) => {
    const glyph = glyphFor(point.glyph);
    glyphs.push(glyph);

    const claim = el('p', { className: 'sx-claim', text: point.claim });
    claims.push(claim);
    const figure = el('span', { className: 'sx-figure', text: point.figure });
    figures.push(figure);

    return el('div', {
      className: 'sx-point',
      attrs: { 'data-key': point.key },
      children: [
        glyph.element,
        el('div', { className: 'sx-point-text', children: [claim, figure] }),
      ],
    });
  });

  const rows = SETTLES.reach.components.map((component) =>
    el('div', {
      className: 'sx-component',
      attrs: { 'data-status': component.status },
      children: [
        el('span', { className: 'sx-component-mark' }),
        el('div', {
          className: 'sx-component-text',
          children: [
            el('p', { className: 'sx-component-label', text: component.label }),
            el('p', { className: 'sx-component-note', text: component.note }),
          ],
        }),
      ],
    }),
  );

  const reachLabel = el('p', { className: 'sx-reach-label', text: SETTLES.reach.label });
  const evaluated = el('span', {
    className: 'sx-evaluated',
    text: `${SETTLES.reach.evaluated}, evaluated here`,
  });

  const reach = el('div', {
    className: 'sx-reach',
    children: [
      el('div', {
        className: 'sx-reach-head',
        children: [reachLabel, evaluated],
      }),
      el('div', { className: 'sx-components', children: rows }),
    ],
  });

  const element = el('div', {
    className: 'c5 sx',
    children: [
      el('div', {
        className: 'sx-column',
        children: [
          el('div', { className: 'sx-head', children: [headline, body] }),
          el('div', { className: 'sx-points', children: points }),
        ],
      }),
      reach,
    ],
  });

  const opens = glyphs.flatMap((glyph) => [...glyph.opens]);
  const pops = glyphs.flatMap((glyph) => [...glyph.pops]);
  const tips = glyphs.flatMap((glyph) => [...glyph.tips]);

  const settleTo = (): void => {
    gsap.set(element, { opacity: 1 });
    gsap.set(
      [headline, body, reach, reachLabel, evaluated, ...rows, ...points, ...claims, ...figures],
      { opacity: 1, x: 0, y: 0, scale: 1 },
    );
    gsap.set(opens, { opacity: 1, scaleX: 1, transformOrigin: 'center center' });
    gsap.set(pops, { opacity: 1, scale: 1, transformOrigin: 'center center' });
    gsap.set(tips, { opacity: 1, rotation: -7, transformOrigin: 'center center' });
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
          [reachLabel, evaluated],
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            stagger: seconds(STAGGER * 1.5),
          },
          seconds(DURATION.normal * 0.9),
        )
        .from(
          rows,
          {
            opacity: 0,
            x: 20,
            duration: seconds(DURATION.slow),
            ease: 'power3.out',
            stagger: seconds(STAGGER * 2),
          },
          seconds(DURATION.slow * 1.1),
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
        .fromTo(
          opens,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: 'center center',
            duration: seconds(DURATION.slow),
            ease: 'back.out(1.8)',
            stagger: seconds(STAGGER * 2),
          },
          seconds(DURATION.slow * 1.25),
        )
        .fromTo(
          pops,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            transformOrigin: 'center center',
            duration: seconds(DURATION.normal),
            ease: 'back.out(2.6)',
          },
          seconds(DURATION.slow * 1.5),
        )
        // The beam settles off level, because the claim beside it is that the
        // two methods part company below the leading product.
        .fromTo(
          tips,
          { rotation: 0 },
          {
            rotation: -7,
            transformOrigin: 'center center',
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
          },
          seconds(DURATION.cinematic * 0.95),
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
        );
    },
  };
}
