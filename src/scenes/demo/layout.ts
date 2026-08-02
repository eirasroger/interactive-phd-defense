/**
 * Where each demo's content sits in the shared world.
 *
 * Content is spread along -Z so that navigating between scenes is genuine
 * travel through one space. Global fog hides whatever is far enough away,
 * which is what lets a single world hold every scene without clutter.
 */
export const DEMO_LAYOUT = {
  origin: [0, 0, 0],
  assembly: [0, 0, -34],
  flow: [0, 0, -64],
  field: [0, 0, -96],
  corridor: [0, 0, -130],
} as const;
