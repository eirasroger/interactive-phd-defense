import gsap from 'gsap';
import { Color } from 'three';
import { EASE, seconds } from '@/animations/timing';
import type { Atmosphere } from './atmosphere';

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

  moveTo(target: Atmosphere, durationSeconds: number): void {
    this.kill();

    const duration = seconds(durationSeconds);
    if (duration <= 0) {
      this.snapTo(target);
      return;
    }

    const ease = EASE.standard;
    this.timeline = gsap
      .timeline({ onComplete: () => (this.timeline = null) })
      .to(this.state.fogColor, { ...channels(target.fogColor), duration, ease }, 0)
      .to(this.state.skyColor, { ...channels(target.skyColor), duration, ease }, 0)
      .to(this.state.groundColor, { ...channels(target.groundColor), duration, ease }, 0)
      .to(this.state.keyColor, { ...channels(target.keyColor), duration, ease }, 0)
      .to(this.state, { ...this.scalars(target), duration, ease }, 0);
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
