/**
 * Ease for the camera move through the building entrance. It covers the long
 * approach fast and slows down at the doors. Defined as a speed profile and
 * integrated into a lookup table:
 *
 * - `LAUNCH`: accelerate out of rest.
 * - `HOLD`: run at full speed.
 * - after `HOLD`: quadratic decay to zero.
 *
 * About 58% of the distance is covered in the first third of the time.
 */

/** Acceleration time, as a fraction of the move (0 to 1). */
const LAUNCH = 0.12;

/** Start of deceleration, as a fraction of the move (0 to 1). */
const HOLD = 0.34;

/** Samples in the lookup table. */
const RESOLUTION = 256;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

function speedAt(t: number): number {
  const launch = smoothstep(clamp01(t / LAUNCH));
  if (t <= HOLD) return launch;
  const decay = 1 - clamp01((t - HOLD) / (1 - HOLD));
  return launch * decay * decay;
}

/**
 * Normalised distance covered over time (0 to 1). Built once at load by
 * integrating `speedAt`. Accurate to well under a pixel of camera travel.
 */
const CURVE = ((): readonly number[] => {
  const table = new Array<number>(RESOLUTION + 1).fill(0);
  let total = 0;
  for (let i = 1; i <= RESOLUTION; i += 1) {
    // Trapezoid rule keeps the corner at `HOLD` sharp.
    const a = speedAt((i - 1) / RESOLUTION);
    const b = speedAt(i / RESOLUTION);
    total += (a + b) / 2;
    table[i] = total;
  }
  return total === 0 ? table : table.map((value) => value / total);
})();

/** The ease as a plain function. GSAP accepts it directly, so no `CustomEase` plugin is needed. */
export function entryEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const position = t * RESOLUTION;
  const index = Math.floor(position);
  const lower = CURVE[index] ?? 0;
  const upper = CURVE[index + 1] ?? 1;
  return lower + (upper - lower) * (position - index);
}

/**
 * When the door leaves start opening, as a fraction of the move. Early, because
 * the camera reaches the doors at about `t = 0.34` and they must be fully open
 * by then. Leaves clear at `DOORS_AT * seconds + ENTRANCE_TRAVEL_SECONDS + stagger`;
 * `assertDoorsClear` in `scenes/act2/index.ts` fails the build if that margin is lost.
 */
export const DOORS_AT = 0.03;

/**
 * Fraction of the move at which the camera reaches the doors. Used only by the
 * timing check.
 */
export const AT_THRESHOLD = 0.34;
