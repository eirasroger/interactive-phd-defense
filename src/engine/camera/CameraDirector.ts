import gsap from 'gsap';
import type { PerspectiveCamera } from 'three';
import { CAMERA_DEFAULTS, TRANSITION } from '@/config/presentation';
import { EASE, seconds } from '@/animations/timing';
import { LEAD, levelTravel, turnOffAt, type CameraRig } from './CameraRig';
import type { CameraMoveOptions, CameraPose, Vec3 } from './types';

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

  /**
   * The camera itself, for scenes that tether DOM to a point in the world.
   * Read-only by convention: posing it is this director's business, and a scene
   * that moved it would be fighting the move it was handed.
   */
  get camera(): PerspectiveCamera {
    return this.rig.camera;
  }

  get isMoving(): boolean {
    return this.tween?.isActive() ?? false;
  }

  snapTo(pose: CameraPose): void {
    this.kill();
    this.rig.snapTo(pose);
  }

  /** Moves to a pose and returns the duration, which the deck paces content against. */
  moveTo(pose: CameraPose, options: CameraMoveOptions = {}): number {
    this.kill();

    const s = this.rig.state;
    const from = this.rig.currentPose();
    const duration = seconds(options.seconds ?? paceOf(from, pose));

    if (duration <= 0) {
      this.rig.snapTo(pose);
      return 0;
    }

    s.arc = pose.arc ?? 0;
    this.rig.beginMove(pose, duration);

    // Only the position, the lens and the progress are tweened. The look
    // target is the rig's own business for the length of the move — see
    // `CameraRig` for why interpolating it here is what made the turns lurch.
    this.tween = gsap.to(s, {
      px: pose.position[0],
      py: pose.position[1],
      pz: pose.position[2],
      fov: pose.fov ?? CAMERA_DEFAULTS.fov,
      roll: pose.roll ?? 0,
      phase: 1,
      duration,
      ease: options.ease ?? EASE.camera,
      onComplete: () => {
        this.rig.endMove();
        this.tween = null;
      },
    });

    return duration;
  }

  kill(): void {
    this.tween?.kill();
    this.tween = null;
  }
}

/**
 * How long a move should take, from how far it travels and how far it turns.
 *
 * Two budgets rather than one, and the longer wins. They are not the same
 * quantity: a hundred metres flown along a heading is a landscape passing, and
 * a hundred degrees turned on the spot is the whole world sweeping across the
 * frame. Rate-limiting only the distance leaves the turns as fast as the deck's
 * shortest hop allows, which is exactly the move that reads as violent.
 */
function paceOf(from: CameraPose, to: CameraPose): number {
  const { metresPerSecond, degreesPerSecond, minSeconds, maxSeconds } = TRANSITION.camera;

  const distance = to.via
    ? length(delta(from.position, to.via)) + length(delta(to.via, to.position))
    : length(delta(from.position, to.position));

  const lead = to.approach === 'lead' ? levelTravel(from.position, to.position) : null;

  if (!lead) {
    const swing = arcBetween(headingOf(from), headingOf(to));
    const wanted = Math.max(distance / metresPerSecond, swing / degreesPerSecond);
    return Math.min(maxSeconds, Math.max(minSeconds, wanted));
  }

  const arriving = arcBetween(lead, headingOf(to));
  const turnsOnArrival = arriving > (LEAD.minArrival * 180) / Math.PI;
  const offAt = turnOffAt(from.position, to.position);

  const onto = arcBetween(headingOf(from), lead) / (LEAD.degreesPerSecond * LEAD.onto);
  const off = turnsOnArrival ? arriving / (LEAD.degreesPerSecond * (1 - offAt)) : 0;

  const wanted = Math.max(distance / metresPerSecond, onto, off);
  return Math.min(LEAD.maxSeconds, Math.max(minSeconds, wanted));
}

const arcBetween = (a: Vec3, b: Vec3): number => (Math.acos(dot(a, b)) * 180) / Math.PI;

function headingOf(pose: CameraPose): Vec3 {
  const heading = delta(pose.position, pose.target);
  const reach = length(heading) || 1;
  return [heading[0] / reach, heading[1] / reach, heading[2] / reach];
}

const delta = (a: Vec3, b: Vec3): Vec3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
const dot = (a: Vec3, b: Vec3): number =>
  Math.min(Math.max(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1), 1);
