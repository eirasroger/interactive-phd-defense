/**
 * The motion signature of walking through a threshold.
 *
 * Every other move in the deck is one `sine.inOut` between two poses, which is
 * correct for them: they are all the same *kind* of move, a camera repositioned
 * between two things it is looking at. Crossing into a building is not that. It
 * is fifty metres of approach that nobody is meant to watch followed by four
 * metres that are the whole point, and one symmetric ease across the pair
 * spends most of its time on the avenue and arrives at the doors travelling
 * fastest — which is the opposite of what the shot needs.
 *
 * So this is authored as a **speed profile** and integrated, rather than picked
 * off the easing menu. The three numbers below are the choreography, and they
 * are legible as such:
 *
 * - `LAUNCH` — the camera accelerates out of rest rather than cutting to speed.
 * - `HOLD` — it then runs at that speed, covering the dead ground.
 * - everything after `HOLD` is a quadratic decay to nothing, which is where the
 *   doors, the threshold and the vestibule happen.
 *
 * The split lands about 58% of the distance in the first third of the time. The
 * remaining 42% is spent decelerating, so the last few metres take seconds —
 * and it is those seconds that make the entry read as arriving somewhere rather
 * than as being flown at a wall.
 */

/** Time spent accelerating out of rest, as a fraction of the move. */
const LAUNCH = 0.12;

/** When the deceleration begins. Before this the camera runs flat out. */
const HOLD = 0.34;

/** Samples in the integrated lookup. Well past what a 60 Hz move can resolve. */
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
 * Distance covered by time, normalised — which is what an ease actually is.
 *
 * Built once at module load by integrating `speedAt`. A closed form exists and
 * would be unreadable; the table is exact to well under a pixel of camera
 * travel and makes the profile above the thing that can be edited.
 */
const CURVE = ((): readonly number[] => {
  const table = new Array<number>(RESOLUTION + 1).fill(0);
  let total = 0;
  for (let i = 1; i <= RESOLUTION; i += 1) {
    // Trapezoid, because the profile has a corner at `HOLD` and a midpoint rule
    // would quietly round it off.
    const a = speedAt((i - 1) / RESOLUTION);
    const b = speedAt(i / RESOLUTION);
    total += (a + b) / 2;
    table[i] = total;
  }
  return total === 0 ? table : table.map((value) => value / total);
})();

/**
 * The ease itself, as a plain function.
 *
 * GSAP accepts one directly, which is why this needs no `CustomEase` import and
 * no plugin registration — and why the profile stays readable as arithmetic
 * rather than as a bezier string nobody can check.
 */
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
 * When the leaves start moving, as a fraction of the move.
 *
 * Almost immediately, and that is a consequence of the profile above rather
 * than a separate opinion. The doors have to be *finished* comfortably before
 * the camera reaches them, and the profile is front-loaded on purpose: on Act
 * I's exit the camera covers the fifty metres of avenue in the first third of
 * the move and is at the opening by about `t = 0.34`. A leaf that starts at
 * half time arrives half open with the camera already through it.
 *
 * The reading still holds — the leaves part while the camera is a long way out,
 * which is a building admitting you rather than a sensor reacting to a body.
 * What changed is that "a long way out" is early in *time* as well as in space,
 * because the approach is fast.
 *
 * The margin is real rather than assumed: leaves clear at
 * `DOORS_AT * seconds + ENTRANCE_TRAVEL_SECONDS + stagger`, and
 * `assertDoorsClear` in `scenes/act2/index.ts` fails the build if a change to
 * either number eats it.
 */
export const DOORS_AT = 0.03;

/**
 * Where the camera is, as a fraction of the whole move, when it should find the
 * doors already open. Used to check the choreography rather than to drive it.
 */
export const AT_THRESHOLD = 0.34;
