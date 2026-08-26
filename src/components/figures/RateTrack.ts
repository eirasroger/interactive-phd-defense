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
  /**
   * Optional, because the composition around it may already name the measure.
   * A figure printing its own title under the label that names it is the sort
   * of duplication a committee reads instead of listening.
   */
  readonly title?: string;
  readonly source?: string;
}

export interface RateTrack {
  readonly element: HTMLElement;
  /**
   * The scale, empty.
   *
   * The frame a beat arrives into should already be the one the audience is
   * looking at, so the rail is drawn and the marks it carries are not. Without
   * this the composition has to reserve the height and leave it blank, which is
   * a hole in a card rather than a figure waiting to be filled.
   */
  prime(settle?: boolean): gsap.core.Timeline;
  /** The measurement, against the target it has to reach. */
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

  /*
   * The scale's own furniture, apart from the measurement it carries.
   *
   * A caption naming which end of the axis is which is part of the scale; the
   * number standing over it is the reading. `prime` shows the first and holds
   * the second, so the empty figure is a labelled axis rather than a bare line
   * with a hundred pixels of nothing above it.
   */
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
  const title = spec.title ? el('p', { className: 'rate-title', text: spec.title }) : null;
  const source = spec.source ? el('p', { className: 'rate-source', text: spec.source }) : null;

  const element = el('div', {
    className: 'rate',
    children: [...(title ? [title] : []), plot, ...(source ? [source] : [])],
  });

  /*
   * What arrives on the measurement, and what was already on the axis.
   *
   * `fill` is in neither: its width is the measurement, so settling writes that
   * width back rather than clearing what the tween left. And the two groups are
   * separated because they take different properties — the shortfall opens by
   * `scaleX`, everything else rises by `y`, and priming them together left the
   * readouts at `scaleX: 0` and invisible.
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

      // In the order the claim is made: this is where we are, this is where we
      // must be, that space between is the problem. The scale itself is already
      // on screen — `prime` drew it when the card arrived.
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
