import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_DEFAULTS, ORIGIN_POSE } from '@/config/presentation';
import type { CameraPose, Vec3 } from './types';

/**
 * Holds the live camera and its current pose as plain numbers.
 *
 * The pose is stored as scalars rather than Vector3s so it can be tweened
 * directly by GSAP, which interpolates numeric properties. `apply()` pushes
 * those scalars onto the actual camera once per frame.
 *
 * **Position is tweened; orientation is swept.** During a move the look target
 * is not interpolated — the *view direction* is, along the shortest arc between
 * the two headings, at a rate that is even for the whole move. Lerping the
 * target point instead makes the turn rate depend on how far away the target
 * happens to be, so a move that ends on something close whips through the last
 * third of its turn while the numbers say it is easing out. That is a camera
 * artefact with no cause in the scene, and it is what makes a smooth-on-paper
 * transition feel like a lurch.
 *
 * The declared target is therefore honoured exactly at both ends of a move and
 * treated as a heading in between, which is what a camera on a head does.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;

  /** Mutable tween target. GSAP writes here; `apply` reads it. */
  readonly state = {
    px: ORIGIN_POSE.position[0],
    py: ORIGIN_POSE.position[1],
    pz: ORIGIN_POSE.position[2],
    /** The live look target. Written by `apply` while a move is in flight. */
    tx: ORIGIN_POSE.target[0],
    ty: ORIGIN_POSE.target[1],
    tz: ORIGIN_POSE.target[2],
    fov: ORIGIN_POSE.fov ?? CAMERA_DEFAULTS.fov,
    roll: 0,
    /** Height of the arc the camera lifts through, and progress along it. */
    arc: 0,
    phase: 0,
  };

  private readonly lookTarget = new Vector3();
  private readonly heading = new Vector3();
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly destination = new Vector3();
  private fromReach = 1;
  private toReach = 1;
  private moving = false;

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

  /**
   * Captures the two headings a move sweeps between, and resets its progress.
   *
   * Read from the live state rather than from the previous scene's declared
   * pose, so a move interrupted halfway sweeps on from where the camera
   * actually is instead of from where it was last told to be.
   */
  beginMove(pose: CameraPose): void {
    const s = this.state;
    this.fromReach = reach(this.from.set(s.tx - s.px, s.ty - s.py, s.tz - s.pz));
    this.toReach = reach(
      this.to.set(
        pose.target[0] - pose.position[0],
        pose.target[1] - pose.position[1],
        pose.target[2] - pose.position[2],
      ),
    );
    this.destination.set(pose.target[0], pose.target[1], pose.target[2]);
    this.moving = true;
    s.phase = 0;
  }

  /** Lands on the declared target exactly, whatever the last frame rounded to. */
  endMove(): void {
    const s = this.state;
    this.moving = false;
    s.arc = 0;
    s.phase = 0;
    s.tx = this.destination.x;
    s.ty = this.destination.y;
    s.tz = this.destination.z;
    this.apply();
  }

  apply(): void {
    const s = this.state;

    // A half-sine arc peaks mid-move and vanishes at both ends, so the lift
    // never displaces the declared start or end pose.
    const lift = s.arc === 0 ? 0 : Math.sin(s.phase * Math.PI) * s.arc;
    this.camera.position.set(s.px, s.py + lift, s.pz);

    if (this.moving) {
      slerp(this.from, this.to, s.phase, this.heading);
      this.lookTarget
        .copy(this.camera.position)
        .addScaledVector(this.heading, this.fromReach + (this.toReach - this.fromReach) * s.phase);
      s.tx = this.lookTarget.x;
      s.ty = this.lookTarget.y;
      s.tz = this.lookTarget.z;
    } else {
      this.lookTarget.set(s.tx, s.ty, s.tz);
    }

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
    s.arc = 0;
    s.phase = 0;
    this.moving = false;
    this.apply();
  }

  currentPose(): CameraPose {
    const s = this.state;
    return {
      position: [s.px, s.py, s.pz] as Vec3,
      target: [s.tx, s.ty, s.tz] as Vec3,
      fov: s.fov,
      roll: s.roll,
    };
  }
}

/** Normalises in place and returns the length it had. */
function reach(vector: Vector3): number {
  const length = vector.length();
  if (length < 1e-6) {
    vector.set(0, 0, -1);
    return 1;
  }
  vector.divideScalar(length);
  return length;
}

/**
 * Constant-rate interpolation between two unit headings.
 *
 * Falls back to a normalised lerp when the two are nearly parallel, where the
 * arc is shorter than the precision of the angle it would be divided by, and
 * when they are nearly opposed, where the arc is not unique. Neither case has a
 * visible difference; both have a division by zero.
 */
function slerp(from: Vector3, to: Vector3, t: number, out: Vector3): Vector3 {
  const cosine = Math.min(Math.max(from.dot(to), -1), 1);
  const theta = Math.acos(cosine);

  if (theta < 1e-3 || Math.PI - theta < 1e-3) {
    return out.copy(from).lerp(to, t).normalize();
  }

  const sine = Math.sin(theta);
  return out
    .copy(from)
    .multiplyScalar(Math.sin((1 - t) * theta) / sine)
    .addScaledVector(to, Math.sin(t * theta) / sine);
}
