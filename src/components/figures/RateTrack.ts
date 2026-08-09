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
  /** Top of the scale. Choose it so the target sits inside the frame, not on it. */
  readonly max: number;
  readonly unit?: string;
  readonly current: RateMark;
  readonly target: RateMark;
  /** Headline centred over the shortfall. */
  readonly delta?: string;
  readonly title: string;
  readonly source?: string;
}

export interface RateTrack {
  readonly element: HTMLElement;
  play(settle?: boolean): gsap.core.Timeline;
}

const percent = (value: number, max: number): string => `${(value / max) * 100}%`;

/**
 * Where a measure stands against where policy requires it to stand.
 *
 * The distance between the two marks is the argument, so it is drawn as
 * occupied space: achieved rate solid, shortfall hatched, target a hard edge.
 */
export function createRateTrack(spec: RateTrackSpec): RateTrack {
  const { max, current, target } = spec;
  const unit = spec.unit ?? '';

  // Widths are inline, not tween targets: `from` reads the computed value as
  // its destination, and an absolutely positioned span with no width is zero.
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

  const delta = spec.delta
    ? el('p', {
        className: 'rate-delta',
        text: spec.delta,
        attrs: { style: `left: ${percent((current.value + target.value) / 2, max)}` },
      })
    : null;

  // Readouts sit inside the track so they are positioned against the bar they
  // annotate rather than against the panel.
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
  const title = el('p', { className: 'rate-title', text: spec.title });
  const source = spec.source ? el('p', { className: 'rate-source', text: spec.source }) : null;

  const element = el('div', {
    className: 'rate',
    children: [title, plot, ...(source ? [source] : [])],
  });

  // `fill` is excluded: its width is the measurement, so settling writes that
  // width back rather than clearing what the tween left.
  const arriving = [shortfall, tick, currentReadout, targetReadout, delta].filter(
    (node): node is HTMLElement => node !== null,
  );

  return {
    element,
    play(settle = false) {
      const timeline = gsap.timeline();

      if (settle) {
        gsap.set(element, { opacity: 1, y: 0 });
        gsap.set(rail, { scaleX: 1 });
        gsap.set(fill, { width: percent(current.value, max) });
        gsap.set(arriving, { opacity: 1, y: 0, scaleX: 1 });
        return timeline;
      }

      // In the order the claim is made: the scale exists, this is where we
      // are, this is where we must be, that space between is the problem.
      timeline
        .from(element, { opacity: 0, y: 32, duration: seconds(DURATION.slow), ease: EASE.enter })
        .from(rail, { scaleX: 0, duration: seconds(DURATION.cinematic * 0.6), ease: EASE.enter }, 0)
        .fromTo(
          fill,
          { width: 0 },
          {
            width: percent(current.value, max),
            duration: seconds(DURATION.cinematic * 0.7),
            ease: 'power2.out',
          },
          seconds(DURATION.quick),
        )
        .from(
          currentReadout,
          { opacity: 0, y: 10, duration: seconds(DURATION.normal), ease: EASE.enter },
          '<0.35',
        )
        .from(
          [tick, targetReadout],
          {
            opacity: 0,
            y: 10,
            duration: seconds(DURATION.normal),
            ease: EASE.enter,
            stagger: 0.06,
          },
          '>-0.1',
        )
        .from(
          shortfall,
          {
            scaleX: 0,
            duration: seconds(DURATION.slow),
            ease: EASE.enter,
            transformOrigin: 'left center',
          },
          '<',
        );

      if (delta) {
        timeline.from(
          delta,
          { opacity: 0, duration: seconds(DURATION.normal), ease: EASE.enter },
          '>-0.2',
        );
      }

      return timeline;
    },
  };
}
