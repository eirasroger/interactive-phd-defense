import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';
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
  private readonly via = new Vector3();
  private readonly destination = new Vector3();
  private fromReach = 1;
  private toReach = 1;
  private moving = false;
  private leading = false;
  private offAt: number = LEAD.off;
  private ontoAt: number = LEAD.onto;
  private route: CatmullRomCurve3 | null = null;
  private readonly waypoint = new Vector3();
  private parkedVia: Vec3 | null = null;

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
  beginMove(pose: CameraPose, duration = 0): void {
    const s = this.state;
    this.fromReach = reach(this.from.set(s.tx - s.px, s.ty - s.py, s.tz - s.pz));
    this.toReach = reach(
      this.to.set(
        pose.target[0] - pose.position[0],
        pose.target[1] - pose.position[1],
        pose.target[2] - pose.position[2],
      ),
    );
    const here: Vec3 = [s.px, s.py, s.pz];
    this.route = this.routeFor(here, pose);
    this.parkedVia = pose.via ?? null;

    const travel = levelTravel(here, pose.position);
    if (travel) this.via.set(travel[0], travel[1], travel[2]);
    if (travel && this.route) {
      this.route.getTangentAt(0.5, this.waypoint);
      this.waypoint.y = 0;
      if (this.waypoint.lengthSq() > 1e-6) this.via.copy(this.waypoint).normalize();
    }

    this.leading = pose.approach === 'lead' && travel !== null;

    const turnsOnArrival = angleBetween(this.via, this.to) > LEAD.minArrival;
    this.offAt = turnsOnArrival ? turnOffAt(here, pose.position) : 1;
    this.ontoAt = turnsOnArrival
      ? Math.min(LEAD.onto, this.offAt - LEAD.minHold)
      : turnShare(angleBetween(this.from, this.via), duration);

    this.destination.set(pose.target[0], pose.target[1], pose.target[2]);
    this.moving = true;
    s.phase = 0;
  }

  private routeFor(from: Vec3, pose: CameraPose): CatmullRomCurve3 | null {
    if (!pose.via) return null;

    const points = [new Vector3(from[0], from[1], from[2])];
    const push = (point: Vec3): void => {
      const next = new Vector3(point[0], point[1], point[2]);
      const last = points[points.length - 1] as Vector3;
      if (next.distanceTo(last) > 0.05) points.push(next);
    };

    if (this.parkedVia) push(this.parkedVia);
    push(pose.via);
    push(pose.position);

    if (points.length < 3) return null;
    return new CatmullRomCurve3(points, false, 'catmullrom', 0.05);
  }

  /** Lands on the declared target exactly, whatever the last frame rounded to. */
  endMove(): void {
    const s = this.state;
    this.moving = false;
    this.route = null;
    s.arc = 0;
    s.phase = 0;
    s.tx = this.destination.x;
    s.ty = this.destination.y;
    s.tz = this.destination.z;
    this.apply();
  }

  apply(): void {
    const s = this.state;

    if (this.moving && this.route) {
      this.route.getPointAt(Math.min(Math.max(s.phase, 0), 1), this.waypoint);
      s.px = this.waypoint.x;
      s.py = this.waypoint.y;
      s.pz = this.waypoint.z;
    }

    // A half-sine arc peaks mid-move and vanishes at both ends, so the lift
    // never displaces the declared start or end pose.
    const lift = s.arc === 0 ? 0 : Math.sin(s.phase * Math.PI) * s.arc;
    this.camera.position.set(s.px, s.py + lift, s.pz);

    if (this.moving) {
      this.sweep(s.phase);
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

  private sweep(phase: number): void {
    if (!this.leading) {
      slerp(this.from, this.to, phase, this.heading);
      return;
    }

    const { ontoAt, offAt: off } = this;
    if (phase <= ontoAt) {
      slerp(this.from, this.via, settle(phase / ontoAt), this.heading);
    } else if (phase < off) {
      this.heading.copy(this.via);
    } else {
      slerp(this.via, this.to, settle((phase - off) / (1 - off)), this.heading);
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
    this.route = null;
    this.parkedVia = pose.via ?? null;
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

export const LEAD = {
  onto: 0.3,
  turnWithin: 10,
  off: 0.5,
  offMax: 0.9,
  minTravel: 1.5,
  degreesPerSecond: 70,
  maxSeconds: 6,
  minArrival: 0.15,
  turnFirst: 0.7,
  minHold: 0.15,
} as const;

export function levelTravel(from: Vec3, to: Vec3): Vec3 | null {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const flat = Math.hypot(dx, dz);
  if (flat < LEAD.minTravel) return null;
  return [dx / flat, 0, dz / flat];
}

function turnShare(turn: number, duration: number): number {
  if (duration <= 0) return LEAD.onto;
  const seconds = (turn * 180) / Math.PI / LEAD.degreesPerSecond;
  return Math.min(LEAD.turnFirst, Math.max(LEAD.onto, seconds / duration));
}

export function angleBetween(a: Vector3, b: Vector3): number {
  return Math.acos(Math.min(Math.max(a.dot(b), -1), 1));
}

export function turnOffAt(from: Vec3, to: Vec3): number {
  const flat = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const wanted = 1 - LEAD.turnWithin / Math.max(flat, 1e-3);
  return Math.min(LEAD.offMax, Math.max(LEAD.off, wanted));
}

const settle = (t: number): number => {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
};

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
const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);

function slerp(from: Vector3, to: Vector3, t: number, out: Vector3): Vector3 {
  const cosine = Math.min(Math.max(from.dot(to), -1), 1);
  const theta = Math.acos(cosine);

  if (theta < 1e-3) {
    return out.copy(to);
  }

  if (Math.PI - theta < 1e-3) {
    const axis = Math.abs(from.y) > 0.99 ? SIDE : UP;
    return out.copy(from).applyAxisAngle(axis, Math.PI * t);
  }

  const sine = Math.sin(theta);
  return out
    .copy(from)
    .multiplyScalar(Math.sin((1 - t) * theta) / sine)
    .addScaledVector(to, Math.sin(t * theta) / sine);
}
