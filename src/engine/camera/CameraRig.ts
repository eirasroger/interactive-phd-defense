import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_DEFAULTS, ORIGIN_POSE } from '@/config/presentation';
import type { CameraPose } from './types';

/**
 * Holds the live camera and its current pose as plain numbers.
 *
 * The pose is stored as scalars rather than Vector3s so it can be tweened
 * directly by GSAP, which interpolates numeric properties. `apply()` pushes
 * those scalars onto the actual camera once per frame.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;

  /** Mutable tween target. GSAP writes here; `apply` reads it. */
  readonly state = {
    px: ORIGIN_POSE.position[0],
    py: ORIGIN_POSE.position[1],
    pz: ORIGIN_POSE.position[2],
    tx: ORIGIN_POSE.target[0],
    ty: ORIGIN_POSE.target[1],
    tz: ORIGIN_POSE.target[2],
    fov: ORIGIN_POSE.fov ?? CAMERA_DEFAULTS.fov,
    roll: 0,
    /** Progress along the current move, used to evaluate the arc. */
    arcAmount: 0,
    arcPhase: 0,
  };

  private readonly lookTarget = new Vector3();

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(
      CAMERA_DEFAULTS.fov,
      aspect,
      CAMERA_DEFAULTS.near,
      CAMERA_DEFAULTS.far,
    );
    this.apply();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  apply(): void {
    const s = this.state;

    // A half-sine arc peaks mid-move and vanishes at both ends, so the lift
    // never displaces the declared start or end pose.
    const lift = s.arcAmount === 0 ? 0 : Math.sin(s.arcPhase * Math.PI) * s.arcAmount;

    this.camera.position.set(s.px, s.py + lift, s.pz);
    this.lookTarget.set(s.tx, s.ty, s.tz);
    this.camera.lookAt(this.lookTarget);

    if (s.roll !== 0) this.camera.rotateZ(s.roll);

    if (this.camera.fov !== s.fov) {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Writes a pose immediately, with no interpolation. */
  snapTo(pose: CameraPose): void {
    const s = this.state;
    [s.px, s.py, s.pz] = pose.position;
    [s.tx, s.ty, s.tz] = pose.target;
    s.fov = pose.fov ?? CAMERA_DEFAULTS.fov;
    s.roll = pose.roll ?? 0;
    s.arcAmount = 0;
    s.arcPhase = 0;
    this.apply();
  }

  currentPose(): CameraPose {
    const s = this.state;
    return {
      position: [s.px, s.py, s.pz],
      target: [s.tx, s.ty, s.tz],
      fov: s.fov,
      roll: s.roll,
    };
  }
}
