import gsap from 'gsap';
import { Color } from 'three';
import { EASE, seconds } from '@/animations/timing';
import type { Atmosphere } from './atmosphere';

/**
 * When, as fractions of a crossing, the light does what.
 *
 * `lift` — how long the outgoing world takes to come back to full strength.
 * `from`/`to` — the window the change into the incoming world happens in.
 */
export interface CrossTiming {
  readonly lift: number;
  readonly from: number;
  readonly to: number;
}

/** The interpolated form of an `Atmosphere`, held as mutable channels. */
export interface AtmosphereState {
  readonly fogColor: Color;
  readonly skyColor: Color;
  readonly groundColor: Color;
  readonly keyColor: Color;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  keyIntensity: number;
  keyX: number;
  keyY: number;
  keyZ: number;
  environmentIntensity: number;
  backgroundIntensity: number;
  exposure: number;
}

/**
 * Moves the world between declared atmospheres.
 *
 * Mirrors `CameraDirector` deliberately: one tween owns the atmosphere at a
 * time, a new move kills the previous one, and the same target can be reached
 * by a cinematic tween or an instant snap without the zone knowing which
 * happened. Colours are interpolated as channels because a hex integer is not a
 * meaningful thing to tween.
 */
export class AtmosphereDirector {
  readonly state: AtmosphereState = {
    fogColor: new Color(),
    skyColor: new Color(),
    groundColor: new Color(),
    keyColor: new Color(),
    fogNear: 1,
    fogFar: 100,
    ambientIntensity: 0,
    keyIntensity: 0,
    keyX: 0,
    keyY: 1,
    keyZ: 0,
    environmentIntensity: 0,
    backgroundIntensity: 1,
    exposure: 1,
  };

  private timeline: gsap.core.Timeline | null = null;

  snapTo(target: Atmosphere): void {
    this.kill();
    const { state } = this;
    state.fogColor.setHex(target.fogColor);
    state.skyColor.setHex(target.skyColor);
    state.groundColor.setHex(target.groundColor);
    state.keyColor.setHex(target.keyColor);
    Object.assign(state, this.scalars(target));
  }

  /**
   * `ease` overrides the default only where the change is itself the subject.
   *
   * A zone crossing wants a front-loaded curve — the outgoing light holding
   * while the camera is still in it, then giving way — which is what an eye
   * adapting looks like and what a symmetric ease cannot produce.
   */
  moveTo(target: Atmosphere, durationSeconds: number, ease: gsap.EaseString = EASE.standard): void {
    this.kill();

    const duration = seconds(durationSeconds);
    if (duration <= 0) {
      this.snapTo(target);
      return;
    }

    this.timeline = gsap.timeline({ onComplete: () => (this.timeline = null) });
    this.append(this.timeline, target, duration, ease, 0);
  }

  /** Every channel of one atmosphere, laid onto a timeline starting at `at`. */
  private append(
    timeline: gsap.core.Timeline,
    target: Atmosphere,
    duration: number,
    ease: gsap.EaseString,
    at: number,
  ): void {
    timeline
      .to(this.state.fogColor, { ...channels(target.fogColor), duration, ease }, at)
      .to(this.state.skyColor, { ...channels(target.skyColor), duration, ease }, at)
      .to(this.state.groundColor, { ...channels(target.groundColor), duration, ease }, at)
      .to(this.state.keyColor, { ...channels(target.keyColor), duration, ease }, at)
      .to(this.state, { ...this.scalars(target), duration, ease }, at);
  }

  /**
   * Two legs: out to `via`, then on to `target` over a declared window.
   *
   * For a zone crossing, where a single interpolation gets the whole shape
   * wrong in two separate ways.
   *
   * **The scene being left is usually `recessed`.** Act I ends on the widest
   * composition in the act, dimmed so the text can carry it, and a straight
   * tween from there to the interior means the approach — the one hero frame of
   * the transition — plays at three-quarter exposure with the key at half. The
   * building the audience is about to walk into looks like weather. So the
   * first leg lifts the world back to the zone it is *in*, at full strength,
   * which reads as the composition letting go of the frame.
   *
   * **And the change of light has a place, not just a curve.** Spread across
   * the whole move it is either fogging the forecourt or still carrying the
   * outdoors while the camera is inside — and the second failure is the one
   * that shows, because the handover happens behind a wall and the frame after
   * it would have been sixty metres of unfogged corridor. `timing` puts the
   * change where it physically belongs: after the doorway is behind the camera
   * and before the outdoors stops being drawn, which is the nine metres of
   * vestibule in between.
   */
  crossTo(via: Atmosphere, target: Atmosphere, durationSeconds: number, timing: CrossTiming): void {
    const total = seconds(durationSeconds);
    if (total <= 0) {
      this.snapTo(target);
      return;
    }

    this.moveTo(via, total * timing.lift, EASE.enter);

    const timeline = this.timeline;
    if (!timeline) return;
    // Chained on the same timeline, so `kill()` still stops the whole crossing
    // and one navigation mid-flight abandons both legs together.
    this.append(
      timeline,
      target,
      total * (timing.to - timing.from),
      EASE.standard,
      total * timing.from,
    );
  }

  kill(): void {
    this.timeline?.kill();
    this.timeline = null;
  }

  private scalars(target: Atmosphere) {
    return {
      fogNear: target.fogNear,
      fogFar: target.fogFar,
      ambientIntensity: target.ambientIntensity,
      keyIntensity: target.keyIntensity,
      keyX: target.keyOffset[0],
      keyY: target.keyOffset[1],
      keyZ: target.keyOffset[2],
      environmentIntensity: target.environmentIntensity,
      backgroundIntensity: target.backgroundIntensity,
      exposure: target.exposure,
    };
  }
}

const scratch = new Color();

const channels = (hex: number): { r: number; g: number; b: number } => {
  scratch.setHex(hex);
  return { r: scratch.r, g: scratch.g, b: scratch.b };
};
