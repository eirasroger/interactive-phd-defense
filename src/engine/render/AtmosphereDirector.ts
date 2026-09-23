import gsap from 'gsap';
import { Color } from 'three';
import { EASE, seconds } from '@/animations/timing';
import type { Atmosphere } from './atmosphere';

/**
 * Crossing light timing, as fractions of the crossing (0 to 1).
 *
 * `lift`: time for the outgoing atmosphere to return to full strength.
 * `from`/`to`: window for the change to the incoming atmosphere.
 */
export interface CrossTiming {
  readonly lift: number;
  readonly from: number;
  readonly to: number;
}

/** Mutable, tweenable form of an `Atmosphere`. */
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
 * Tweens or snaps the world between atmospheres. Same model as
 * `CameraDirector`: one timeline at a time, and a new move kills the previous
 * one. Colours are tweened per RGB channel.
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

  /** `ease` lets a zone crossing use a front-loaded curve. */
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

  /** Adds tweens for every channel of `target` to `timeline`, starting at `at`. */
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
   * Zone crossing in two legs. First lift to `via` (the outgoing zone at full
   * strength, since the last scene is often `recessed`). Then change to
   * `target` inside the `timing` window, placed while the camera is in the
   * vestibule between the doorway and the outdoor release.
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
    // Same timeline, so `kill()` stops both legs.
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
