import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { el } from '@/utilities/dom';
import './rate-track.css';

export interface RateMark {
  readonly value: number;
  /** Short, under the mark. `today`, `2030 target`. */
  readonly caption: string;
}

export interface RateTrackSpec {
  /** Top of the scale. Set it above the target so the target sits inside the frame. */
  readonly max: number;
  readonly unit?: string;
  readonly current: RateMark;
  readonly target: RateMark;
  /** Headline centred over the shortfall. */
  readonly delta?: string;
  /** Omit when the surrounding card already names the measure. */
  readonly title?: string;
  readonly source?: string;
}

export interface RateTrack {
  readonly element: HTMLElement;
  /** Draws the empty scale: rail and captions, no values. */
  prime(settle?: boolean): gsap.core.Timeline;
  /** Shows the measurement against the target. */
  play(settle?: boolean): gsap.core.Timeline;
}

const percent = (value: number, max: number): string => `${(value / max) * 100}%`;

/**
 * A measured rate against its policy target. Achieved rate is solid, the
 * shortfall hatched, the target a hard tick.
 */
export function createRateTrack(spec: RateTrackSpec): RateTrack {
  const { max, current, target } = spec;
  const unit = spec.unit ?? '';

  // Widths are set inline so tweens have a real end value to read.
  const fill = el('span', {
    className: 'rate-fill',
    attrs: { style: `width: ${percent(current.value, max)}` },
  });
  const shortfall = el('span', {
    className: 'rate-shortfall',
    attrs: {
      style: `left: ${percent(current.value, max)}; width: ${percent(target.value - current.value, max)}`,
    },
  });
  const tick = el('span', {
    className: 'rate-tick',
    attrs: { style: `left: ${percent(target.value, max)}` },
  });
  const rail = el('span', { className: 'rate-rail' });

  const readout = (mark: RateMark, kind: string): HTMLElement =>
    el('div', {
      className: 'rate-readout',
      attrs: { 'data-kind': kind, style: `left: ${percent(mark.value, max)}` },
      children: [
        el('p', { className: 'rate-readout-value', text: `${mark.value}${unit}` }),
        el('p', { className: 'rate-readout-caption', text: mark.caption }),
      ],
    });

  const currentReadout = readout(current, 'current');
  const targetReadout = readout(target, 'target');

  // Captions belong to the scale and show on `prime`. Values show on `play`.
  const captions = [currentReadout, targetReadout].map(
    (node) => node.querySelector<HTMLElement>('.rate-readout-caption')!,
  );
  const values = [currentReadout, targetReadout].map(
    (node) => node.querySelector<HTMLElement>('.rate-readout-value')!,
  );

  const delta = spec.delta
    ? el('p', {
        className: 'rate-delta',
        text: spec.delta,
        attrs: { style: `left: ${percent((current.value + target.value) / 2, max)}` },
      })
    : null;

  // Readouts sit inside the track so they are positioned against the bar.
  const track = el('div', {
    className: 'rate-track',
    children: [
      rail,
      shortfall,
      fill,
      tick,
      currentReadout,
      targetReadout,
      ...(delta ? [delta] : []),
    ],
  });

  const plot = el('div', { className: 'rate-plot', children: [track] });
  const title = spec.title ? el('p', { className: 'rate-title', text: spec.title }) : null;
  const source = spec.source ? el('p', { className: 'rate-source', text: spec.source }) : null;

  const element = el('div', {
    className: 'rate',
    children: [...(title ? [title] : []), plot, ...(source ? [source] : [])],
  });

  /*
   * Marks that appear on `play`. `fill` and `shortfall` are handled separately:
   * fill animates width, shortfall animates `scaleX`, marks animate `y`.
   */
  const marks = [tick, ...values, delta].filter((node): node is HTMLElement => node !== null);

  return {
    element,

    prime(settle = false) {
      const timeline = gsap.timeline();

      gsap.set(element, { opacity: 1, y: 0 });
      gsap.set(fill, { width: 0 });
      gsap.set(marks, { opacity: 0, y: 10 });
      gsap.set(shortfall, { opacity: 0, scaleX: 0 });
      gsap.set([currentReadout, targetReadout], { opacity: 1, y: 0 });

      if (settle) {
        gsap.set(rail, { scaleX: 1 });
        gsap.set(captions, { opacity: 1, y: 0 });
        return timeline;
      }

      return timeline
        .fromTo(
          rail,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: seconds(DURATION.cinematic * 0.6),
            ease: EASE.enter,
            transformOrigin: 'left center',
          },
        )
        .fromTo(
          captions,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: 0.08,
          },
          0.3,
        );
    },

    play(settle = false) {
      const timeline = gsap.timeline();

      gsap.set(rail, { scaleX: 1 });
      gsap.set([currentReadout, targetReadout], { opacity: 1, y: 0 });
      gsap.set(captions, { opacity: 1, y: 0 });

      if (settle) {
        gsap.set(element, { opacity: 1, y: 0 });
        gsap.set(fill, { width: percent(current.value, max) });
        gsap.set(marks, { opacity: 1, y: 0 });
        gsap.set(shortfall, { opacity: 1, scaleX: 1 });
        return timeline;
      }

      // Order: current value, target, then the shortfall between them.
      timeline
        .fromTo(
          fill,
          { width: 0 },
          {
            width: percent(current.value, max),
            duration: seconds(DURATION.cinematic * 0.7),
            ease: 'power2.out',
          },
          0,
        )
        .to(
          values[0]!,
          { opacity: 1, y: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
          '<0.42',
        )
        .to(
          [tick, values[1]!],
          {
            opacity: 1,
            y: 0,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: 0.06,
          },
          '>-0.1',
        )
        .to(
          shortfall,
          {
            opacity: 1,
            y: 0,
            scaleX: 1,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'left center',
          },
          '<',
        );

      if (delta) {
        timeline.to(
          delta,
          { opacity: 1, y: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
          '>-0.2',
        );
      }

      return timeline;
    },
  };
}
