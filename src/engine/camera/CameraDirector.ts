import gsap from 'gsap';
import { CAMERA_DEFAULTS } from '@/config/presentation';
import { EASE, seconds } from '@/animations/timing';
import type { CameraRig } from './CameraRig';
import type { CameraMoveOptions, CameraPose } from './types';

/**
 * Moves the camera between declared poses.
 *
 * A single tween owns the camera at any moment; starting a new move kills the
 * previous one rather than queueing behind it, so a presenter pressing ahead
 * mid-flight is never left waiting for an animation they have moved past.
 */
export class CameraDirector {
  private tween: gsap.core.Tween | null = null;

  constructor(private readonly rig: CameraRig) {}

  get isMoving(): boolean {
    return this.tween?.isActive() ?? false;
  }

  snapTo(pose: CameraPose): void {
    this.kill();
    this.rig.snapTo(pose);
  }

  moveTo(pose: CameraPose, options: CameraMoveOptions): void {
    this.kill();

    const s = this.rig.state;
    const duration = seconds(options.seconds);

    if (duration <= 0) {
      this.rig.snapTo(pose);
      return;
    }

    s.arcAmount = pose.arc ?? 0;
    s.arcPhase = 0;

    this.tween = gsap.to(s, {
      px: pose.position[0],
      py: pose.position[1],
      pz: pose.position[2],
      tx: pose.target[0],
      ty: pose.target[1],
      tz: pose.target[2],
      fov: pose.fov ?? CAMERA_DEFAULTS.fov,
      roll: pose.roll ?? 0,
      arcPhase: 1,
      duration,
      ease: options.ease ?? EASE.camera,
      onComplete: () => {
        s.arcAmount = 0;
        s.arcPhase = 0;
        this.tween = null;
      },
    });
  }

  kill(): void {
    this.tween?.kill();
    this.tween = null;
  }
}
